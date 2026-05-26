/**
 * POST /api/host/standing-assignments/end-bundle
 *
 * Ends every standing rotation record in a (programSlug, dayOfWeek) bundle.
 * Three flavors via body:
 *
 *   { endsOn: "YYYY-MM-DD" }
 *     Sets endsOn to the specified date on every record in the bundle.
 *     Deletes any HostAssignment rows for this bundle with sessionDate
 *     AFTER that date (pre-generated sessions beyond the new end). No email
 *     is sent — this is a coordinator planning action, not an emergency.
 *     Sessions up to and including the end date stay untouched.
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
 *     releaseFuture?: boolean,
 *     endsOn?:        string }   -- YYYY-MM-DD; takes precedence over releaseFuture
 *
 * Access: HOST_MANAGER / ADMIN / hub coordinator.
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
  const programSlug   = body?.programSlug as string | undefined;
  const dayOfWeek     = body?.dayOfWeek   as string | undefined;
  const bodyHubSlug   = body?.hubSlug     as string | undefined;
  const endsOnParam   = body?.endsOn      as string | undefined;  // YYYY-MM-DD, takes precedence
  const releaseFuture = !endsOnParam && body?.releaseFuture === true;

  if (!programSlug || !dayOfWeek) {
    return Response.json({ error: "programSlug and dayOfWeek are required" }, { status: 400 });
  }

  // Hub-route. Body wins (session 129 — AV/greeter Rotations UI passes
  // its hub); fall back to the program's primary hub for legacy callers.
  const programHubSlug = await getProgramHubSlug(programSlug);
  const targetHubSlug = bodyHubSlug || programHubSlug;
  if (!isManager(roles) && !(await isHubCoordinator(session.user.id, targetHubSlug))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await hasEffectiveHostAccess(session.user.id, roles, targetHubSlug))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate the specific end date if provided
  if (endsOnParam) {
    const parsed = new Date(endsOnParam + "T12:00:00Z");
    if (isNaN(parsed.getTime())) {
      return Response.json({ error: "endsOn must be a valid YYYY-MM-DD date" }, { status: 400 });
    }
    const todayCt = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
    todayCt.setHours(0, 0, 0, 0);
    if (parsed < todayCt) {
      return Response.json({ error: "endsOn must be today or a future date" }, { status: 400 });
    }
  }

  // Load all rotation records in this bundle, scoped to the target hub.
  // Bundle key after session 129 is (programSlug, dayOfWeek, hubSlug) —
  // so end-bundle on host-team doesn't accidentally terminate an AV
  // rotation on the same program/day.
  const rotations = await db.standingAssignment.findMany({
    where: { programSlug, dayOfWeek, hubSlug: targetHubSlug },
    select: { id: true, userId: true },
  });

  if (rotations.length === 0) {
    return Response.json({ ended: 0, released: 0 });
  }

  const rotationIds = rotations.map((r) => r.id);

  // CT-anchored "today" — start-of-day for the future-assignment cutoff
  // (anything on or after today CT can be released). Past stays untouched.
  const todayCt = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  todayCt.setHours(0, 0, 0, 0);

  // For the rotation's endsOn we want "today is the last active day."
  // Setting endsOn to today's start-of-day-CT (which is 6am UTC) compared
  // against `dateStr + T12:00:00` (UTC noon) makes today read as "past" —
  // the rotation would skip TODAY's session if there were one. To make
  // "ending today" mean "today is the last day," anchor endsOn at the
  // end of today's calendar day, in UTC, mirroring the form's parsing.
  const todayStr = todayCt.toLocaleDateString("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");
  const endsOnValue = new Date(todayStr + "T23:59:59Z");

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

  // Single transaction: delete out-of-range assignments + set endsOn
  await db.$transaction(async (tx) => {
    if (endsOnParam) {
      // Set-end-date mode: delete pre-generated sessions AFTER the new end date.
      // Sessions up to the end date stay. No email sent.
      const cutoff = new Date(endsOnParam + "T23:59:59Z");
      await tx.hostAssignment.deleteMany({
        where: {
          standingAssignmentId: { in: rotationIds },
          sessionDate:          { gt: cutoff },
        },
      });
      await tx.standingAssignment.updateMany({
        where: { id: { in: rotationIds } },
        data:  { endsOn: new Date(endsOnParam + "T23:59:59Z") },
      });
    } else {
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
        data:  { endsOn: endsOnValue },
      });
    }
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
          hubSlug:   targetHubSlug,
        });
      }
    });
  }

  return Response.json({
    ended:    rotations.length,
    released: releasedCount,
    mode:     endsOnParam ? "set-end-date" : releaseFuture ? "release" : "end",
  });
}
