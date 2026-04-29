/**
 * POST /api/host/assignments/clear
 *
 * ADMIN-only nuclear reset for the host schedule. Two scopes:
 *
 *   { scope: "future" }
 *     Deletes all HostAssignment rows where sessionDate >= today (CT).
 *     Past assignments are preserved as historical record. Standing
 *     rotations are NOT ended — the next cron run will re-fill matching
 *     dates. Useful for "I want to redo this month's roster from scratch
 *     without losing history."
 *
 *   { scope: "all" }
 *     Deletes EVERY HostAssignment row, past and future. Use only when
 *     genuinely starting over (e.g. test / diagnostic reset).
 *
 * Standing rotations are not touched — to also stop new assignments from
 * being generated, end the rotations separately via /end-bundle.
 *
 * Returns: { deleted: number, scope: string }
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
  const scope = body?.scope as string | undefined;

  if (scope !== "future" && scope !== "all") {
    return Response.json(
      { error: "scope must be 'future' or 'all'" },
      { status: 400 }
    );
  }

  let deleted = 0;

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
    deleted = result.count;
  } else {
    // Everything. Also clear sub-request chain to avoid orphaned rows.
    await db.subClaim.deleteMany({});
    await db.subRequest.deleteMany({});
    const result = await db.hostAssignment.deleteMany({});
    deleted = result.count;
  }

  return Response.json({ deleted, scope });
}
