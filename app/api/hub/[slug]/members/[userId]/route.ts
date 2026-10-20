import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse, after } from "next/server";
import { canAccessHub, canManageHubCoverage, effectiveCoordinator, getHubMembership, requireCoordinator } from "@/lib/hubAuth";
import { releasePersonCoverage } from "@/lib/applyStandingAssignments";
import { deliverGapNotices, prepareGapNotices } from "@/lib/coverageNotices";
import { sendCoverageClearedEmails } from "@/lib/email";
import { removeHubMembershipWithCleanup } from "@/lib/removeHubMembership";

type HubMemberStatus = "ACTIVE" | "PAUSED" | "INACTIVE";

/**
 * PATCH /api/hub/[slug]/members/[userId]
 *
 * Update a hub member's coordinator-owned state. Coordinator or ADMIN only.
 *
 * Accepts any subset of:
 *   position, isCoordinator, status, hostingCapability, communicationsEnabled,
 *   pauseNote, coordinatorNote
 *
 * Destructive-action warning flow (only relevant for hubs where hub.hasSchedule):
 *   If the update would revoke hosting (status !== "ACTIVE" OR hostingCapability === false)
 *   AND the user has upcoming HostAssignments in the future, the API responds 409 with
 *   `{ requiresConfirmation: true, upcomingAssignments: [...] }`.
 *   The client resubmits with `{ force: true, releaseAssignments?: boolean }` to proceed.
 *   When releaseAssignments is true, the user's upcoming assignments have userId nulled
 *   (returning them to the unclaimed pool).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, userId } = await params;
  const roles = session.user.roles ?? [];
  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, roles);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessHub(member, session.user.roles ?? [])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isCoordinator = effectiveCoordinator(member, roles);
  try { requireCoordinator(isCoordinator, roles); }
  catch { return NextResponse.json({ error: "Coordinator required" }, { status: 403 }); }

  const existing = await db.hubMember.findUnique({
    where: { hubId_userId: { hubId: hub.id, userId } },
  });
  if (!existing) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const {
    position,
    isCoordinator: makeCoordinator,
    status,
    hostingCapability,
    communicationsEnabled,
    pauseNote,
    coordinatorNote,
    force,
    releaseAssignments,
  } = body as {
    position?: string | null;
    isCoordinator?: boolean;
    status?: HubMemberStatus;
    hostingCapability?: boolean;
    communicationsEnabled?: boolean;
    pauseNote?: string | null;
    coordinatorNote?: string | null;
    force?: boolean;
    releaseAssignments?: boolean;
  };
  // Releasing someone's sessions is coverage management: the one coverage
  // gate (an ACTIVE coordinator of this team, or a manager), not just the
  // Members tab's coordinator check (2026-10-16 audit).
  if (releaseAssignments && !(await canManageHubCoverage(session.user.id, roles, hub.slug))) {
    return NextResponse.json({ error: "Only this team's coordinator can open someone's sessions to the team." }, { status: 403 });
  }

  // Compute the effective next state for destructive-action detection.
  const nextStatus = (status !== undefined ? status : existing.status) as HubMemberStatus;
  const nextHostingCapability =
    hostingCapability !== undefined ? hostingCapability : existing.hostingCapability;

  // "Uses Scheduler" = has an enabled Scheduler HubAppLink. Authoritative
  // signal (session 129) for whether revoking hosting capability matters;
  // decoupled from `hub.hasSchedule` (which is now narrow — "show the
  // Host Hub home view"). AV and greeter members can still have upcoming
  // HostAssignments that warrant the destructive-action warning.
  const schedulerAppLink = await db.hubAppLink.findFirst({
    where: { hubId: hub.id, toolSlug: "schedule", isEnabled: true },
    select: { id: true },
  });
  const hubUsesScheduler = !!schedulerAppLink;

  const willRevokeHosting =
    hubUsesScheduler &&
    (existing.status === "ACTIVE" && existing.hostingCapability) &&
    !(nextStatus === "ACTIVE" && nextHostingCapability);

  // Inactive is off the team's schedule (Jesse, 2026-10-19): their sessions
  // open to the team and their rotations end, as a removal from the team
  // does, from Active or from Paused. Pausing keeps the choice to keep them.
  const goingInactive = hubUsesScheduler && nextStatus === "INACTIVE" && existing.status !== "INACTIVE";
  // Marking someone inactive opens their sessions and ends their rotations,
  // so it takes the one coverage gate whenever they hold either (and the
  // daily pass would release them anyway; 2026-10-19 review).
  if (goingInactive) {
    const [held, rotations] = await Promise.all([
      db.hostAssignment.count({ where: { userId, hubSlug: hub.slug, OR: [{ sessionDate: null }, { sessionDate: { gte: new Date() } }] } }),
      db.standingAssignment.count({ where: { userId, hubSlug: hub.slug } }),
    ]);
    if ((held > 0 || rotations > 0) && !(await canManageHubCoverage(session.user.id, roles, hub.slug))) {
      return NextResponse.json({ error: "Only this team's coordinator can open someone's sessions to the team." }, { status: 403 });
    }
  }

  if ((willRevokeHosting || goingInactive) && !force) {
    // Scope the destructive-action lookup to THIS hub (session 129).
    // A coordinator pausing an AV member's hosting capability should
    // see their AV assignments, not host-team assignments they have
    // no authority over.
    const upcoming = await db.hostAssignment.findMany({
      where: {
        userId,
        hubSlug: hub.slug,
        sessionDate: { gte: new Date() },
      },
      select: {
        id: true,
        programSlug: true,
        sessionDate: true,
      },
      orderBy: { sessionDate: "asc" },
      take: 50,
    });
    // The list in the confirmation names programs, not their slugs.
    const names = new Map(
      (await db.program.findMany({
        where: { slug: { in: [...new Set(upcoming.map((a) => a.programSlug))] } },
        select: { slug: true, name: true },
      })).map((p) => [p.slug, p.name]),
    );
    if (upcoming.length > 0) {
      return NextResponse.json(
        {
          requiresConfirmation: true,
          reason: "hosting_revoked_with_upcoming_assignments",
          // Inactive always opens their sessions; the dialog says so and
          // offers no "keep".
          inactive: goingInactive,
          upcomingAssignments: upcoming.map((a) => ({
            id: a.id,
            programSlug: a.programSlug,
            programName: names.get(a.programSlug) ?? a.programSlug,
            sessionDate: a.sessionDate?.toISOString() ?? null,
          })),
        },
        { status: 409 }
      );
    }
  }

  const data: Record<string, unknown> = {};
  if (position !== undefined) data.position = position || null;
  if (makeCoordinator !== undefined) data.isCoordinator = !!makeCoordinator;
  if (status !== undefined) {
    data.status = status;
    if (status === "PAUSED" || status === "INACTIVE") {
      if (existing.status === "ACTIVE") {
        data.pausedAt = new Date();
        data.pausedById = session.user.id;
      }
    } else if (status === "ACTIVE") {
      data.pausedAt = null;
      data.pausedById = null;
      data.pauseNote = null;
    }
  }
  if (hostingCapability !== undefined) data.hostingCapability = hostingCapability;
  if (communicationsEnabled !== undefined) data.communicationsEnabled = communicationsEnabled;
  if (pauseNote !== undefined) data.pauseNote = pauseNote || null;
  if (coordinatorNote !== undefined) data.coordinatorNote = coordinatorNote || null;

  const updated = await db.hubMember.update({
    where: { hubId_userId: { hubId: hub.id, userId } },
    data,
  });

  // Optional: release this user's upcoming host assignments back to the pool.
  // Hub-scoped (session 129) so an AV coordinator pausing an AV member
  // doesn't accidentally release that member's host-team assignments.
  // Their open cover requests close with the seat. On an open sign-up team
  // (greeter) the sign-up itself goes: an empty row there would show as a
  // blank name on the session (2026-10-15 audit). FK-safe order: SubClaim →
  // SubRequest → HostAssignment.
  let opened = 0;
  let rotationsEnded = 0;
  let teamTold = false;
  if (goingInactive || (willRevokeHosting && force && releaseAssignments)) {
    const released = await db.$transaction((tx) =>
      releasePersonCoverage(tx, userId, session.user.id, { hubSlug: hub.slug, endRotations: goingInactive, reason: goingInactive ? "inactive" : "paused" }),
    );
    opened = released.rows.length;
    rotationsEnded = released.rotations;
    // Tell them, unless they did it themselves.
    after(() =>
      sendCoverageClearedEmails({
        rows: released.rows,
        reason: goingInactive
          ? (team) => `You're now inactive on the ${team}, so your sessions are open to the team.`
          : (team) => `Your coordinator has taken you off the ${team}'s schedule for now, and your sessions are open to the team.`,
        excludeUserId: session.user.id,
      }),
    );
    // The team hears about any session within two weeks now left with no one.
    const gaps = await prepareGapNotices(released.rows, [session.user.id, userId]);
    teamTold = gaps.length > 0;
    if (gaps.length) after(() => deliverGapNotices(gaps));
  }

  return NextResponse.json({
    id: updated.id,
    userId: updated.userId,
    isCoordinator: updated.isCoordinator,
    position: updated.position,
    status: updated.status,
    hostingCapability: updated.hostingCapability,
    communicationsEnabled: updated.communicationsEnabled,
    pausedAt: updated.pausedAt?.toISOString() ?? null,
    pausedById: updated.pausedById,
    pauseNote: updated.pauseNote,
    coordinatorNote: updated.coordinatorNote,
    joinedAt: updated.joinedAt.toISOString(),
    // What opened, for the coordinator's confirmation.
    opened,
    rotationsEnded,
    teamTold,
  });
}

/**
 * DELETE /api/hub/[slug]/members/[userId]
 *
 * Hard-remove a member from a hub. ADMIN-only — coordinators must use
 * status = INACTIVE to restrict a member without losing their coordinator-
 * owned state (pause notes, capability flags). Hard delete is for cleanup
 * (wrong member added, member archived, etc.).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  if (!isAdmin) {
    return NextResponse.json(
      { error: "Only admins can hard-remove hub members. Set status to Inactive instead." },
      { status: 403 }
    );
  }

  const { slug, userId } = await params;
  const hub = await db.hub.findUnique({ where: { slug }, select: { id: true } });
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (userId === session.user.id) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  const target = await db.hubMember.findUnique({
    where: { hubId_userId: { hubId: hub.id, userId } },
  });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Remove the member AND clean up their coverage footprint in THIS hub in a
  // single transaction, so the assignment ledger can't outlive their roster
  // membership ("covers ⇒ member", session 146 — this was the most likely
  // cause of "shown as covering but absent from the picker"). Future only —
  // past sessions stay as historical record. FK-safe order: SubClaim →
  // SubRequest → HostAssignment (SubRequest.assignmentId is Restrict). Their
  // StandingAssignment rules go too, so the daily apply cron stops re-creating
  // assignments for someone no longer on the team. The person is told which
  // sessions went (2026-10-16 audit; it was silent).
  const { removedAssignments, removedRules, rows: removedRows } = await removeHubMembershipWithCleanup(
    hub.id,
    slug,
    userId,
    session.user.id,
  );
  // They're told which sessions went with the team (2026-10-16 audit).
  if (removedRows.length) {
    after(() =>
      sendCoverageClearedEmails({
        rows: removedRows,
        reason: (team) => `You're no longer on the ${team}.`,
        excludeUserId: session.user.id,
      }),
    );
    const gaps = await prepareGapNotices(removedRows, [session.user.id, userId]);
    if (gaps.length) after(() => deliverGapNotices(gaps));
  }
  console.log(
    `[hub-member-remove] ${slug}: removed member ${userId} + ${removedAssignments} future assignment(s) + ${removedRules} rotation rule(s).`,
  );

  return NextResponse.json({ ok: true, removedAssignments, removedRules });
}
