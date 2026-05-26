/**
 * DELETE /api/host/standing-assignments/[id]
 *
 * Ends a standing rotation rule. Two flavors via body:
 *
 *   { releaseFuture: false }  (default)
 *     Sets endsOn = today on the rotation. Future cron runs skip it. Already-
 *     applied future HostAssignments stay in place — the host keeps the dates
 *     they were already scheduled for. Rotation record retained for history.
 *
 *   { releaseFuture: true }
 *     Same as above, PLUS deletes all future HostAssignments where
 *     standingAssignmentId = id AND sessionDate >= today. Those slots open back
 *     up for someone else to claim. Past assignments are NEVER touched. The
 *     displaced host receives a "rotation ended" email summarizing what was
 *     cleared.
 *
 * Access: HOST_MANAGER / ADMIN / hub coordinator.
 */

import { after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import { sendStandingAssignmentReleasedEmail } from "@/lib/email";
import { isHubCoordinator } from "@/lib/hubAuth";
import { getProgramHubSlug } from "@/lib/programHub";

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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const roles = session.user.roles ?? [];

  // Verify the rotation exists and look up its program's hub for auth routing
  const rotation = await db.standingAssignment.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, firstName: true, preferredName: true, email: true } },
    },
  });
  if (!rotation) return Response.json({ error: "Not found" }, { status: 404 });

  // Hub-route the auth check via the rotation's own hubSlug (session 129).
  // The standing record carries its hub directly now — no program lookup
  // needed for routing. The program-hub helper is kept as a fallback for
  // any legacy row whose hubSlug was somehow left at the default.
  const rotationHubSlug = rotation.hubSlug || await getProgramHubSlug(rotation.programSlug);
  if (!isManager(roles) && !(await isHubCoordinator(session.user.id, rotationHubSlug))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await hasEffectiveHostAccess(session.user.id, roles, rotationHubSlug))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const releaseFuture = body?.releaseFuture === true;

  // CT-anchored "today" — past stays untouched
  const todayCt = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  todayCt.setHours(0, 0, 0, 0);

  // Collect the future assignments we're about to clear (for the email summary)
  type ReleasedSession = {
    programName: string;
    dateLabel:   string;
  };
  let releasedSessions: ReleasedSession[] = [];
  let releasedCount = 0;

  if (releaseFuture) {
    const futureRows = await db.hostAssignment.findMany({
      where: {
        standingAssignmentId: id,
        sessionDate:          { gte: todayCt },
      },
      include: {
        // The program name has to come from Program (joined via programSlug — not a
        // direct relation, so do a separate lookup after).
      },
    });

    if (futureRows.length > 0) {
      const slugs = [...new Set(futureRows.map((r) => r.programSlug))];
      const programs = await db.program.findMany({
        where: { slug: { in: slugs } },
        select: { slug: true, name: true },
      });
      const nameBySlug = new Map(programs.map((p) => [p.slug, p.name]));

      releasedSessions = futureRows.map((r) => {
        const dateLabel = r.sessionDate
          ? r.sessionDate.toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric", timeZone: TZ,
            })
          : "(no date)";
        return {
          programName: nameBySlug.get(r.programSlug) ?? r.programSlug,
          dateLabel,
        };
      });
      releasedCount = futureRows.length;
    }

    // Cascade-clear in a transaction with the rotation end
    await db.$transaction(async (tx) => {
      await tx.hostAssignment.deleteMany({
        where: {
          standingAssignmentId: id,
          sessionDate:          { gte: todayCt },
        },
      });
      // End the rotation (don't fully delete — keep history of past assignments)
      await tx.standingAssignment.update({
        where: { id },
        data:  { endsOn: todayCt },
      });
    });

    // Email the displaced host
    if (releasedSessions.length > 0) {
      const u = rotation.user;
      after(async () => {
        await sendStandingAssignmentReleasedEmail({
          to:        u.email,
          firstName: u.preferredName || u.firstName || null,
          sessions:  releasedSessions,
          hubSlug:   rotationHubSlug,
        });
      });
    }
  } else {
    // Just end the rotation. Past + future assignments unaffected.
    await db.standingAssignment.update({
      where: { id },
      data:  { endsOn: todayCt },
    });
  }

  return Response.json({
    ended:    true,
    released: releasedCount,
  });
}
