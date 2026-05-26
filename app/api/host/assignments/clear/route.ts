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
import { db } from "@/lib/db";
import { isHubCoordinator } from "@/lib/hubAuth";

const TZ = "America/Chicago";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

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

  // Gate: hub coordinator of the target hub OR ADMIN. Hub coordinator
  // gate matches the rest of the standing-assignment routes; ADMIN
  // bypass preserves the operational-recovery path.
  if (!isAdmin && !(await isHubCoordinator(session.user.id, hubSlug))) {
    return Response.json(
      { error: "Forbidden — hub coordinator or ADMIN required" },
      { status: 403 },
    );
  }

  let deletedAssignments = 0;
  let deletedRotations   = 0;

  if (scope === "future") {
    // CT-anchored "today"
    const todayCt = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
    todayCt.setHours(0, 0, 0, 0);

    // SubRequests reference HostAssignment via FK without cascade — clean
    // them up first. Hub-scoped via the parent assignment's hubSlug so
    // an AV reset doesn't cancel host-team sub-requests.
    await db.subRequest.deleteMany({
      where: { assignment: { hubSlug, sessionDate: { gte: todayCt } } },
    });

    const result = await db.hostAssignment.deleteMany({
      where: { hubSlug, sessionDate: { gte: todayCt } },
    });
    deletedAssignments = result.count;
  } else {
    // Everything in this hub. Clear sub-request chain first.
    await db.subClaim.deleteMany({
      where: { request: { assignment: { hubSlug } } },
    });
    await db.subRequest.deleteMany({
      where: { assignment: { hubSlug } },
    });
    const result = await db.hostAssignment.deleteMany({
      where: { hubSlug },
    });
    deletedAssignments = result.count;
  }

  if (endRotations) {
    // Hard delete — true fresh start for this hub. The HostAssignment
    // cascade is SetNull on standingAssignmentId, so any past
    // assignments we kept lose the FK but stay as historical record.
    const rotResult = await db.standingAssignment.deleteMany({
      where: { hubSlug },
    });
    deletedRotations = rotResult.count;
  }

  return Response.json({ deletedAssignments, deletedRotations, scope, hubSlug });
}
