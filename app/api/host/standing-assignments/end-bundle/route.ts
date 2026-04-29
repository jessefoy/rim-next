/**
 * POST /api/host/standing-assignments/end-bundle
 *
 * Ends every standing rotation record in a (programSlug, dayOfWeek) bundle.
 * Two flavors via body:
 *
 *   { releaseFuture: false }  (default)
 *     Sets endsOn = today on every record in the bundle. Future cron runs
 *     skip them. Already-applied future HostAssignments stay in place — the
 *     hosts keep the dates already on their schedule.
 *
 *   { releaseFuture: true }
 *     Same as above, PLUS deletes all future HostAssignments derived from any
 *     of the bundle's records (where sessionDate >= today). Each displaced
 *     host receives a "rotation ended" email summarizing their cleared dates.
 *
 * Past sessions are NEVER touched.
 *
 * Body:
 *   { programSlug:   string,
 *     dayOfWeek:     string,
 *     releaseFuture: boolean }
 *
 * Access: HOST_MANAGER / ADMIN / hub coordinator.
 */

import { after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import { sendStandingAssignmentReleasedEmail } from "@/lib/email";

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

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const roles = session.user.roles ?? [];

  if (!isManager(roles) && !(await isCoordinator(session.user.id))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await hasEffectiveHostAccess(session.user.id, roles))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const programSlug   = body?.programSlug as string | undefined;
  const dayOfWeek     = body?.dayOfWeek   as string | undefined;
  const releaseFuture = body?.releaseFuture === true;

  if (!programSlug || !dayOfWeek) {
    return Response.json({ error: "programSlug and dayOfWeek are required" }, { status: 400 });
  }

  // Load all rotation records in this bundle
  const rotations = await db.standingAssignment.findMany({
    where: { programSlug, dayOfWeek },
    select: { id: true, userId: true },
  });

  if (rotations.length === 0) {
    return Response.json({ ended: 0, released: 0 });
  }

  const rotationIds = rotations.map((r) => r.id);

  // CT-anchored "today" — past stays untouched
  const todayCt = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  todayCt.setHours(0, 0, 0, 0);

  // Build per-displaced-user email lists if releasing
  type ReleasedSession = { programName: string; dateLabel: string };
  type ByUser = Map<string, ReleasedSession[]>;
  const byUser: ByUser = new Map();
  let releasedCount = 0;

  if (releaseFuture) {
    const futureRows = await db.hostAssignment.findMany({
      where: {
        standingAssignmentId: { in: rotationIds },
        sessionDate:          { gte: todayCt },
      },
      select: {
        id: true, programSlug: true, sessionDate: true, userId: true,
      },
    });

    if (futureRows.length > 0) {
      const slugs = [...new Set(futureRows.map((r) => r.programSlug))];
      const programs = await db.program.findMany({
        where: { slug: { in: slugs } },
        select: { slug: true, name: true },
      });
      const nameBySlug = new Map(programs.map((p) => [p.slug, p.name]));

      for (const r of futureRows) {
        if (!r.userId) continue;
        const dateLabel = r.sessionDate
          ? r.sessionDate.toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric", timeZone: TZ,
            })
          : "(no date)";
        if (!byUser.has(r.userId)) byUser.set(r.userId, []);
        byUser.get(r.userId)!.push({
          programName: nameBySlug.get(r.programSlug) ?? r.programSlug,
          dateLabel,
        });
      }
      releasedCount = futureRows.length;
    }
  }

  // Single transaction: delete future assignments (if releasing) + end rotations
  await db.$transaction(async (tx) => {
    if (releaseFuture && releasedCount > 0) {
      await tx.hostAssignment.deleteMany({
        where: {
          standingAssignmentId: { in: rotationIds },
          sessionDate:          { gte: todayCt },
        },
      });
    }
    await tx.standingAssignment.updateMany({
      where: { id: { in: rotationIds } },
      data:  { endsOn: todayCt },
    });
  });

  // Email each displaced host
  if (releaseFuture && byUser.size > 0) {
    const userIds = [...byUser.keys()];
    const users = await db.user.findMany({
      where:  { id: { in: userIds } },
      select: { id: true, firstName: true, preferredName: true, email: true },
    });
    after(async () => {
      for (const u of users) {
        const sessions = byUser.get(u.id);
        if (!sessions || sessions.length === 0) continue;
        await sendStandingAssignmentReleasedEmail({
          to:        u.email,
          firstName: u.preferredName || u.firstName || null,
          sessions,
        });
      }
    });
  }

  return Response.json({
    ended:    rotations.length,
    released: releasedCount,
  });
}
