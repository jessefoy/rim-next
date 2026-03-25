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

  const { programSlug, sessionDate } = await req.json();
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
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

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
  });
}
