import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership } from "@/lib/hubAuth";

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
