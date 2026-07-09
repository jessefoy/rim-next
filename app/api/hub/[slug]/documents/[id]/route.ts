import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { canAccessHub, canManageTrash, effectiveCoordinator, getHubMembership } from "@/lib/hubAuth";
import { canAccessDocument, canEditDocument } from "@/lib/documentAuth";
import { cleanupRemovedBlobs } from "@/lib/blobCleanup";
import { sendHubDocumentUpdatedEmail } from "@/lib/email";

const BASE_URL = (process.env.NEXTAUTH_URL ?? "").trim().replace(/\/$/, "");

// GET — fetch a single document (for view/edit pages)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!hub || (!canAccessHub(member, session.user.roles ?? []))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const doc = await db.hubDocument.findUnique({
    where: { id },
    include: {
      addedBy:    { select: { firstName: true, lastName: true, preferredName: true } },
      placements: { select: { hubId: true } },
    },
  });
  if (!doc || doc.hubId !== hub.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Doc-level access (not just canAccessHub): a COORDINATORS-visibility doc must
  // 404 for a non-coordinator member, even though they can reach the hub.
  const canSee = canAccessDocument(doc, {
    userId:      session.user.id,
    roles:       session.user.roles ?? [],
    memberships: member ? [{ hubId: hub.id, isCoordinator: member.isCoordinator, status: member.status }] : [],
  });
  if (!canSee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Trashed docs are visible only to trash-managers (admin / guiding teacher /
  // hub coordinator). Everyone else gets a 404 — same as if it never existed.
  if (doc.deletedAt) {
    const roles = session.user.roles ?? [];
    const isCoord = member?.isCoordinator ?? false;
    if (!canManageTrash(roles, isCoord)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  return NextResponse.json(doc);
}

// PATCH /api/hub/[slug]/documents/[id]
// Optional: notifyUserIds — array of userId strings to notify about the update.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessHub(member, session.user.roles ?? [])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Author or coordinator can edit
  const doc = await db.hubDocument.findFirst({ where: { id, hubId: hub.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Trashed and archived docs are read-only. Restore (or unarchive) first.
  if (doc.deletedAt) {
    return NextResponse.json({ error: "This document is in the trash — restore it first" }, { status: 400 });
  }
  if (doc.archivedAt) {
    return NextResponse.json({ error: "This document is archived — unarchive it first" }, { status: 400 });
  }

  const patchRoles = session.user.roles ?? [];
  const memberships = await db.hubMember.findMany({
    where: { userId: session.user.id, status: "ACTIVE" },
    select: { hubId: true, isCoordinator: true, status: true },
  });
  const viewer = { userId: session.user.id, roles: patchRoles, memberships };
  const isAuthor = doc.addedById === session.user.id;
  if (!canEditDocument({ ...doc, placements: [] }, viewer)) {
    return NextResponse.json({ error: "Only the author or a coordinator can edit" }, { status: 403 });
  }

  // Enforce lock — only author, ADMIN, or GUIDING_TEACHER can edit a locked
  // document. (Coordinators don't override locks; lock is the author asserting
  // sole authorship. ADMIN/GT override for moderation/restoration.)
  const canOverrideLock =
    patchRoles.includes("ADMIN") || patchRoles.includes("GUIDING_TEACHER");
  if (doc.isLocked && !isAuthor && !canOverrideLock) {
    return NextResponse.json({ error: "This document is locked by the author" }, { status: 403 });
  }

  const { label, url, description, fileType, category, newCategory, body, notifyUserIds, expectedUpdatedAt } = await req.json();

  // Native docs are intentionally single-editor. Refuse to overwrite a newer
  // save made after this editor opened; the editor keeps the person's work in
  // place so they can copy it before refreshing.
  if (doc.isNative) {
    if (typeof expectedUpdatedAt !== "string") {
      return NextResponse.json({ error: "This document needs to be refreshed before saving." }, { status: 400 });
    }
    if (doc.updatedAt.toISOString() !== expectedUpdatedAt) {
      return NextResponse.json({ error: "This document changed while you were editing. Copy any work you need, then refresh before saving." }, { status: 409 });
    }
  }

  // Handle inline new category creation. Reuse an existing category's casing if
  // one already matches case-insensitively, so we never mint a near-duplicate.
  let resolvedCategory = category !== undefined ? (category || null) : doc.category;
  if (newCategory?.trim()) {
    const requested = newCategory.trim().replace(/\s+/g, " ");
    const match = (hub.documentCategories ?? []).find((c) => c.toLowerCase() === requested.toLowerCase());
    resolvedCategory = match ?? requested;
    if (!match) {
      await db.hub.update({
        where: { id: hub.id },
        data:  { documentCategories: { push: requested } },
      });
    }
  }

  const oldBody = doc.body;

  const updated = await db.hubDocument.update({
    where: { id },
    data: {
      label:       label?.trim()       ?? doc.label,
      url:         doc.isNative ? null : (url?.trim() ?? doc.url),
      description: description !== undefined ? (description?.trim() || null) : doc.description,
      fileType:    fileType            ?? doc.fileType,
      category:    resolvedCategory,
      body:        body !== undefined ? body : doc.body,
    },
    include: { addedBy: { select: { firstName: true, lastName: true, preferredName: true } } },
  });

  // Clean up any blob images that were removed from the body
  if (body !== undefined) {
    cleanupRemovedBlobs(oldBody, body); // fire-and-forget
  }

  // Fire notifications after response
  const validUserIds: string[] = Array.isArray(notifyUserIds) ? notifyUserIds : [];
  if (validUserIds.length > 0) {
    const authorName = session.user.name || session.user.email?.split("@")[0] || "Someone";
    const docUrl = `${BASE_URL}/account/hub/${slug}/documents/${id}`;

    after(async () => {
      const eligible = await db.hubMember.findMany({
        where: {
          hubId:                 hub.id,
          userId:                { in: validUserIds, not: session.user.id },
          status:                "ACTIVE",
          communicationsEnabled: true,
        },
        include: { user: { select: { id: true, email: true, firstName: true } } },
      });

      if (eligible.length === 0) return;

      // Dedup against prior (docId, userId, "updated") notifications.
      const existing = await db.hubDocumentNotification.findMany({
        where: {
          documentId: id,
          userId:     { in: eligible.map((m) => m.userId) },
          eventType:  "updated",
        },
        select: { userId: true },
      });
      const alreadyNotified = new Set(existing.map((n) => n.userId));
      const toNotify = eligible.filter((m) => !alreadyNotified.has(m.userId));

      if (toNotify.length === 0) return;

      await db.hubDocumentNotification.createMany({
        data: toNotify.map((m) => ({
          documentId: id,
          userId:     m.userId,
          eventType:  "updated",
        })),
      });

      await Promise.allSettled(
        toNotify
          .filter((m) => m.user.email)
          .map((m) =>
            sendHubDocumentUpdatedEmail({
              to:         m.user.email!,
              firstName:  m.user.firstName,
              authorName,
              hubName:    hub.name,
              docLabel:   updated.label,
              docUrl,
            })
          )
      );
    });
  }

  return NextResponse.json(updated);
}

// DELETE /api/hub/[slug]/documents/[id]
// Soft-delete (sends to manager trash). Author or coordinator. Idempotent.
//
// Three-stage lifecycle: Active → Archived → Trash → permanent delete.
// A document MUST be archived first before it can be soft-deleted — this is
// the deliberate-staging design ("archive is reversible; trash is the next
// step toward removal"). The UI hides the Delete button on non-archived rows;
// this server check is the enforcement.
//
// Permanent removal: POST /api/hub/[slug]/documents/[id]/permanent-delete
// (managers only — visible on the Trash page).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdminDelete = (session.user.roles ?? []).includes("ADMIN");
  if (!canAccessHub(member, session.user.roles ?? [])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Author or coordinator can soft-delete
  const doc = await db.hubDocument.findFirst({ where: { id, hubId: hub.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.deletedAt) return NextResponse.json({ ok: true }); // idempotent

  // Enforce archive-first: must be archived before deletion.
  if (!doc.archivedAt) {
    return NextResponse.json({ error: "Archive this document first, then delete it from the Archived tab." }, { status: 400 });
  }

  const isAuthorDel = doc.addedById === session.user.id;
  const isCoordDel = effectiveCoordinator(member, session.user.roles ?? []);
  if (!isAuthorDel && !isCoordDel) {
    return NextResponse.json({ error: "Only the author or a coordinator can delete" }, { status: 403 });
  }

  await db.hubDocument.update({
    where: { id },
    data:  { deletedAt: new Date(), deletedById: session.user.id },
  });
  return NextResponse.json({ ok: true, trashed: true });
}
