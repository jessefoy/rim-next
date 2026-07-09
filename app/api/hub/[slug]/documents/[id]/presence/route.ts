/**
 * POST /api/hub/[slug]/documents/[id]/presence — Heartbeat for editing presence.
 * Called when the editor opens and periodically (every 30s).
 *
 * GET — Check who's editing (returns editingBy + editingAt).
 *
 * DELETE — Clear presence when editor closes.
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import { canAccessDocument, canEditDocument } from "@/lib/documentAuth";

async function editableDocumentForViewer(
  id: string,
  hubId: string,
  userId: string,
  roles: string[],
) {
  const [doc, memberships] = await Promise.all([
    db.hubDocument.findFirst({
      where: { id, hubId, deletedAt: null, archivedAt: null },
      select: {
        addedById: true,
        hubId: true,
        visibility: true,
        placements: { select: { hubId: true } },
        editingById: true,
        editingAt: true,
        updatedAt: true,
        editingBy: { select: { firstName: true, lastName: true, preferredName: true } },
      },
    }),
    db.hubMember.findMany({
      where: { userId, status: "ACTIVE" },
      select: { hubId: true, isCoordinator: true, status: true },
    }),
  ]);
  if (!doc) return null;
  const viewer = { userId, roles, memberships };
  return { doc, viewer };
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub || (!canAccessHub(member, session.user.roles ?? []))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await editableDocumentForViewer(id, hub.id, session.user.id, session.user.roles ?? []);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditDocument(result.doc, result.viewer)) {
    return NextResponse.json({ error: "Only the author or a coordinator can mark this document as being edited." }, { status: 403 });
  }

  await db.hubDocument.update({
    where: { id },
    // Presence is ephemeral and must not look like a content revision — doing
    // so would make every editor conflict with its own first heartbeat.
    data: { editingById: session.user.id, editingAt: new Date(), updatedAt: result.doc.updatedAt },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub || (!canAccessHub(member, session.user.roles ?? []))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await editableDocumentForViewer(id, hub.id, session.user.id, session.user.roles ?? []);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { doc, viewer } = result;

  // Doc-level access: don't reveal who's editing a doc the viewer can't reach.
  const canSee = canAccessDocument(doc, {
    ...viewer,
  });
  if (!canSee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Presence is stale after 60 seconds (heartbeat is every 30s)
  const isActive = doc.editingAt && (Date.now() - new Date(doc.editingAt).getTime() < 60_000);

  return NextResponse.json({
    editingById: isActive ? doc.editingById : null,
    editingBy: isActive ? doc.editingBy : null,
    editingAt: isActive ? doc.editingAt : null,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;

  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub || !canAccessHub(member, session.user.roles ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await editableDocumentForViewer(id, hub.id, session.user.id, session.user.roles ?? []);
  if (!result || !canEditDocument(result.doc, result.viewer)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only clear if the current user is the one editing.
  await db.hubDocument.updateMany({
    where: { id, editingById: session.user.id },
    data: { editingById: null, editingAt: null, updatedAt: result.doc.updatedAt },
  });

  return NextResponse.json({ ok: true });
}
