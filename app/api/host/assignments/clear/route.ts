/**
 * POST /api/host/assignments/clear
 *
 * Hub-scoped nuclear reset for the Scheduler. Hub coordinator OR ADMIN.
 *
 * Body:
 *   { hubSlug: string,
 *     scope:   "future" | "all",
 *     endRotations?: boolean }
 *
 * Modes (always scoped to one hub):
 *   { scope: "future" }                         "Clear upcoming schedule"
 *     Deletes HostAssignment rows in this hub where sessionDate >= today (CT).
 *     Past assignments preserved. Standing rotations remain — cron may re-fill.
 *
 *   { scope: "all", endRotations: true }        "Reset everything"
 *     Deletes every HostAssignment row in this hub (past + future) AND
 *     deletes every StandingAssignment in this hub. True fresh start for
 *     the hub. Other hubs' data is untouched.
 *
 *   { scope: "all" } / { scope: "future", endRotations: true } also valid
 *   for finer-grained scenarios.
 *
 * Session 129 audit fix: previously this was an ADMIN-only nuclear reset
 * that wiped data across ALL hubs in one call. After the auxiliary-hub
 * model, that was a sharp edge — clicking Reset from greeter's UI would
 * wipe host-team's data. Now the reset is per-hub, and a hub coordinator
 * can manage their own hub without needing ADMIN.
 *
 * Returns: { deletedAssignments: number, deletedRotations: number, scope: string }
 */

import { auth } from "@/auth";
import { after } from "next/server";
import { sendCoverageClearedEmails } from "@/lib/email";
import { db } from "@/lib/db";
import { canManageHubCoverage } from "@/lib/hubAuth";
import { ctStartOfToday } from "@/lib/timezone";


export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const roles = session.user.roles ?? [];

  const body = await request.json().catch(() => ({}));
  const hubSlug       = body?.hubSlug as string | undefined;
  const scope         = body?.scope as string | undefined;
  const endRotations  = body?.endRotations === true;

  if (!hubSlug) {
    return Response.json({ error: "hubSlug is required" }, { status: 400 });
  }
  if (scope !== "future" && scope !== "all") {
    return Response.json(
      { error: "scope must be 'future' or 'all'" },
      { status: 400 }
    );
  }

  // Gate: the one coverage-management rule (a scheduling manager, or this
  // team's active coordinator). It left out HOST_MANAGER, whom the button showed.
  if (!(await canManageHubCoverage(session.user.id, roles, hubSlug))) {
    return Response.json(
      { error: "Only this team's coordinator or an admin can do that." },
      { status: 403 },
    );
  }

  // One transaction (FK-safe: SubClaim → SubRequest → HostAssignment, then
  // rotations), and the people taken off upcoming sessions are told
  // (2026-10-16 audit: done in separate steps, and silently).
  const todayCt = ctStartOfToday(); // Central midnight, not UTC (2026-10-15)
  const { deletedAssignments, deletedRotations, upcoming } = await db.$transaction(async (tx) => {
    const rows = await tx.hostAssignment.findMany({
      where: { hubSlug, ...(scope === "future" ? { sessionDate: { gte: todayCt } } : {}) },
      select: { id: true, userId: true, hubSlug: true, programSlug: true, sessionDate: true },
    });
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      await tx.subClaim.deleteMany({ where: { request: { assignmentId: { in: ids } } } });
      await tx.subRequest.deleteMany({ where: { assignmentId: { in: ids } } });
      await tx.hostAssignment.deleteMany({ where: { id: { in: ids } } });
    }
    // Hard delete of the rules: a true fresh start for this team. Past
    // assignments kept above lose the rule link (SetNull) and stay as record.
    const rot = endRotations ? await tx.standingAssignment.deleteMany({ where: { hubSlug } }) : { count: 0 };
    return {
      deletedAssignments: ids.length,
      deletedRotations: rot.count,
      upcoming: rows.filter((r) => r.sessionDate && r.sessionDate >= todayCt),
    };
  });
  if (upcoming.length) {
    after(() =>
      sendCoverageClearedEmails({
        rows: upcoming,
        reason: (team) => `The ${team}'s upcoming schedule has been cleared.`,
        excludeUserId: session.user.id,
      }),
    );
  }

  return Response.json({ deletedAssignments, deletedRotations, scope, hubSlug });
}
