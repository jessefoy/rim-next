import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { RoomServiceClient } from "livekit-server-sdk";
import { roomNameForProgram } from "@/lib/livekit";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";

/**
 * POST /api/livekit/mute-participant
 *
 * Server-side mute a single participant in a room.
 * Requires the caller to be a host (ADMIN, HOST_MANAGER, HostAssignment, or ProgramTeacher).
 *
 * Body: { programSlug: string, participantIdentity: string, sessionDate?: string }
 * Returns: { ok: true }
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
  const isAdmin = roles.includes("ADMIN");
  let tentativeHost = isAdmin;

  if (!tentativeHost) {
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
      if (assignment) tentativeHost = true;
      if (roles.includes("HOST_MANAGER")) tentativeHost = true;
      if (!tentativeHost) {
        const programTeacher = await db.programTeacher.findFirst({
          where: { programId: program.id, userId: session.user.id },
        });
        if (programTeacher) tentativeHost = true;
      }
    }
  }

  const isHost = isAdmin
    ? true
    : await getEffectiveHostingCapability(session.user.id, "host-team", tentativeHost);

  if (!isHost) {
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
