import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createRoomToken, roomNameForProgram, sessionDisplayName } from "@/lib/livekit";
import { resolveSessionRole } from "@/lib/livekitAuth";
import { DEFAULT_HOSTING_HUB_SLUG, resolveTeacherPillLabel } from "@/lib/programHub";
import { getActiveSessionWindow, describeInactiveWindow } from "@/lib/sessionWindow";
import { ctDateStr, shiftToDate } from "@/lib/scheduleUtils";

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
    select: {
      id: true,
      slug: true,
      name: true,
      programFormat: true,
      startDatetime: true,
      endDatetime: true,
      recurrenceFreq: true,
      recurrenceInterval: true,
      recurrenceDays: true,
      recurrenceCount: true,
      teacherLabel: true,
      hostingHubSlug: true,
    },
  });
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  // Resolve the program's hosting hub (default: host-team) and its
  // teacher-capability flags. Done in-line so we can share the result with
  // `resolveSessionRole` below without a second query. A peer-led program
  // in the Silent Meditation Hub will read `assignmentGrantsTeacher: true`
  // and a hub-level pill label here; host-team programs keep the defaults.
  const resolvedHostingHubSlug =
    program.hostingHubSlug ?? DEFAULT_HOSTING_HUB_SLUG;
  const hostingHub = await db.hub.findUnique({
    where: { slug: resolvedHostingHubSlug },
    select: { assignmentGrantsTeacher: true, teacherLabel: true },
  });
  const programHubInfo = {
    hubSlug: resolvedHostingHubSlug,
    assignmentGrantsTeacher: hostingHub?.assignmentGrantsTeacher ?? false,
    hubTeacherLabel: hostingHub?.teacherLabel ?? null,
  };

  // Time gate — refuse token issuance outside the session window. ADMIN and
  // GUIDING_TEACHER bypass as a safety override (mirrors the End-for-All
  // authority model: the safety surface stays open to the people responsible
  // for the platform). Bypass is required so direct-URL access remains
  // possible for testing and emergency room recovery outside hours.
  const isAdminOrGT = isAdmin || roles.includes("GUIDING_TEACHER");
  const sessionWindow = getActiveSessionWindow(program);
  let effectiveSessionDate: string | undefined;
  if (sessionWindow.active) {
    effectiveSessionDate = sessionWindow.sessionDate;
  } else if (isAdminOrGT) {
    // Bypass: use the caller-supplied sessionDate verbatim if provided
    // (matches an existing assignment's stored format). Otherwise project
    // the program's start moment onto today's CT date using the same
    // shiftToDate the schedule tool uses, so the resulting timestamp
    // aligns with HostAssignment rows for today and the roomName suffix
    // is correct.
    if (sessionDate) {
      effectiveSessionDate = sessionDate;
    } else if (program.startDatetime) {
      const todayCT = ctDateStr(new Date().toISOString());
      effectiveSessionDate = shiftToDate(
        program.startDatetime.toISOString(),
        todayCT,
      ).toISOString();
    } else {
      // No startDatetime at all — fall back to bare ISO; chat/room name
      // are still per-day via the slice in roomNameForProgram.
      effectiveSessionDate = new Date().toISOString();
    }
  } else {
    return NextResponse.json(
      {
        error: "session-closed",
        message: describeInactiveWindow(sessionWindow),
        nextSessionDate: sessionWindow.nextSessionDate,
        nextOpensAt: sessionWindow.nextOpensAt?.toISOString() ?? null,
        nextStartsAt: sessionWindow.nextStartsAt?.toISOString() ?? null,
      },
      { status: 403 },
    );
  }

  const caller = await db.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true, firstName: true, lastName: true, preferredName: true },
  });

  const { isSessionHost, hasEndAllAuthority, isCoHost, isHostTeam, isProgramTeacher } =
    await resolveSessionRole(
      session.user.id,
      program.slug,
      effectiveSessionDate,
      roles,
      programHubInfo,
    );

  // Pill label hierarchy: program override > hub default > built-in "Teacher".
  // `null` here means "use the built-in default" — the client renderer falls
  // through to "Teacher" when teacherLabel is absent from metadata, so we
  // leave it unset rather than seed the literal string.
  const effectiveTeacherLabel = resolveTeacherPillLabel(
    program.teacherLabel,
    programHubInfo.hubTeacherLabel,
  );

  // Audio profile — drives RoomOptions.audioCaptureDefaults in the client:
  //   teacher  → preserve bells/music (no noise suppression, no AGC)
  //   speaker  → host who isn't teaching; clean speech profile
  //   listener → everyone else; clean speech profile
  const audioProfile: "teacher" | "speaker" | "listener" =
    isProgramTeacher ? "teacher" : isCoHost ? "speaker" : "listener";

  // Per-session room name. Every session gets a fresh roomName ending in
  // the CT date — recurring programs no longer share one room across all
  // occurrences. Session-scoped chat (SessionChatMessage rows are filtered
  // by roomName) inherits this scoping automatically: today's chat is
  // invisible to tomorrow's session because tomorrow's room has a new
  // name. Three layers cover the "forgot to End for All" fallback:
  // explicit End-for-All, LiveKit's empty-room idle cleanup, and this
  // time gate refusing to issue tokens after the close window.
  const roomName = roomNameForProgram(program.slug, effectiveSessionDate);
  // Full name (first + last) for the tile + roster — not just first name.
  const userName = sessionDisplayName(caller, session.user.name || "Member");

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
    teacherLabel?: string;
    cohost?: boolean;
  } = {};
  if (caller?.avatarUrl) seedMeta.avatarUrl = caller.avatarUrl;
  if (isSessionHost) seedMeta.host = true;
  if (isProgramTeacher) {
    seedMeta.teacher = true;
    // Override the default "Teacher" pill label using the resolved hierarchy
    // (program override → hub default → built-in default). Null stays null
    // on the wire — the pill renderer falls back to "Teacher".
    if (effectiveTeacherLabel) seedMeta.teacherLabel = effectiveTeacherLabel;
  }
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
    sessionDate: effectiveSessionDate,
    wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    isSessionHost,
    hasEndAllAuthority,
    isCoHost,
    isHostTeam,
    isProgramTeacher,
    audioProfile,
    avatarUrl: caller?.avatarUrl ?? null,
    teacherLabel: effectiveTeacherLabel,
  });
}
