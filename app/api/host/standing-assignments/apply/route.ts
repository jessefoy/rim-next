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
import { isHubCoordinator } from "@/lib/hubAuth";
import { getProgramHubSlug } from "@/lib/programHub";
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
    resolution  = "leave",
  } = body as {
    programSlug?: string | null;
    standingId?:  string | null;
    dayOfWeek?:   string | null;
    /** Hub scope for the apply. Session 129 — when the Rotations UI sits
     *  in an auxiliary hub (AV, greeter), this is the rotation's hub.
     *  Body wins; otherwise we fall back to the program's primary hub. */
    hubSlug?:     string | null;
    resolution?:  ResolutionMode;
  };

  // Resolve the hub used for auth + email scoping.
  const programHubSlug = programSlug ? await getProgramHubSlug(programSlug) : undefined;
  const authHubSlug = hubSlug || programHubSlug;

  // Auth gate. When a hub or program is provided, route by that hub
  // (any hub's coordinator can apply their own rotations).
  // When neither is provided ("apply all"), require ADMIN or
  // HOST_MANAGER — that's a cross-hub global action.
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
        { error: "Forbidden — apply-all requires HOST_MANAGER or ADMIN" },
        { status: 403 },
      );
    }
  }

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
  // Hub-scoped (session 129) so AV's rotation endsOn isn't read off
  // host-team's rotation for the same (programSlug, dayOfWeek).
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

  // Apply month-by-month with the user's chosen resolution
  let totalFilled   = 0;
  let totalReplaced = 0;
  let totalKept     = 0;
  type SessSum = { programName: string; dateLabel: string; userEmail: string; firstName: string | null; hubSlug: string };
  const byUser          = new Map<string, SessSum[]>();
  const byDisplacedUser = new Map<string, SessSum[]>();

  for (const { year: y, month: m } of months) {
    const r = await applyStandingAssignments(programSlug, y, m, resolution, standingId, dayOfWeek, hubSlug);
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
  // Emails are grouped per user-and-hub: a user with both a host-team and
  // an AV rotation gets two separate emails, each linking to the right
  // scheduler view. Session 129 — previously one email used the program's
  // primary hub for all sessions, which leaked AV/greeter scheduling under
  // a host-team link.
  function groupByHub(sessions: SessSum[]): Map<string, SessSum[]> {
    const out = new Map<string, SessSum[]>();
    for (const s of sessions) {
      const key = s.hubSlug;
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(s);
    }
    return out;
  }
  after(async () => {
    for (const [, sessions] of byUser) {
      if (sessions.length === 0) continue;
      for (const [perHubSlug, group] of groupByHub(sessions)) {
        const { userEmail, firstName } = group[0];
        await sendStandingAssignmentScheduledEmail({
          to: userEmail,
          firstName,
          sessions: group.map((s) => ({ programName: s.programName, dateLabel: s.dateLabel })),
          hubSlug: perHubSlug,
        });
      }
    }
    for (const [, sessions] of byDisplacedUser) {
      if (sessions.length === 0) continue;
      for (const [perHubSlug, group] of groupByHub(sessions)) {
        const { userEmail, firstName } = group[0];
        await sendStandingAssignmentReplacedEmail({
          to: userEmail,
          firstName,
          sessions: group.map((s) => ({ programName: s.programName, dateLabel: s.dateLabel })),
          hubSlug: perHubSlug,
        });
      }
    }
  });

  return Response.json({
    filled:   totalFilled,
    replaced: totalReplaced,
    kept:     totalKept,
  });
}
