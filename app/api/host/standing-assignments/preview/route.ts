/**
 * POST /api/host/standing-assignments/preview
 *
 * Dry-run for the conflict-resolution modal. Returns what *would* happen if a
 * given rotation (or all rotations) were applied to a target month — without
 * touching the database.
 *
 * Body:
 *   { programSlug?: string,
 *     standingId?:  string,    -- restrict to one rotation rule
 *     year?:        number,
 *     month?:       number }
 *
 * Defaults: current month (CT), all programs, all rotations.
 *
 * Returns:
 *   { openSessions: [{ dateStr, dateLabel, programName, proposedHost }],
 *     conflicts:    [{ dateStr, dateLabel, programName, proposedHost, currentHost, source, protected }],
 *     pastIgnored:  number }
 *
 * Access: HOST_MANAGER / ADMIN / hub coordinator.
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import { isHubCoordinator } from "@/lib/hubAuth";
import { getProgramHubSlug } from "@/lib/programHub";
import { previewStandingAssignments, getApplyMonthRange } from "@/lib/applyStandingAssignments";

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
  const {
    programSlug = null,
    standingId  = null,
    dayOfWeek   = null,
    hubSlug     = null,
  } = body as {
    programSlug?: string | null;
    standingId?:  string | null;
    dayOfWeek?:   string | null;
    /** Optional hub scope (session 129). When set, narrows the preview to
     *  that hub's rotations. AV/greeter Rotations UI passes this so the
     *  conflict modal reflects the hub the coordinator is actually in. */
    hubSlug?:     string | null;
  };

  // Hub-route by body.hubSlug if supplied, else by program's primary hub
  // (when programSlug given), else manager-only ("preview all").
  const programHubSlug = programSlug ? await getProgramHubSlug(programSlug) : undefined;
  const authHubSlug = hubSlug || programHubSlug;
  if (authHubSlug) {
    if (!isManager(roles) && !(await isHubCoordinator(session.user.id, authHubSlug))) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!(await hasEffectiveHostAccess(session.user.id, roles, authHubSlug))) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    if (!isManager(roles)) {
      return Response.json(
        { error: "Forbidden — preview-all requires HOST_MANAGER or ADMIN" },
        { status: 403 },
      );
    }
  }

  const now   = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const year  = body.year  ?? now.getFullYear();
  const month = body.month ?? now.getMonth() + 1;

  // Span the same horizon the save+apply uses: through the bundle's endsOn,
  // or end-of-year if no end date. Hub-scoped (session 129).
  let bundleEndsOn: Date | null = null;
  if (programSlug && dayOfWeek) {
    const sample = await db.standingAssignment.findFirst({
      where: {
        programSlug,
        dayOfWeek,
        ...(authHubSlug ? { hubSlug: authHubSlug } : {}),
      },
      select: { endsOn: true },
    });
    bundleEndsOn = sample?.endsOn ?? null;
  }
  const months = getApplyMonthRange(year, month, bundleEndsOn);

  const previews = await Promise.all(
    months.map(({ year: y, month: m }) =>
      previewStandingAssignments(programSlug, y, m, standingId, dayOfWeek, hubSlug),
    )
  );
  const allOpens     = previews.flatMap((p) => p.openSessions);
  const allConflicts = previews.flatMap((p) => p.conflicts);
  const totalPast    = previews.reduce((s, p) => s + p.pastIgnored, 0);

  return Response.json({
    openSessions: allOpens.map((c) => ({
      dateStr:      c.dateStr,
      dateLabel:    c.dateLabel,
      programSlug:  c.programSlug,
      programName:  c.programName,
      proposedHost: { userId: c.userId, displayName: c.firstName ?? c.userEmail },
    })),
    conflicts: allConflicts.map((c) => ({
      dateStr:           c.dateStr,
      dateLabel:         c.dateLabel,
      programSlug:       c.programSlug,
      programName:       c.programName,
      proposedHost:      c.proposedHost,
      currentHost:       c.currentHost,
      source:            c.source,
      protected:         c.protected,
      hostAssignmentId:  c.hostAssignmentId,
    })),
    pastIgnored: totalPast,
  });
}
