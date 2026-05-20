import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { RoomServiceClient } from "livekit-server-sdk";
import { roomNameForProgram } from "@/lib/livekit";
import { resolveSessionRole } from "@/lib/livekitAuth";

/**
 * POST /api/livekit/mute-all
 *
 * Server-side mute every participant in a room except the caller.
 * Co-host tier or higher (ADMIN, HOST_MANAGER, ProgramTeacher, or Session Host).
 *
 * Body: { programSlug: string, sessionDate?: string }
 * Returns: { muted: number }
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

  const { isCoHost } = await resolveSessionRole(
    session.user.id,
    programSlug,
    sessionDate,
    session.user.roles ?? [],
  );
  if (!isCoHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL!;
  const httpUrl = wsUrl.replace("wss://", "https://");
  const svc = new RoomServiceClient(httpUrl, process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);
  const roomName = roomNameForProgram(programSlug, sessionDate);

  const participants = await svc.listParticipants(roomName);
  let muted = 0;

  for (const participant of participants) {
    if (participant.identity === session.user.id) continue;
    for (const track of participant.tracks) {
      // Track type 0 = AUDIO in LiveKit proto
      if (track.type === 0 && !track.muted) {
        await svc.mutePublishedTrack(roomName, participant.identity, track.sid, true);
        muted++;
      }
    }
  }

  return NextResponse.json({ muted });
}
