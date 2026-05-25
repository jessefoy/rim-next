/**
 * POST /api/host/standing-assignments/release-host
 *
 * Releases one person's future HostAssignment rows within a (programSlug,
 * dayOfWeek) rotation bundle — without ending or touching the rotation rules.
 * The rotation stays active; the freed slots return to the unclaimed pool.
 *
 * Use case: a host can no longer cover their rotation dates. The coordinator
 * releases their upcoming sessions so the slots can be reassigned, then
 * optionally edits the rotation to replace them.
 *
 * Body:
 *   { programSlug: string, dayOfWeek: string, userId: string }
 *
 * Returns: { released: number }
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

  if (!programSlug || !dayOfWeek || !userId) {
    return Response.json(
      { error: "programSlug, dayOfWeek, and userId are required" },
      { status: 400 }
    );
  }

  // Hub-route by the program's hub. Slice 2.6.
  const programHubSlug = await getProgramHubSlug(programSlug);
  if (!isManager(roles) && !(await isHubCoordinator(session.user.id, programHubSlug))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await hasEffectiveHostAccess(session.user.id, roles, programHubSlug))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Find all StandingAssignment IDs in this (program, day) bundle
  const rotations = await db.standingAssignment.findMany({
    where: { programSlug, dayOfWeek },
    select: { id: true },
  });

  if (rotations.length === 0) {
    return Response.json({ released: 0 });
  }

  const rotationIds = rotations.map((r) => r.id);

  // CT-anchored today — only future sessions are affected
  const todayCt = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  todayCt.setHours(0, 0, 0, 0);

  // Find the future assignments for this specific host in this bundle
  const toRelease = await db.hostAssignment.findMany({
    where: {
      standingAssignmentId: { in: rotationIds },
      userId,
      sessionDate: { gte: todayCt },
    },
    select: { id: true, programSlug: true, sessionDate: true },
  });

  if (toRelease.length === 0) {
    return Response.json({ released: 0 });
  }

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

  // Cancel open sub requests on these assignments first (FK: no cascade)
  await db.subRequest.updateMany({
    where: { assignmentId: { in: assignmentIds }, status: "OPEN" },
    data:  { status: "CANCELLED" },
  });

  // Delete the assignments — slots return to the unclaimed pool
  await db.hostAssignment.deleteMany({
    where: { id: { in: assignmentIds } },
  });

  // Email the displaced host
  const host = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, preferredName: true, email: true },
  });

  if (host) {
    after(async () => {
      await sendStandingAssignmentReleasedEmail({
        to:        host.email,
        firstName: host.preferredName || host.firstName || null,
        sessions,
        hubSlug:   programHubSlug,
      });
    });
  }

  return Response.json({ released: toRelease.length });
}
