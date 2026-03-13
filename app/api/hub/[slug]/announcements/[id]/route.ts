import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership, requireCoordinator } from "@/lib/hubAuth";

// PATCH /api/hub/[slug]/announcements/[id] — archive/restore (coordinator)
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

  try {
    requireCoordinator(member?.isCoordinator ?? false, session.user.roles ?? []);
  } catch {
    return NextResponse.json({ error: "Coordinators only" }, { status: 403 });
  }

  const ann = await db.hubAnnouncement.findFirst({ where: { id, hubId: hub.id } });
  if (!ann) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { status } = await req.json();
  const updated = await db.hubAnnouncement.update({
    where: { id },
    data:  { status },
    include: { author: { select: { firstName: true, lastName: true, preferredName: true } } },
  });

  return NextResponse.json(updated);
}

// DELETE /api/hub/[slug]/announcements/[id] — hard delete (coordinator)
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

  try {
    requireCoordinator(member?.isCoordinator ?? false, session.user.roles ?? []);
  } catch {
    return NextResponse.json({ error: "Coordinators only" }, { status: 403 });
  }

  const ann = await db.hubAnnouncement.findFirst({ where: { id, hubId: hub.id } });
  if (!ann) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.hubAnnouncement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
