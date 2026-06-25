/**
 * Session-role resolver — the shared host-identity authority for a session.
 *
 * NOTE (session 159): the in-browser LiveKit room is retired; sessions run on
 * Zoom. This resolver now feeds the Zoom entry (app/session/[slug]/enter): its
 * flags combine into `canHost`, which decides who is shown the Claim-Host
 * landing (host controls in Zoom) vs. sent straight into the meeting. The pill /
 * capability detail below is historical LiveKit context — retained because the
 * flags are still computed identically and may inform future Zoom-side features.
 * (Renamed lib/livekitAuth.ts → lib/sessionAuth.ts in the cutover.)
 *
 * Permission tiers (Zoom-style, evolved 2026-05-25 → 2026-05-26).
 *
 * The resolver splits **identity** from **capability** — the two used to be
 * conflated under a single `isSessionHost` flag with an ADMIN bypass, which
 * made every joining ADMIN show the "Host" pill even when no `HostAssignment`
 * existed for the session. Identity is now assignment-only; capability has
 * its own flag with the safety override.
 *
 * Three identity pills can render on a tile (at most two at once, because
 * `cohost` is mutually exclusive with the other two):
 *
 *   Host
 *     The `HostAssignment` for this exact session. Singular. The assigned
 *     steward of the room. No ADMIN bypass — identity is about who was
 *     actually assigned, not who has authority.
 *
 *   Teacher (orthogonal identity, layered on top)
 *     `ProgramTeacher` row for this program. Drives the bell-friendly
 *     audio profile (NS off, AGC off, 128 kbps) and the Teacher pill.
 *
 *   Host Volunteer (the renamed "Co-host" — same field, new label)
 *     Co-host capability AND not Host AND not Teacher. Catches host-team
 *     `HubMember` records (active + hostingCapability), HOST_MANAGER,
 *     ADMIN, GUIDING_TEACHER. Pill text is "Host Volunteer" in the UI.
 *
 * Capability is separate:
 *
 *   hasEndAllAuthority
 *     Can perform End-for-All. Held by:
 *       • the assigned Host (singular session steward), OR
 *       • ADMIN as safety override, OR
 *       • GUIDING_TEACHER as safety override, OR
 *       • the Teacher when no Host is assigned for this session
 *         (the "teacher teaching alone" fallback — Maria leading a course
 *         with no host present should be able to close the room without
 *         tapping Step-In first).
 *     The teacher-fallback is reactive at token-issue time only; a host
 *     assigned mid-session does not retroactively strip the teacher's
 *     authority on tokens already issued. Acceptable: the teacher still
 *     has the capability they expected when they joined.
 *
 *   isCoHost
 *     Mute others, Mute All, Share Screen, Bell mode, manage participants.
 *     Held by anyone with Host pill, Teacher pill, or Host Volunteer pill.
 *     ADMIN bypass.
 *
 * Hub authority. The host-team `HubMember` record is the authoritative
 * source for Co-host on plain HOST role members. `getEffectiveHostingCapability`
 * with `fallbackAllowed=false` returns true only when an active member record
 * exists with hostingCapability set. ADMIN bypasses. HOST_MANAGER and
 * ProgramTeacher fall back to their role grants if no member record exists
 * (visiting teachers, brand-new managers not yet hub-synced).
 */

import { db } from "@/lib/db";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import {
  DEFAULT_HOSTING_HUB_SLUG,
  getProgramHostingHub,
  type ProgramHostingHub,
} from "@/lib/programHub";

export interface SessionRole {
  /** Identity: HostAssignment for this exact session. No role-based bypass.
   *  Drives the "Host" pill on the participant's tile. */
  isSessionHost: boolean;
  /** Capability: End-for-All / host authority. With the move to Zoom this now
   *  feeds the entry's host-capable check (who is shown the Claim-Host landing
   *  vs. sent straight into the meeting). Distinct from `isSessionHost` so
   *  identity isn't overstated when a role-based safety override applies. */
  hasEndAllAuthority: boolean;
  /** Co-host capability: mute others, share screen, Bell mode, manage. */
  isCoHost: boolean;
  /** True if user is on the host team for the program's hosting hub (used for Step-In UI). */
  isHostTeam: boolean;
  /** Whether the user is the teacher for this program (drives audio profile + Teacher pill).
   *  Either: a `ProgramTeacher` row exists for the user on this program (the
   *  original path), OR the program's hosting hub has `assignmentGrantsTeacher: true`
   *  AND the user holds an active HostAssignment for this exact session (the
   *  Silent Meditation Hub path — peer leaders become "teachers" by virtue of
   *  signing up to lead a session in a teacher-granting hub). */
  isProgramTeacher: boolean;
  /** The program's resolved hosting hub. Returned so callers can compose the
   *  pill label hierarchy (`program.teacherLabel ?? hub.teacherLabel ?? null`)
   *  without re-fetching. Null only when the program doesn't exist. */
  programHub: ProgramHostingHub | null;
}

export async function resolveSessionRole(
  userId: string,
  programSlug: string,
  sessionDate: string | undefined,
  roles: string[],
  /**
   * Optional pre-fetched hub info. Token + step-in routes already query the
   * program for time-gate fields and metadata; they can include the hub join
   * in that fetch and pass the resolved record here to avoid a redundant
   * query. Other callers (mute, end-session, sub-request actions) let the
   * resolver fetch it.
   */
  programHubOverride?: ProgramHostingHub | null,
): Promise<SessionRole> {
  const isAdmin = roles.includes("ADMIN");
  const isGuidingTeacher = roles.includes("GUIDING_TEACHER");
  const isManager = roles.includes("HOST_MANAGER");

  // ── Resolve which hub hosts this program. Defaults to "host-team" when
  // Program.hostingHubSlug is null. Callers that already fetched the join
  // can pass it in to avoid a second query. The resolved record carries
  // `assignmentGrantsTeacher` and the hub-level pill label fallback.
  const programHub =
    programHubOverride !== undefined
      ? programHubOverride
      : await getProgramHostingHub(programSlug);
  const hostingHubSlug = programHub?.hubSlug ?? DEFAULT_HOSTING_HUB_SLUG;

  // ── Session Host (identity): HostAssignment match for this exact session.
  // No role-based bypass — identity is who was assigned, not who has authority.
  // Capability for ADMIN/GT is handled below via hasEndAllAuthority.
  const myAssignment = await db.hostAssignment.findFirst({
    where: {
      programSlug,
      userId,
      ...(sessionDate ? { sessionDate: new Date(sessionDate) } : {}),
    },
    select: { id: true },
  });
  const isSessionHost = !!myAssignment;

  // ── ProgramTeacher: needed both for audio-profile selection and the
  // Teacher pill. Resolves the program record once; reused below for the
  // "any host assigned" check.
  //
  // Two paths into the Teacher capability:
  //
  //   1. A `ProgramTeacher` row exists for this user on this program
  //      (the operational path: Jesse on Essential Dharma Study, Maria on
  //      Qigong, etc.). Same lookup as before.
  //
  //   2. The program's hosting hub has `assignmentGrantsTeacher: true` AND
  //      the user holds an active HostAssignment for this exact session
  //      (the Silent Meditation Hub path: peer leaders are not teachers
  //      in the public/editorial sense, but they take on teacher-room
  //      capability — bell-friendly audio, Teacher pill — for the session
  //      they're leading because the hub establishes that role).
  //
  // The two paths layer cleanly: if both apply, either alone would
  // produce the same effect — Teacher pill, teacher audio profile, End
  // fallback if no other host is assigned (which is moot when path 2
  // applies, since path 2 requires an assignment).
  const program = await db.program.findFirst({
    where: { slug: programSlug },
    select: { id: true },
  });
  let isProgramTeacher = false;
  if (program) {
    const teacher = await db.programTeacher.findFirst({
      where: { programId: program.id, userId },
      select: { id: true },
    });
    if (teacher) isProgramTeacher = true;
  }
  if (!isProgramTeacher && isSessionHost && programHub?.assignmentGrantsTeacher) {
    isProgramTeacher = true;
  }

  // ── Teacher-as-fallback-host: if no host is assigned for this session and
  // the caller is the teacher, they hold End-for-All as a structural
  // fallback. This covers the "Maria teaches alone" case and the
  // peer-led-but-someone-stepped-up case in community sits.
  //
  // We check for ANY assignment (any user) on this exact session — not just
  // the caller's own. If a host is already assigned and the caller is the
  // teacher, the host gets End authority; the teacher does not (they teach;
  // the host runs the room). If no one is assigned, the teacher fills the
  // gap automatically — no Step-In required.
  //
  // When `sessionDate` is omitted, the query matches any HostAssignment for
  // this program — including standing rotations (sessionDate: null) AND
  // specific-date rows. This is intentional: a standing rotation is "there
  // is a host," so the teacher fallback should not fire even if no one has
  // explicitly claimed *today's* instance yet.
  //
  // Teacher-fallback: a teacher leading alone (no assigned host for the
  // occurrence) is treated as host-capable, so they get the Claim-Host landing
  // without needing a Step-In first.
  let teacherIsFallbackHost = false;
  if (isProgramTeacher && !isSessionHost) {
    const anyHostAssigned = await db.hostAssignment.findFirst({
      where: {
        programSlug,
        ...(sessionDate ? { sessionDate: new Date(sessionDate) } : {}),
      },
      select: { id: true },
    });
    if (!anyHostAssigned) teacherIsFallbackHost = true;
  }

  // ── End-for-All authority: identity OR role-based safety override OR
  // teacher-fallback. Feeds the Zoom entry's host-capable gate (canHost).
  const hasEndAllAuthority =
    isSessionHost || isAdmin || isGuidingTeacher || teacherIsFallbackHost;

  // ── Co-host: anyone with capabilities. The hub authority gate is the
  // single source of truth — `getEffectiveHostingCapability` returns true
  // when a HubMember record exists AND is ACTIVE AND has hostingCapability;
  // returns the fallback when no record exists; returns false when the
  // record exists but is paused or revoked. That last case is what makes
  // hub-based suspension work: a coordinator can pause a HOST_MANAGER or
  // a visiting ProgramTeacher via the hub and they correctly lose Co-host
  // without losing their system role. ADMIN bypasses.
  //
  // The fallback here is `isManager || isProgramTeacher` — these role
  // grants are honored when no explicit hub record exists. Plain HOST
  // role does not need a fallback: HOST membership is supposed to come
  // with a HubMember record (created by `syncHubMembership`), so absence
  // of the record means absence of intent.
  const tentativeRoleGrant = isManager || isProgramTeacher;
  const hubCheckedCoHost = isAdmin
    ? true
    : await getEffectiveHostingCapability(userId, hostingHubSlug, tentativeRoleGrant);
  const isCoHost = isAdmin || isSessionHost || hubCheckedCoHost;

  // ── Host team membership: drives the "Step In as Host" affordance.
  // Same hub gate, narrower fallback — visiting teachers don't see
  // Step-In (they teach in the room; they don't run it). HOST_MANAGER
  // does, as a fallback for managers not yet hub-synced.
  //
  // Routed by program's hub: a peer-leader who is hosting-capable in
  // `peer-led-silent-meditation` but not in `host-team` correctly sees
  // Step-In on programs in their hub and does not see it on host-team
  // programs they have no business stepping into.
  const isHostTeam = isAdmin
    ? true
    : await getEffectiveHostingCapability(userId, hostingHubSlug, isManager);

  return {
    isSessionHost,
    hasEndAllAuthority,
    isCoHost,
    isHostTeam,
    isProgramTeacher,
    programHub,
  };
}
