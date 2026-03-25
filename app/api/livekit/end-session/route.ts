import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { endRoom, roomNameForProgram } from "@/lib/livekit";

/**
 * POST /api/livekit/end-session
 *
 * End a session for all participants by deleting the LiveKit room.
 * Only the assigned host, HOST_MANAGER, or ADMIN can end a session.
 *
 * Body: { programSlug: string, sessionDate?: string }
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

  // Check permissions — must be assigned host, HOST_MANAGER, or ADMIN
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isManager = roles.includes("HOST_MANAGER");

  let authorized = isAdmin || isManager;

  if (!authorized) {
    const assignment = await db.hostAssignment.findFirst({
      where: {
        programSlug,
        userId: session.user.id,
        ...(sessionDate ? { sessionDate: new Date(sessionDate) } : {}),
      },
    });
    if (assignment) authorized = true;
  }

  if (!authorized) {
    return NextResponse.json({ error: "Only the assigned host can end a session" }, { status: 403 });
  }

  const roomName = roomNameForProgram(programSlug, sessionDate);

  try {
    await endRoom(roomName);
    return NextResponse.json({ ok: true, roomName });
  } catch (e) {
    console.error("[livekit] endRoom failed:", e);
    return NextResponse.json({ error: "Failed to end session" }, { status: 500 });
  }
}
