import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createRoomToken, roomNameForProgram } from "@/lib/livekit";
import { resolveSessionRole } from "@/lib/livekitAuth";

/**
 * POST /api/livekit/token
 *
 * Generate a LiveKit room token for an authenticated user.
 *
 * Identity and capability are separated — see lib/livekitAuth.ts for the
 * full model:
 *   isSessionHost      identity: HostAssignment for this exact session.
 *                      Drives the "Host" pill. No role-based bypass.
 *   hasEndAllAuthority capability: End-for-All. Assigned host OR ADMIN OR
 *                      GUIDING_TEACHER OR (Teacher when no host assigned).
 *                      Drives the End button label + the end-session gate.
 *   isCoHost           capability: mute, share, Bell mode, manage participants.
 *                      Held by Host, Teacher, and Host Volunteers.
 *
 * Body: { programSlug: string, sessionDate?: string }
 * Returns: { token, roomName, wsUrl, isSessionHost, hasEndAllAuthority,
 *            isCoHost, isHostTeam, isProgramTeacher, audioProfile, avatarUrl }
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
  // (for /admin/livekit-test — the page itself is admin-gated). Admin gets
  // full Session Host permissions in test rooms.
  if (testRoom) {
    const userName = session.user.name || "Member";
    const token = await createRoomToken(
      session.user.id,
      userName,
      testRoom,
      { roomAdmin: isAdmin, canShareScreen: isAdmin },
    );
    return NextResponse.json({
      token,
      roomName: testRoom,
      wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    });
  }

  if (!programSlug) {
    return NextResponse.json({ error: "programSlug required" }, { status: 400 });
  }

  const program = await db.program.findFirst({
    where: { slug: programSlug },
    select: { id: true, slug: true, name: true, programFormat: true },
  });
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const caller = await db.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true },
  });

  const { isSessionHost, hasEndAllAuthority, isCoHost, isHostTeam, isProgramTeacher } =
    await resolveSessionRole(session.user.id, program.slug, sessionDate, roles);

  // Audio profile — drives RoomOptions.audioCaptureDefaults in the client:
  //   teacher  → preserve bells/music (no noise suppression, no AGC)
  //   speaker  → host who isn't teaching; clean speech profile
  //   listener → everyone else; clean speech profile
  const audioProfile: "teacher" | "speaker" | "listener" =
    isProgramTeacher ? "teacher" : isCoHost ? "speaker" : "listener";

  const roomName = roomNameForProgram(program.slug, sessionDate);
  const userName = session.user.name || "Member";

  // Seed metadata so the role pills render the moment a participant
  // appears in the room. Three orthogonal flags drive the badge UI:
  //   host:    Session Host (singular)         → "Host" pill (teal)
  //   teacher: ProgramTeacher for this program → "Teacher" pill (warm)
  //   cohost:  Co-host capability, but NOT     → "Host Volunteer" pill
  //            Host and NOT Teacher              (muted slate; metadata
  //                                               field kept as `cohost`
  //                                               for stability)
  // A Session Host who is also a Teacher gets both `host` and `teacher`
  // and renders both pills. `cohost` is set only when neither of the
  // other two applies, so each participant carries at most two pills.
  //
  // Identity-only — `host` is seeded ONLY when `isSessionHost` (assignment
  // exists). ADMIN/GT capability lives in `hasEndAllAuthority`, returned
  // separately in the response and used to gate the End button. Without
  // this split, every joining ADMIN showed the Host pill on every session
  // regardless of who was actually assigned (audit finding 2026-05-26).
  //
  // Trust note: `canUpdateOwnMetadata: true` (lib/livekit.ts) lets a
  // client rewrite their own metadata to forge any of these flags. The
  // pills are *UI cues only*, not a security boundary. Real actions (mute,
  // end-for-all, screen share) are gated server-side via the same
  // resolveSessionRole helper that gates token issuance.
  const seedMeta: {
    avatarUrl?: string;
    host?: boolean;
    teacher?: boolean;
    cohost?: boolean;
  } = {};
  if (caller?.avatarUrl) seedMeta.avatarUrl = caller.avatarUrl;
  if (isSessionHost) seedMeta.host = true;
  if (isProgramTeacher) seedMeta.teacher = true;
  if (isCoHost && !isSessionHost && !isProgramTeacher) seedMeta.cohost = true;
  const initialMeta = Object.keys(seedMeta).length > 0 ? JSON.stringify(seedMeta) : undefined;

  // Token grants. canShareScreen extended to all Co-hosts (was Session-Host-
  // only) — closes a latent bug where Co-hosts saw the Share Screen button
  // in the control bar but the underlying token didn't grant the source,
  // so taps silently failed. The Share Screen action is socially Co-host
  // capability across the board (matches Zoom/Meet behavior), and the
  // session 121 "Session-Host-only" restriction was over-tight.
  const token = await createRoomToken(
    session.user.id,
    userName,
    roomName,
    { roomAdmin: isCoHost, canShareScreen: isCoHost },
    initialMeta,
  );

  return NextResponse.json({
    token,
    roomName,
    wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    isSessionHost,
    hasEndAllAuthority,
    isCoHost,
    isHostTeam,
    isProgramTeacher,
    audioProfile,
    avatarUrl: caller?.avatarUrl ?? null,
  });
}
