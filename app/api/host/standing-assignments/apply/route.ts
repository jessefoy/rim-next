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

  // Coordinator apply spans the target month AND the next month. This is
  // critical because if a rotation is saved late in a month (e.g. April 29),
  // every remaining day of the current month may have already passed —
  // applying just current-month would produce zero fills and the coordinator
  // would think nothing happened. By spanning two months we always have
  // future dates to act on. The cron stays per-month-conservative because it
  // runs daily and self-corrects.
  const nextMonth = month === 12 ? 1        : month + 1;
  const nextYear  = month === 12 ? year + 1 : year;

  const r1 = await applyStandingAssignments(
    programSlug, year,     month,     resolution, standingId, dayOfWeek
  );
  const r2 = await applyStandingAssignments(
    programSlug, nextYear, nextMonth, resolution, standingId, dayOfWeek
  );

  // Merge byUser maps so each host receives ONE email summarizing both months
  type SessSum = { programName: string; dateLabel: string; userEmail: string; firstName: string | null };
  const merged = (a: Map<string, SessSum[]>, b: Map<string, SessSum[]>) => {
    const out = new Map<string, SessSum[]>(a);
    for (const [uid, sessions] of b) {
      if (!out.has(uid)) out.set(uid, []);
      out.get(uid)!.push(...sessions);
    }
    return out;
  };
  const byUser           = merged(r1.byUser,           r2.byUser);
  const byDisplacedUser  = merged(r1.byDisplacedUser,  r2.byDisplacedUser);

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
    filled:   r1.filled   + r2.filled,
    replaced: r1.replaced + r2.replaced,
    kept:     r1.kept     + r2.kept,
  });
}
