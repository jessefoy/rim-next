/**
 * POST /api/host/standing-assignments/apply
 *
 * Applies standing assignments for a given month, creating HostAssignment
 * records for every open future session that matches a standing pattern,
 * and (if requested) replacing manually-assigned future sessions.
 *
 * Past sessions are NEVER touched.
 *
 * Body:
 *   { programSlug?: string,
 *     standingId?:  string,    -- restrict to one rotation rule
 *     year?:        number,
 *     month?:       number,
 *     resolution?:  'leave' | 'replace-all' | { perDate: {[YYYY-MM-DD]: 'keep'|'replace'} } }
 *
 * Defaults: current month (CT), all programs, resolution='leave'.
 *
 * Access: HOST_MANAGER / ADMIN / hub coordinator.
 */

import { after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import {
  applyStandingAssignments,
  getApplyMonthRange,
  type ResolutionMode,
} from "@/lib/applyStandingAssignments";
import {
  sendStandingAssignmentScheduledEmail,
  sendStandingAssignmentReplacedEmail,
} from "@/lib/email";

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
    resolution  = "leave",
  } = body as {
    programSlug?: string | null;
    standingId?:  string | null;
    dayOfWeek?:   string | null;
    resolution?:  ResolutionMode;
  };

  // Light shape-validation on resolution
  if (
    resolution !== "leave" &&
    resolution !== "replace-all" &&
    !(typeof resolution === "object" && resolution !== null && "perDate" in resolution)
  ) {
    return Response.json({ error: "Invalid resolution mode" }, { status: 400 });
  }

  const now   = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const year  = body.year  ?? now.getFullYear();
  const month = body.month ?? now.getMonth() + 1;

  // Look up the rotation's endsOn so the apply spans the same horizon the
  // save did (current month → endsOn, or end-of-year if no end date).
  let bundleEndsOn: Date | null = null;
  if (programSlug && dayOfWeek) {
    const sample = await db.standingAssignment.findFirst({
      where: { programSlug, dayOfWeek },
      select: { endsOn: true },
    });
    bundleEndsOn = sample?.endsOn ?? null;
  }
  const months = getApplyMonthRange(year, month, bundleEndsOn);

  // Apply month-by-month with the user's chosen resolution
  let totalFilled   = 0;
  let totalReplaced = 0;
  let totalKept     = 0;
  type SessSum = { programName: string; dateLabel: string; userEmail: string; firstName: string | null };
  const byUser          = new Map<string, SessSum[]>();
  const byDisplacedUser = new Map<string, SessSum[]>();

  for (const { year: y, month: m } of months) {
    const r = await applyStandingAssignments(programSlug, y, m, resolution, standingId, dayOfWeek);
    totalFilled   += r.filled;
    totalReplaced += r.replaced;
    totalKept     += r.kept;
    for (const [uid, sessions] of r.byUser) {
      if (!byUser.has(uid)) byUser.set(uid, []);
      byUser.get(uid)!.push(...sessions);
    }
    for (const [uid, sessions] of r.byDisplacedUser) {
      if (!byDisplacedUser.has(uid)) byDisplacedUser.set(uid, []);
      byDisplacedUser.get(uid)!.push(...sessions);
    }
  }

  // ── Notification emails (fire-and-forget) ──────────────────────────────
  after(async () => {
    for (const [, sessions] of byUser) {
      if (sessions.length === 0) continue;
      const { userEmail, firstName } = sessions[0];
      await sendStandingAssignmentScheduledEmail({
        to: userEmail,
        firstName,
        sessions: sessions.map((s) => ({ programName: s.programName, dateLabel: s.dateLabel })),
      });
    }
    for (const [, sessions] of byDisplacedUser) {
      if (sessions.length === 0) continue;
      const { userEmail, firstName } = sessions[0];
      await sendStandingAssignmentReplacedEmail({
        to: userEmail,
        firstName,
        sessions: sessions.map((s) => ({ programName: s.programName, dateLabel: s.dateLabel })),
      });
    }
  });

  return Response.json({
    filled:   totalFilled,
    replaced: totalReplaced,
    kept:     totalKept,
  });
}
