import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { effectiveCoordinator } from "@/lib/hubAuth";

/**
 * PATCH /api/hubs/[slug]/home — the team's own line under its name on Home
 * (Hub.description), edited by the team's leads: a coordinator, the guiding
 * teacher or an admin (effectiveCoordinator). One line, at most 200
 * characters; empty clears it and Home shows "Your team's shared space."
 *
 * The welcome and guidance sections this route used to save were retired
 * from team Home (Jesse, 2026-10-13); their columns stay until dropped.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const roles = session.user.roles ?? [];

  const hub = await db.hub.findUnique({
    where: { slug },
    include: { members: { where: { userId: session.user.id } } },
  });
  if (!hub) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const member = hub.members[0] ?? null;
  if (!effectiveCoordinator(member, roles)) {
    return NextResponse.json({ error: "Only this team's leads can change this line." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.description !== "string") {
    return NextResponse.json({ error: "No line to save." }, { status: 400 });
  }
  const description = body.description.replace(/\s+/g, " ").trim().slice(0, 200) || null;

  const updated = await db.hub.update({
    where: { slug },
    data: { description },
    select: { description: true },
  });

  return NextResponse.json({ ok: true, description: updated.description });
}
