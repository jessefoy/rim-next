import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createRoomToken, roomNameForProgram } from "@/lib/livekit";

/**
 * POST /api/livekit/token
 *
 * Generate a LiveKit room token for an authenticated user.
 * Host permissions are granted if the user is the assigned host for this session.
 *
 * Body: { programSlug: string, sessionDate?: string }
 * Returns: { token: string, roomName: string, wsUrl: string }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { programSlug, sessionDate, testRoom } = await req.json();
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  // Test mode: any authenticated user can join a test room directly
  // (for /admin/livekit-test — the page itself is admin-gated)
  if (testRoom) {
    const userName = session.user.name || "Member";
    const token = await createRoomToken(session.user.id, userName, testRoom, isAdmin);
    return NextResponse.json({
      token,
      roomName: testRoom,
      wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    });
  }

  if (!programSlug) {
    return NextResponse.json({ error: "programSlug required" }, { status: 400 });
  }

  // Look up the program
  const program = await db.program.findFirst({
    where: { slug: programSlug },
    select: { id: true, slug: true, name: true, programFormat: true },
  });
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  // Determine if this user is the assigned host for this session
  let isHost = isAdmin; // ADMIN always gets host controls

  if (!isHost) {
    // Check HostAssignment for this program + date
    const assignment = await db.hostAssignment.findFirst({
      where: {
        programSlug: program.slug,
        userId: session.user.id,
        ...(sessionDate ? { sessionDate: new Date(sessionDate) } : {}),
      },
    });
    if (assignment) isHost = true;

    // Also check if user has HOST or HOST_MANAGER role
    if (roles.includes("HOST_MANAGER")) isHost = true;
  }

  // Check if user is on the host team (can step in as emergency host)
  const isHostTeam = isHost || roles.includes("HOST") || roles.includes("HOST_MANAGER");

  const roomName = roomNameForProgram(program.slug, sessionDate);
  const userName = session.user.name || "Member";

  const token = await createRoomToken(
    session.user.id,
    userName,
    roomName,
    isHost,
  );

  return NextResponse.json({
    token,
    roomName,
    wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    isHost,
    isHostTeam,
  });
}
