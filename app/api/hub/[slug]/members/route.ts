import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership, requireCoordinator } from "@/lib/hubAuth";

// GET /api/hub/[slug]/members — list hub members
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!member && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const members = await db.hubMember.findMany({
    where: { hubId: hub.id },
    include: {
      user: { select: { firstName: true, lastName: true, preferredName: true } },
    },
    orderBy: [{ isCoordinator: "desc" }, { joinedAt: "asc" }],
  });

  return NextResponse.json(members);
}

/** POST /api/hub/[slug]/members — add a member (coordinator/admin only) */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const roles = session.user.roles ?? [];
  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, roles);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!member && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isCoordinator = (member?.isCoordinator ?? false) || isAdmin;
  try { requireCoordinator(isCoordinator, roles); }
  catch { return NextResponse.json({ error: "Coordinator required" }, { status: 403 }); }

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existing = await db.hubMember.findUnique({
    where: { hubId_userId: { hubId: hub.id, userId } },
  });
  if (existing) return NextResponse.json({ error: "Already a member" }, { status: 409 });

  const newMember = await db.hubMember.create({
    data: { hubId: hub.id, userId },
    include: { user: { select: { firstName: true, lastName: true, preferredName: true, title: true, email: true } } },
  });

  return NextResponse.json({
    id:            newMember.id,
    userId:        newMember.userId,
    isCoordinator: newMember.isCoordinator,
    position:      newMember.position,
    createdAt:     newMember.joinedAt.toISOString(),
    user: {
      firstName:     newMember.user.firstName,
      lastName:      newMember.user.lastName,
      preferredName: newMember.user.preferredName,
      title:         newMember.user.title,
      email:         newMember.user.email,
    },
  }, { status: 201 });
}
