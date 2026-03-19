import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership, requireCoordinator } from "@/lib/hubAuth";

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

  try { requireCoordinator(member?.isCoordinator ?? false, session.user.roles ?? []); }
  catch { return NextResponse.json({ error: "Coordinators only" }, { status: 403 }); }

  const doc = await db.hubDocument.findFirst({ where: { id, hubId: hub.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { label, url, description, fileType, category, body } = await req.json();
  const updated = await db.hubDocument.update({
    where: { id },
    data: {
      label:       label?.trim()       ?? doc.label,
      url:         doc.isNative ? null : (url?.trim() ?? doc.url),
      description: description !== undefined ? (description?.trim() || null) : doc.description,
      fileType:    fileType            ?? doc.fileType,
      category:    category !== undefined ? (category || null) : doc.category,
      body:        body !== undefined ? body : doc.body,
    },
    include: { addedBy: { select: { firstName: true, lastName: true, preferredName: true } } },
  });

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

  try { requireCoordinator(member?.isCoordinator ?? false, session.user.roles ?? []); }
  catch { return NextResponse.json({ error: "Coordinators only" }, { status: 403 }); }

  const doc = await db.hubDocument.findFirst({ where: { id, hubId: hub.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.hubDocument.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
