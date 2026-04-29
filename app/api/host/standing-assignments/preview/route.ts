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
import { previewStandingAssignments } from "@/lib/applyStandingAssignments";

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
  const {
    programSlug = null,
    standingId  = null,
    dayOfWeek   = null,
  } = body as {
    programSlug?: string | null;
    standingId?:  string | null;
    dayOfWeek?:   string | null;
  };

  const now   = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const year  = body.year  ?? now.getFullYear();
  const month = body.month ?? now.getMonth() + 1;

  const preview = await previewStandingAssignments(programSlug, year, month, standingId, dayOfWeek);

  // Strip down to wire shape — drop the heavy `candidates` array
  return Response.json({
    openSessions: preview.openSessions.map((c) => ({
      dateStr:      c.dateStr,
      dateLabel:    c.dateLabel,
      programSlug:  c.programSlug,
      programName:  c.programName,
      proposedHost: { userId: c.userId, displayName: c.firstName ?? c.userEmail },
    })),
    conflicts: preview.conflicts.map((c) => ({
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
    pastIgnored: preview.pastIgnored,
  });
}
