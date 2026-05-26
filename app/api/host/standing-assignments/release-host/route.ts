/**
 * POST /api/host/standing-assignments/release-host
 *
 * Removes one person from a (programSlug, dayOfWeek) rotation bundle in a
 * single hub. Deletes:
 *   - the user's StandingAssignment row(s) in the bundle (one per occurrence
 *     they held: FIRST / SECOND / ALL / etc.); and
 *   - every future HostAssignment row that pointed at one of those deleted
 *     rules and was held by this user.
 *
 * Other people in the same bundle (e.g. an alternate-pattern co-host) keep
 * their StandingAssignment rows AND their future HostAssignments. The rotation
 * stays active for them.
 *
 * Session 130 behavior change: previously this only deleted HostAssignment
 * rows and left the StandingAssignment row intact, so the next apply-cron run
 * (8 AM UTC daily) would re-create the HostAssignments from the still-active
 * rule — the "release" silently undid itself. Maria's beta test surfaced this
 * because the email said the rotation had ended but the cron kept her on it.
 *
 * Coordinators who want "I can't make THIS date but stay in the rotation"
 * should use the per-session sub-request affordance on the Schedule tab,
 * not this route. That preserves the rotation rule and only frees the one
 * date for someone else to cover.
 *
 * Body:
 *   { programSlug: string, dayOfWeek: string, userId: string, hubSlug?: string }
 *
 * Returns: { released: number, removedRules: number }
 *
 * Access: HOST_MANAGER / ADMIN / hub coordinator (same as end-bundle).
 */

import { after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import { isHubCoordinator } from "@/lib/hubAuth";
import { getProgramHubSlug } from "@/lib/programHub";
import { sendStandingAssignmentReleasedEmail } from "@/lib/email";

const TZ = "America/Chicago";

function isManager(roles: string[]) {
  return roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
}

async function hasEffectiveHostAccess(
  userId: string,
  roles: string[],
  hubSlug: string,
): Promise<boolean> {
  if (roles.includes("ADMIN")) return true;
  const tentative = roles.includes("HOST") || roles.includes("HOST_MANAGER");
  return getEffectiveHostingCapability(userId, hubSlug, tentative);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const roles = session.user.roles ?? [];

  const body = await request.json().catch(() => ({}));
  const programSlug = body?.programSlug as string | undefined;
  const dayOfWeek   = body?.dayOfWeek   as string | undefined;
  const userId      = body?.userId      as string | undefined;
  const bodyHubSlug = body?.hubSlug     as string | undefined;

  if (!programSlug || !dayOfWeek || !userId) {
    return Response.json(
      { error: "programSlug, dayOfWeek, and userId are required" },
      { status: 400 }
    );
  }

  // Hub-route. Body wins (session 129); fall back to the program's primary.
  const programHubSlug = await getProgramHubSlug(programSlug);
  const targetHubSlug = bodyHubSlug || programHubSlug;
  if (!isManager(roles) && !(await isHubCoordinator(session.user.id, targetHubSlug))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await hasEffectiveHostAccess(session.user.id, roles, targetHubSlug))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Find this user's StandingAssignment rows in the (program, day, hub)
  // bundle. Hub-scoped (session 129) so an AV release doesn't terminate
  // the host-team rotation on the same program/day. Person-scoped so an
  // alternate-pattern co-host stays on the rotation.
  const userRotations = await db.standingAssignment.findMany({
    where: { programSlug, dayOfWeek, hubSlug: targetHubSlug, userId },
    select: { id: true },
  });

  if (userRotations.length === 0) {
    return Response.json({ released: 0, removedRules: 0 });
  }

  const userRotationIds = userRotations.map((r) => r.id);

  // CT-anchored today — only future sessions are affected
  const todayCt = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  todayCt.setHours(0, 0, 0, 0);

  // Find the future assignments tied to THIS user's rules in the bundle.
  // We don't need to filter by userId here (the rule's userId IS this user
  // by query construction), but doing so is defense-in-depth against any
  // future code that lets the cron-applied row carry a different userId
  // than the source rule.
  const toRelease = await db.hostAssignment.findMany({
    where: {
      standingAssignmentId: { in: userRotationIds },
      userId,
      sessionDate: { gte: todayCt },
    },
    select: { id: true, programSlug: true, sessionDate: true },
  });

  const assignmentIds = toRelease.map((a) => a.id);

  // Build email payload before deleting
  const program = await db.program.findUnique({
    where: { slug: programSlug },
    select: { name: true },
  });
  const programName = program?.name ?? programSlug;

  const sessions = toRelease.map((a) => ({
    programName,
    dateLabel: a.sessionDate
      ? a.sessionDate.toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric", timeZone: TZ,
        })
      : "(no date)",
  }));

  // Atomic cleanup: drop the user's HostAssignments in the bundle AND the
  // StandingAssignment rules that backed them. Order matters — sub-requests
  // → assignments → rules — because of FK chains.
  await db.$transaction(async (tx) => {
    if (assignmentIds.length > 0) {
      // Cancel open sub requests on these assignments first (no FK cascade)
      await tx.subRequest.updateMany({
        where: { assignmentId: { in: assignmentIds }, status: "OPEN" },
        data:  { status: "CANCELLED" },
      });
      await tx.hostAssignment.deleteMany({
        where: { id: { in: assignmentIds } },
      });
    }
    // Delete the user's rules in the bundle. Any past HostAssignments
    // remain in the historical record — `standingAssignmentId` FK is
    // SetNull on delete, so they lose the link but stay.
    await tx.standingAssignment.deleteMany({
      where: { id: { in: userRotationIds } },
    });
  });

  // Email the released host. By here at least one of (rule removed,
  // assignment released) is true — the early return above caught the
  // "no rule" case. Session 130: send even when sessions is empty (rule
  // existed but cron hadn't applied yet) so the user isn't silently
  // dropped. The email builder renders a no-list variant in that case.
  const host = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, preferredName: true, email: true },
  });

  if (host) {
    after(async () => {
      await sendStandingAssignmentReleasedEmail({
        to:          host.email,
        firstName:   host.preferredName || host.firstName || null,
        programName,
        sessions,
        hubSlug:     targetHubSlug,
      });
    });
  }

  return Response.json({
    released:     toRelease.length,
    removedRules: userRotations.length,
  });
}
