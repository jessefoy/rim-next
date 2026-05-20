/**
 * Session-room permission tiers.
 *
 * Three tiers govern what a user can do inside a LiveKit session:
 *
 *   Session Host (singular)
 *     The HostAssignment for this exact session, OR ADMIN as safety override.
 *     Can End-for-All, Share Screen, and everything Co-host can do.
 *
 *   Co-host
 *     ProgramTeacher, HOST_MANAGER, or Session Host.
 *     Can mute others, Mute All, Share Screen, manage participants.
 *     Cannot End-for-All.
 *
 *   Participant
 *     Everyone else. Self-mute, video, chat, reactions only.
 *
 * `isSessionHost` always implies `isCoHost`.
 *
 * Hub authority gate: a host-team `HubMember` record (status, hostingCapability)
 * can revoke a tentative Co-host grant even when the system role is still
 * present. ADMIN bypasses the gate. See lib/hubMemberAuth.ts.
 */

import { db } from "@/lib/db";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";

export interface SessionRole {
  isSessionHost: boolean;
  isCoHost: boolean;
  /** True if user is on the host team for the host-team hub (used for Step-In UI). */
  isHostTeam: boolean;
  /** Whether the user is the teacher for this program (drives audio profile). */
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

  // ── ProgramTeacher: needed both for audio-profile selection and Co-host grant.
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

  // ── Co-host: tentative grant from any of the four paths, then hub-gated.
  const tentativeCoHost = isSessionHost || isManager || isProgramTeacher;
  const isCoHost = isAdmin
    ? true
    : await getEffectiveHostingCapability(userId, "host-team", tentativeCoHost);

  // ── Host team membership: drives the "Step In as Host" affordance.
  // Co-host implies host-team; only re-query the gate for plain HOST role.
  let isHostTeam: boolean;
  if (isAdmin || isCoHost) {
    isHostTeam = true;
  } else if (roles.includes("HOST")) {
    isHostTeam = await getEffectiveHostingCapability(userId, "host-team", true);
  } else {
    isHostTeam = false;
  }

  return { isSessionHost, isCoHost, isHostTeam, isProgramTeacher };
}
