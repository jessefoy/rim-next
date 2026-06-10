import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { canAccessHub, effectiveCoordinator, getHubMembership, requireCoordinator } from "@/lib/hubAuth";

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

  if (willRevokeHosting && !force) {
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
    if (upcoming.length > 0) {
      return NextResponse.json(
        {
          requiresConfirmation: true,
          reason: "hosting_revoked_with_upcoming_assignments",
          upcomingAssignments: upcoming.map((a) => ({
            id: a.id,
            programSlug: a.programSlug,
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
  if (willRevokeHosting && force && releaseAssignments) {
    await db.hostAssignment.updateMany({
      where: { userId, hubSlug: hub.slug, sessionDate: { gte: new Date() } },
      data: { userId: null },
    });
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
  // assignments for someone no longer on the team. Silent, matching the
  // coordinator pause/release path; hard-remove is an ADMIN cleanup action.
  const now = new Date();
  const { removedAssignments, removedRules } = await db.$transaction(async (tx) => {
    const futureAssns = await tx.hostAssignment.findMany({
      where: { userId, hubSlug: slug, sessionDate: { gte: now } },
      select: { id: true },
    });
    const futureIds = futureAssns.map((a) => a.id);
    if (futureIds.length > 0) {
      await tx.subClaim.deleteMany({ where: { request: { assignmentId: { in: futureIds } } } });
      await tx.subRequest.deleteMany({ where: { assignmentId: { in: futureIds } } });
      await tx.hostAssignment.deleteMany({ where: { id: { in: futureIds } } });
    }
    const rules = await tx.standingAssignment.deleteMany({ where: { userId, hubSlug: slug } });
    await tx.hubMember.delete({ where: { hubId_userId: { hubId: hub.id, userId } } });
    return { removedAssignments: futureIds.length, removedRules: rules.count };
  });
  console.log(
    `[hub-member-remove] ${slug}: removed member ${userId} + ${removedAssignments} future assignment(s) + ${removedRules} rotation rule(s).`,
  );

  return NextResponse.json({ ok: true, removedAssignments, removedRules });
}
