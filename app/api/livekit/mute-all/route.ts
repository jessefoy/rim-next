import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { RoomServiceClient } from "livekit-server-sdk";
import { roomNameForProgram } from "@/lib/livekit";

/**
 * POST /api/livekit/mute-all
 *
 * Server-side mute all participants in a room except the caller.
 * Requires the caller to be a host (ADMIN, HOST_MANAGER, HostAssignment, or ProgramTeacher).
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

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  let isHost = isAdmin;

  if (!isHost) {
    const program = await db.program.findFirst({
      where: { slug: programSlug },
      select: { id: true },
    });
    if (program) {
      const assignment = await db.hostAssignment.findFirst({
        where: {
          programSlug,
          userId: session.user.id,
          ...(sessionDate ? { sessionDate: new Date(sessionDate) } : {}),
        },
      });
      if (assignment) isHost = true;
      if (roles.includes("HOST_MANAGER")) isHost = true;
      if (!isHost) {
        const programTeacher = await db.programTeacher.findFirst({
          where: { programId: program.id, userId: session.user.id },
        });
        if (programTeacher) isHost = true;
      }
    }
  }

  if (!isHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL!;
  const httpUrl = wsUrl.replace("wss://", "https://");
  const svc = new RoomServiceClient(httpUrl, process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);
  const roomName = roomNameForProgram(programSlug, sessionDate);

  const participants = await svc.listParticipants(roomName);
  let muted = 0;

  for (const participant of participants) {
    // Don't mute the host themselves
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
