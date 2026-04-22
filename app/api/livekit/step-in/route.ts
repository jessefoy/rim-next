import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createRoomToken, roomNameForProgram } from "@/lib/livekit";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";

/**
 * POST /api/livekit/step-in
 *
 * Emergency host takeover: a host-team member (HOST, HOST_MANAGER, ADMIN)
 * claims host controls for a session that has no host present.
 *
 * - Creates/updates HostAssignment for this session
 * - Returns a new token with roomAdmin: true
 * - The client reconnects with the new token
 *
 * Body: { programSlug: string, sessionDate?: string }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const tentativeHostTeam = isAdmin || roles.includes("HOST") || roles.includes("HOST_MANAGER");

  // Respect hub authority: a host-team HubMember record can revoke the grant
  // even if the system role is still present. ADMIN bypasses.
  const canStepIn = isAdmin
    ? true
    : await getEffectiveHostingCapability(session.user.id, "host-team", tentativeHostTeam);

  if (!canStepIn) {
    return NextResponse.json(
      { error: "Only host team members can step in" },
      { status: 403 },
    );
  }

  const { programSlug, sessionDate } = await req.json();
  if (!programSlug) {
    return NextResponse.json({ error: "programSlug required" }, { status: 400 });
  }

  const program = await db.program.findFirst({
    where: { slug: programSlug },
    select: { id: true, slug: true, name: true },
  });
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  // Update the existing HostAssignment to this user, or create one if none exists.
  // HostAssignment is @@unique([programSlug, sessionDate]) — one assignment per session.
  await db.hostAssignment.upsert({
    where: {
      programSlug_sessionDate: {
        programSlug,
        sessionDate: sessionDate ? new Date(sessionDate) : new Date(0),
      },
    },
    create: {
      programSlug,
      userId: session.user.id,
      ...(sessionDate ? { sessionDate: new Date(sessionDate) } : {}),
      notes: `Emergency step-in by ${session.user.name || session.user.id}`,
    },
    update: {
      userId: session.user.id,
      notes: `Emergency step-in by ${session.user.name || session.user.id}`,
    },
  });

  // Generate a new token with host controls
  const roomName = roomNameForProgram(programSlug, sessionDate);
  const userName = session.user.name || "Host";

  const token = await createRoomToken(
    session.user.id,
    userName,
    roomName,
    true, // roomAdmin
  );

  return NextResponse.json({
    token,
    roomName,
    wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    isHost: true,
  });
}
