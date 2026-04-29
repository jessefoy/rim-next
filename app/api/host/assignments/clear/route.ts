/**
 * POST /api/host/assignments/clear
 *
 * ADMIN-only nuclear reset for the host schedule.
 *
 * Body:
 *   { scope: "future" | "all",
 *     endRotations?: boolean }
 *
 * Modes:
 *   { scope: "future" }                         "Clear upcoming schedule"
 *     Deletes HostAssignment rows where sessionDate >= today (CT). Past
 *     assignments preserved. Standing rotations remain — cron may re-fill.
 *
 *   { scope: "all", endRotations: true }        "Reset everything"
 *     Deletes every HostAssignment row (past + future) AND deletes every
 *     StandingAssignment record. Truly fresh start. Use only when redoing
 *     the entire host system from scratch.
 *
 *   { scope: "all" } / { scope: "future", endRotations: true } also valid
 *   for finer-grained scenarios.
 *
 * Returns: { deletedAssignments: number, deletedRotations: number, scope: string }
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";

const TZ = "America/Chicago";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return Response.json({ error: "Forbidden — ADMIN only" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const scope         = body?.scope as string | undefined;
  const endRotations  = body?.endRotations === true;

  if (scope !== "future" && scope !== "all") {
    return Response.json(
      { error: "scope must be 'future' or 'all'" },
      { status: 400 }
    );
  }

  let deletedAssignments = 0;
  let deletedRotations   = 0;

  if (scope === "future") {
    // CT-anchored "today"
    const todayCt = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
    todayCt.setHours(0, 0, 0, 0);

    // SubRequests reference HostAssignment via FK without cascade — clean them
    // up first so the delete doesn't fail on referential integrity.
    await db.subRequest.deleteMany({
      where: { assignment: { sessionDate: { gte: todayCt } } },
    });

    const result = await db.hostAssignment.deleteMany({
      where: { sessionDate: { gte: todayCt } },
    });
    deletedAssignments = result.count;
  } else {
    // Everything. Clear sub-request chain to avoid orphaned rows.
    await db.subClaim.deleteMany({});
    await db.subRequest.deleteMany({});
    const result = await db.hostAssignment.deleteMany({});
    deletedAssignments = result.count;
  }

  if (endRotations) {
    // Hard delete — true fresh start. The HostAssignment cascade is SetNull
    // on standingAssignmentId, so any past assignments we kept lose the FK
    // but stay as historical record (manual-looking).
    const rotResult = await db.standingAssignment.deleteMany({});
    deletedRotations = rotResult.count;
  }

  return Response.json({ deletedAssignments, deletedRotations, scope });
}
