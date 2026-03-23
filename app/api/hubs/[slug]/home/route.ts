import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** PATCH /api/hubs/[slug]/home — update hub home content (coordinator or admin) */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  const hub = await db.hub.findUnique({
    where: { slug },
    include: { members: { where: { userId: session.user.id } } },
  });

  if (!hub) return NextResponse.json({ error: "Hub not found" }, { status: 404 });

  const member = hub.members[0] ?? null;
  const isCoordinator = (member?.isCoordinator ?? false) || isAdmin;
  if (!isCoordinator) {
    return NextResponse.json({ error: "Only coordinators can edit hub home content." }, { status: 403 });
  }

  const body = await req.json();
  const { homeContent } = body;

  const updated = await db.hub.update({
    where: { slug },
    data: { homeContent: homeContent ?? null },
  });

  return NextResponse.json({ ok: true, homeContent: updated.homeContent });
}
