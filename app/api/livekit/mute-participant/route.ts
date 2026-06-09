import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { RoomServiceClient } from "livekit-server-sdk";
import { roomNameForProgram } from "@/lib/livekit";
import { resolveSessionRole } from "@/lib/livekitAuth";
import { assertSessionDateInWindow } from "@/lib/sessionWindow";

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

  const roles = session.user.roles ?? [];
  const assertion = await assertSessionDateInWindow(programSlug, sessionDate, roles);
  if (!assertion.ok) {
    return NextResponse.json(
      { error: assertion.error, message: assertion.message },
      { status: assertion.status },
    );
  }
  const effectiveSessionDate = assertion.window.sessionDate;

  const { isCoHost } = await resolveSessionRole(
    session.user.id,
    programSlug,
    effectiveSessionDate,
    roles,
  );
  if (!isCoHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL!;
  const httpUrl = wsUrl.replace("wss://", "https://");
  const svc = new RoomServiceClient(httpUrl, process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);
  const roomName = roomNameForProgram(programSlug, effectiveSessionDate);

  // Guard the LiveKit SDK calls: getParticipant throws (not_found) when the
  // target just left or refreshed — a common race when a co-host taps Mute a
  // beat after a participant drops. The desired end-state (they aren't
  // publishing) already holds, so treat any SDK failure as a benign no-op
  // rather than an unhandled 500. (Audit MUTE-1.)
  let muted = 0;
  try {
    const participant = await svc.getParticipant(roomName, participantIdentity);
    for (const track of participant.tracks) {
      if (track.type === 0 && !track.muted) {
        await svc.mutePublishedTrack(roomName, participantIdentity, track.sid, true);
        muted++;
      }
    }
  } catch (e) {
    console.error("[livekit] mute-participant failed:", e);
    return NextResponse.json({ ok: true, muted: 0 });
  }

  return NextResponse.json({ ok: true, muted });
}
