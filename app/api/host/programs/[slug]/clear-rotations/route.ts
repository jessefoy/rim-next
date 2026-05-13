/**
 * POST /api/host/programs/[slug]/clear-rotations
 *
 * Per-program rotation cleanup — two modes:
 *
 *   mode: "clear"
 *     Deletes all future HostAssignment rows for this program (sessionDate >= today).
 *     StandingAssignment rotation rules are untouched — they will re-fill on the
 *     next save or cron run. Use when redoing the schedule for one program while
 *     keeping the rotation patterns.
 *
 *   mode: "reset"
 *     Same as "clear" PLUS deletes all StandingAssignment records for this program.
 *     The rotation grid for this program becomes empty. Use when tearing down the
 *     rotation structure and starting fresh.
 *
 * Both modes preserve past HostAssignment records (sessionDate < today).
 * Affected hosts are NOT emailed (this is a coordinator-level bulk operation,
 * not a per-host release — email would be noisy and unexpected).
 *
 * Body: { mode: "clear" | "reset" }
 * Returns: { deletedAssignments: number, deletedRotations: number }
 *
 * Access: HOST_MANAGER / ADMIN / hub coordinator.
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";

const TZ = "America/Chicago";

function isManager(roles: string[]) {
  return roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
}

async function isCoordinator(userId: string): Promise<boolean> {
  const m = await db.hubMember.findFirst({
    where: { userId, hub: { slug: "host-team" }, isCoordinator: true },
  });
  return !!m;
}

async function hasEffectiveHostAccess(userId: string, roles: string[]): Promise<boolean> {
  if (roles.includes("ADMIN")) return true;
  const tentative = roles.includes("HOST") || roles.includes("HOST_MANAGER");
  return getEffectiveHostingCapability(userId, "host-team", tentative);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const roles = session.user.roles ?? [];

  if (!isManager(roles) && !(await isCoordinator(session.user.id))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await hasEffectiveHostAccess(session.user.id, roles))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug: programSlug } = await params;
  const body = await request.json().catch(() => ({}));
  const mode = body?.mode as string | undefined;

  if (mode !== "clear" && mode !== "reset") {
    return Response.json({ error: "mode must be 'clear' or 'reset'" }, { status: 400 });
  }

  // CT-anchored today cutoff — past sessions are never touched
  const todayCt = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  todayCt.setHours(0, 0, 0, 0);

  let deletedAssignments = 0;
  let deletedRotations   = 0;

  // SubRequest FK has no cascade — cancel open ones before deleting assignments
  await db.subRequest.updateMany({
    where: {
      assignment: { programSlug, sessionDate: { gte: todayCt } },
      status: "OPEN",
    },
    data: { status: "CANCELLED" },
  });

  const assignResult = await db.hostAssignment.deleteMany({
    where: { programSlug, sessionDate: { gte: todayCt } },
  });
  deletedAssignments = assignResult.count;

  if (mode === "reset") {
    const rotResult = await db.standingAssignment.deleteMany({
      where: { programSlug },
    });
    deletedRotations = rotResult.count;
  }

  return Response.json({ deletedAssignments, deletedRotations });
}
