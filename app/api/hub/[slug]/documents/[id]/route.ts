import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership } from "@/lib/hubAuth";
import { cleanupRemovedBlobs, cleanupAllBlobs } from "@/lib/blobCleanup";

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
  if (!hub || (!member && !isAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const doc = await db.hubDocument.findUnique({
    where: { id },
    include: { addedBy: { select: { firstName: true, lastName: true, preferredName: true } } },
  });
  if (!doc || doc.hubId !== hub.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(doc);
}

// PATCH /api/hub/[slug]/documents/[id]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdminPatch = (session.user.roles ?? []).includes("ADMIN");
  if (!member && !isAdminPatch) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Author or coordinator can edit
  const doc = await db.hubDocument.findFirst({ where: { id, hubId: hub.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAuthor = doc.addedById === session.user.id;
  const isCoord = (member?.isCoordinator ?? false) || isAdminPatch;
  if (!isAuthor && !isCoord) {
    return NextResponse.json({ error: "Only the author or a coordinator can edit" }, { status: 403 });
  }

  const { label, url, description, fileType, category, newCategory, body } = await req.json();

  // Handle inline new category creation
  let resolvedCategory = category !== undefined ? (category || null) : doc.category;
  if (newCategory?.trim()) {
    resolvedCategory = newCategory.trim();
    await db.hub.update({
      where: { id: hub.id },
      data:  { documentCategories: { push: resolvedCategory as string } },
    });
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

  return NextResponse.json(updated);
}

// DELETE /api/hub/[slug]/documents/[id]
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
  if (!member && !isAdminDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Author or coordinator can delete
  const doc = await db.hubDocument.findFirst({ where: { id, hubId: hub.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAuthorDel = doc.addedById === session.user.id;
  const isCoordDel = (member?.isCoordinator ?? false) || isAdminDelete;
  if (!isAuthorDel && !isCoordDel) {
    return NextResponse.json({ error: "Only the author or a coordinator can delete" }, { status: 403 });
  }

  // Clean up any blob images before deleting the document
  if (doc.body) cleanupAllBlobs(doc.body); // fire-and-forget

  await db.hubDocument.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
