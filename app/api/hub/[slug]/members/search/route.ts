import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership, requireCoordinator, effectiveCoordinator } from "@/lib/hubAuth";

/** GET /api/hub/[slug]/members/search?q=... — search users to add (coordinator/admin) */
export async function GET(
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

  const isCoordinator = effectiveCoordinator(member, roles);
  try { requireCoordinator(isCoordinator, roles); }
  catch { return NextResponse.json({ error: "Coordinator required" }, { status: 403 }); }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json([]);

  // Exclude users already in the hub and archived accounts.
  const existingUserIds = (
    await db.hubMember.findMany({
      where: { hubId: hub.id },
      select: { userId: true },
    })
  ).map((m) => m.userId);

  const users = await db.user.findMany({
    where: {
      archivedAt: null,
      memberStatus: "ACTIVE",
      id: { notIn: existingUserIds },
      OR: [
        { firstName:     { contains: q, mode: "insensitive" } },
        { lastName:      { contains: q, mode: "insensitive" } },
        { preferredName: { contains: q, mode: "insensitive" } },
        { email:         { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      email: true,
    },
    take: 20,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return NextResponse.json(users);
}
