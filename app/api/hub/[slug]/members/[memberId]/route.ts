import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership, requireCoordinator } from "@/lib/hubAuth";

/** PATCH /api/hub/[slug]/members/[memberId] — update member (coordinator/admin) */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, memberId } = await params;
  const roles = session.user.roles ?? [];
  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, roles);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!member && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isCoordinator = (member?.isCoordinator ?? false) || isAdmin;
  try { requireCoordinator(isCoordinator, roles); }
  catch { return NextResponse.json({ error: "Coordinator required" }, { status: 403 }); }

  const body = await req.json();
  const data: Record<string, any> = {};
  if (body.isCoordinator !== undefined) data.isCoordinator = body.isCoordinator;
  if (body.position !== undefined) data.position = body.position || null;

  const updated = await db.hubMember.update({
    where: { id: memberId },
    data,
  });

  return NextResponse.json(updated);
}

/** DELETE /api/hub/[slug]/members/[memberId] — remove member (coordinator/admin) */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, memberId } = await params;
  const roles = session.user.roles ?? [];
  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, roles);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!member && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isCoordinator = (member?.isCoordinator ?? false) || isAdmin;
  try { requireCoordinator(isCoordinator, roles); }
  catch { return NextResponse.json({ error: "Coordinator required" }, { status: 403 }); }

  // Don't allow removing yourself
  const target = await db.hubMember.findUnique({ where: { id: memberId } });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (target.userId === session.user.id) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  await db.hubMember.delete({ where: { id: memberId } });

  return NextResponse.json({ ok: true });
}
