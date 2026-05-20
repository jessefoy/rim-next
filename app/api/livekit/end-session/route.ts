import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { endRoom, roomNameForProgram } from "@/lib/livekit";
import { resolveSessionRole } from "@/lib/livekitAuth";

/**
 * POST /api/livekit/end-session
 *
 * End a session for all participants by deleting the LiveKit room.
 * Session Host only (assigned HostAssignment for this session, OR ADMIN as
 * safety override). HOST_MANAGER and ProgramTeacher do NOT end sessions —
 * they are Co-host tier; ending is a Session-Host action.
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

  const { isSessionHost } = await resolveSessionRole(
    session.user.id,
    programSlug,
    sessionDate,
    session.user.roles ?? [],
  );
  if (!isSessionHost) {
    return NextResponse.json(
      { error: "Only the assigned host can end this session" },
      { status: 403 },
    );
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
