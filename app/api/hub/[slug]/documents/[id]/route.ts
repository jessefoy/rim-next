import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership, requireCoordinator } from "@/lib/hubAuth";

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
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try { requireCoordinator(member.isCoordinator, session.user.roles ?? []); }
  catch { return NextResponse.json({ error: "Coordinators only" }, { status: 403 }); }

  const doc = await db.hubDocument.findFirst({ where: { id, hubId: hub.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { label, url, description, fileType, category } = await req.json();
  const updated = await db.hubDocument.update({
    where: { id },
    data: {
      label:       label?.trim()       ?? doc.label,
      url:         url?.trim()         ?? doc.url,
      description: description?.trim() ?? doc.description,
      fileType:    fileType            ?? doc.fileType,
      category:    category            ?? doc.category,
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
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try { requireCoordinator(member.isCoordinator, session.user.roles ?? []); }
  catch { return NextResponse.json({ error: "Coordinators only" }, { status: 403 }); }

  const doc = await db.hubDocument.findFirst({ where: { id, hubId: hub.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.hubDocument.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
