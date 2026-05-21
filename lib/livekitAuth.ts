/**
 * Session-room permission tiers (Zoom-style, evolved 2026-05-25).
 *
 * Three capability tiers govern what a user can do inside a LiveKit session:
 *
 *   Session Host (singular)
 *     The HostAssignment for this exact session, OR ADMIN as safety override.
 *     Can End-for-All, Share Screen, and everything Co-host can do.
 *     Renders as the "Host" pill on their tile.
 *
 *   Co-host (multiple)
 *     Any active host-team HubMember with hostingCapability, OR HOST_MANAGER,
 *     OR ProgramTeacher for this program, OR Session Host. ADMIN bypass.
 *     Can mute others, Mute All, Share Screen, toggle Bell mode, manage
 *     participants. Cannot End-for-All. Renders as the "Co-host" pill
 *     unless they're also Host or Teacher (whichever takes pill priority).
 *
 *   Participant
 *     Everyone else, including guests. Self-mute, video, chat, reactions
 *     only. No badge.
 *
 * `isSessionHost` always implies `isCoHost`.
 *
 * Teacher is an orthogonal identity, not a capability tier — anyone with a
 * `ProgramTeacher` row for this program is "Teacher" (renders the Teacher
 * pill) and gets the bell-friendly audio profile. A Teacher who is also
 * Session Host shows both Host + Teacher pills.
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

export interface SessionRole {
  isSessionHost: boolean;
  isCoHost: boolean;
  /** True if user is on the host team for the host-team hub (used for Step-In UI). */
  isHostTeam: boolean;
  /** Whether the user is the teacher for this program (drives audio profile + Teacher pill). */
  isProgramTeacher: boolean;
}

export async function resolveSessionRole(
  userId: string,
  programSlug: string,
  sessionDate: string | undefined,
  roles: string[],
): Promise<SessionRole> {
  const isAdmin = roles.includes("ADMIN");
  const isManager = roles.includes("HOST_MANAGER");

  // ── Session Host: HostAssignment match for this exact session, OR ADMIN.
  let isSessionHost = isAdmin;
  if (!isSessionHost) {
    const assignment = await db.hostAssignment.findFirst({
      where: {
        programSlug,
        userId,
        ...(sessionDate ? { sessionDate: new Date(sessionDate) } : {}),
      },
      select: { id: true },
    });
    if (assignment) isSessionHost = true;
  }

  // ── ProgramTeacher: needed both for audio-profile selection and the
  // Teacher pill.
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
    : await getEffectiveHostingCapability(userId, "host-team", tentativeRoleGrant);
  const isCoHost = isAdmin || isSessionHost || hubCheckedCoHost;

  // ── Host team membership: drives the "Step In as Host" affordance.
  // Same hub gate, narrower fallback — visiting teachers don't see
  // Step-In (they teach in the room; they don't run it). HOST_MANAGER
  // does, as a fallback for managers not yet hub-synced.
  const isHostTeam = isAdmin
    ? true
    : await getEffectiveHostingCapability(userId, "host-team", isManager);

  return { isSessionHost, isCoHost, isHostTeam, isProgramTeacher };
}
