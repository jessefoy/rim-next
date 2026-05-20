import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { RoomServiceClient } from "livekit-server-sdk";
import { roomNameForProgram } from "@/lib/livekit";
import { resolveSessionRole } from "@/lib/livekitAuth";

/**
 * POST /api/livekit/mute-participant
 *
 * Server-side mute a single participant in a room.
 * Co-host tier or higher (ADMIN, HOST_MANAGER, ProgramTeacher, or Session Host).
 *
 * Body: { programSlug: string, participantIdentity: string, sessionDate?: string }
 * Returns: { ok: true, muted: number }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { programSlug, participantIdentity, sessionDate } = await req.json();
  if (!programSlug || !participantIdentity) {
    return NextResponse.json({ error: "programSlug and participantIdentity required" }, { status: 400 });
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

  const participant = await svc.getParticipant(roomName, participantIdentity);
  let muted = 0;
  for (const track of participant.tracks) {
    if (track.type === 0 && !track.muted) {
      await svc.mutePublishedTrack(roomName, participantIdentity, track.sid, true);
      muted++;
    }
  }

  return NextResponse.json({ ok: true, muted });
}
