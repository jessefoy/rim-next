import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * PATCH /api/hubs/[slug]/home — update hub home content (coordinator or admin).
 *
 * Accepts `welcomeBody` and/or `homeContent` (BlockNote JSON). Each is optional;
 * only present keys are written. Passing `null` explicitly clears a field.
 */
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

  // Build update data with only the fields the caller sent. Fields are Prisma
  // Json? — mirrors the original homeContent-only write shape.
  const hasWelcome = Object.prototype.hasOwnProperty.call(body, "welcomeBody");
  const hasHome = Object.prototype.hasOwnProperty.call(body, "homeContent");
  if (!hasWelcome && !hasHome) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const updated = await db.hub.update({
    where: { slug },
    data: {
      ...(hasWelcome ? { welcomeBody: body.welcomeBody ?? null } : {}),
      ...(hasHome ? { homeContent: body.homeContent ?? null } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    welcomeBody: updated.welcomeBody,
    homeContent: updated.homeContent,
  });
}
