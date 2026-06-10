import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createRoomToken, roomNameForProgram } from "@/lib/livekit";
import { ensureActiveHubMembership, getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import { DEFAULT_HOSTING_HUB_SLUG, resolveTeacherPillLabel } from "@/lib/programHub";
import { assertSessionDateInWindow } from "@/lib/sessionWindow";

/**
 * POST /api/livekit/step-in
 *
 * Emergency host takeover: a host-team member (HOST, HOST_MANAGER, ADMIN)
 * claims host controls for a session that has no host present.
 *
 * - Creates/updates HostAssignment for this session
 * - Returns a new token with roomAdmin: true
 * - The client reconnects with the new token
 *
 * The capability gate is routed by the program's hosting hub
 * (`Program.hostingHubSlug ?? "host-team"`), so a peer-leader in the Silent
 * Meditation Hub can Step-In on a peer-led silent sit and a host-team
 * volunteer cannot. ADMIN bypasses.
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

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  // Step-In writes a HostAssignment row, so the integrity of the supplied
  // sessionDate matters more here than for mute/end. Refuse if the date
  // doesn't line up with the current open window. ADMIN/GT bypass for
  // out-of-window emergency room recovery.
  const assertion = await assertSessionDateInWindow(programSlug, sessionDate, roles);
  if (!assertion.ok) {
    return NextResponse.json(
      { error: assertion.error, message: assertion.message },
      { status: assertion.status },
    );
  }
  const effectiveSessionDate = assertion.window.sessionDate;

  const program = await db.program.findFirst({
    where: { slug: programSlug },
    select: {
      id: true,
      slug: true,
      name: true,
      teacherLabel: true,
      hostingHubSlug: true,
    },
  });
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  // Resolve the program's hosting hub. The capability gate, the hub-level
  // pill label fallback, and the hub-grants-teacher path all key off this.
  const resolvedHostingHubSlug = program.hostingHubSlug ?? DEFAULT_HOSTING_HUB_SLUG;
  const hostingHub = await db.hub.findUnique({
    where: { slug: resolvedHostingHubSlug },
    select: { assignmentGrantsTeacher: true, teacherLabel: true },
  });

  // Respect hub authority: an active HubMember record in the program's
  // hosting hub is required (with hostingCapability) to Step-In. The role
  // fallback covers HOST/HOST_MANAGER members not yet hub-synced. ADMIN
  // bypasses. The hub-specific gate means a peer-leader in
  // `peer-led-silent-meditation` can Step-In on peer-led silent sits but not
  // on `host-team` programs they have no business stepping into, and vice
  // versa for plain HOST role members.
  const tentativeHostTeam = isAdmin || roles.includes("HOST") || roles.includes("HOST_MANAGER");
  const canStepIn = isAdmin
    ? true
    : await getEffectiveHostingCapability(
        session.user.id,
        resolvedHostingHubSlug,
        tentativeHostTeam,
      );

  if (!canStepIn) {
    return NextResponse.json(
      { error: "Only host team members can step in" },
      { status: 403 },
    );
  }

  // Step-In writes the single host slot for the program's primary hosting hub.
  // The historical DB unique on (programSlug, sessionDate) was dropped in
  // session 129 so the multi-claim greeter hub can hold many rows per session
  // — which means a DB constraint can't enforce the single-slot "one host"
  // rule here. Without protection, two host-team volunteers tapping Step-In
  // in the same instant would both findFirst(none) → create, minting two hosts
  // for one session (Audit STEPIN-1). A transaction-scoped Postgres advisory
  // lock keyed on this exact session serializes concurrent Step-Ins, so the
  // find-then-update/create is atomic for a given (program, date, hub): the
  // second caller waits, then sees the first's row and updates it instead of
  // creating a duplicate. The lock releases on commit and never touches other
  // sessions or the greeter rows.
  const sessionDateObj = new Date(effectiveSessionDate);
  const lockKey = `stepin:${programSlug}:${effectiveSessionDate}:${resolvedHostingHubSlug}`;
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const existingAssignment = await tx.hostAssignment.findFirst({
      where: {
        programSlug,
        sessionDate: sessionDateObj,
        hubSlug: resolvedHostingHubSlug,
      },
      select: { id: true },
    });
    if (existingAssignment) {
      await tx.hostAssignment.update({
        where: { id: existingAssignment.id },
        data: {
          userId: session.user.id,
          notes: `Emergency step-in by ${session.user.name || session.user.id}`,
        },
      });
    } else {
      await tx.hostAssignment.create({
        data: {
          programSlug,
          hubSlug: resolvedHostingHubSlug,
          userId: session.user.id,
          sessionDate: sessionDateObj,
          notes: `Emergency step-in by ${session.user.name || session.user.id}`,
        },
      });
    }
  });

  // Covers ⇒ member (session 146): stepping in just wrote a HostAssignment, so
  // the stepper must be on this hub's roster too — otherwise they'd show as the
  // host but be absent from the member picker (the orphan symptom this slice
  // closes). Mirrors the self-claim auto-enroll; no-op for existing members. An
  // oversight role-holder (or ADMIN) stepping into a hub they aren't a member
  // of gets added here, so Step-In can't mint a "covers but not a member" row.
  await ensureActiveHubMembership(session.user.id, resolvedHostingHubSlug);

  // Generate a new token: stepping in upserts the HostAssignment, so this
  // user is now the Session Host (full grant: roomAdmin + screen share).
  //
  // Seed `host: true` in the token metadata so the Host badge renders on
  // their tile in every other client's view. Without this, the stepper-in
  // would appear to themselves as Session Host but to other participants
  // as just a regular member — the symptom Jesse saw in real-world use.
  // Mirrors the seedMeta pattern in /api/livekit/token.
  const roomName = roomNameForProgram(programSlug, effectiveSessionDate);
  const userName = session.user.name || "Host";

  // Stepping in makes the caller the Session Host. They may also be a
  // ProgramTeacher (already teaching this program before stepping in to
  // run the room), OR they may have become a teacher via the hub-grants-
  // teacher path (peer-leader in `peer-led-silent-meditation` stepping in
  // on a peer-led silent sit — the upsert above wrote the HostAssignment,
  // which combined with `assignmentGrantsTeacher: true` confers teacher
  // capability for the duration of this session). Preserve that signal if
  // either path applies. `cohost` is never set on a Step-In token because
  // the caller is now host. Reuses the `program` already fetched above.
  const teacher = await db.programTeacher.findFirst({
    where: { programId: program.id, userId: session.user.id },
    select: { id: true },
  });
  const isProgramTeacher =
    !!teacher ||
    (hostingHub?.assignmentGrantsTeacher ?? false);

  // Pill label hierarchy: program override > hub default > built-in "Teacher".
  const effectiveTeacherLabel = resolveTeacherPillLabel(
    program.teacherLabel,
    hostingHub?.teacherLabel ?? null,
  );

  const caller = await db.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true },
  });
  const seedMeta: {
    avatarUrl?: string;
    host?: boolean;
    teacher?: boolean;
    teacherLabel?: string;
  } = { host: true };
  if (isProgramTeacher) {
    seedMeta.teacher = true;
    if (effectiveTeacherLabel) seedMeta.teacherLabel = effectiveTeacherLabel;
  }
  if (caller?.avatarUrl) seedMeta.avatarUrl = caller.avatarUrl;
  const initialMeta = JSON.stringify(seedMeta);

  const token = await createRoomToken(
    session.user.id,
    userName,
    roomName,
    { roomAdmin: true, canShareScreen: true },
    initialMeta,
  );

  return NextResponse.json({
    token,
    roomName,
    wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    isSessionHost: true,
    // Stepping in writes the HostAssignment for the caller, so they hold
    // End-for-All authority by virtue of being the assigned host — no
    // role-based override needed. Returned for the client's button label.
    hasEndAllAuthority: true,
    isCoHost: true,
    isProgramTeacher,
    // Returned for parity with /api/livekit/token so the client can refresh
    // its local copy. Resolved through the same pill hierarchy (program >
    // hub > built-in default) so a peer-leader stepping in on a silent sit
    // gets the hub-level "Guide" label, not a stale "Teacher".
    teacherLabel: effectiveTeacherLabel,
  });
}
