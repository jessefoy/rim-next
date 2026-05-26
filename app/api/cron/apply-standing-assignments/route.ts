/**
 * GET /api/cron/apply-standing-assignments
 *
 * Runs daily at 8 AM UTC. Applies all active standing rotations to open
 * future sessions. Resolution mode is always 'leave' — the cron never
 * overrides existing assignments. Only humans do that, via the apply route
 * with explicit resolution.
 *
 * On the 1st of the month, also pre-fills next month so hosts know their
 * schedule in advance.
 */

import { after } from "next/server";
import {
  applyStandingAssignments,
  type ApplyResultSession,
} from "@/lib/applyStandingAssignments";
import { sendStandingAssignmentScheduledEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })
  );
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  const current = await applyStandingAssignments(null, year, month, "leave");

  // On the 1st, also pre-fill next month
  let nextFilled = 0;
  const nextByUser = new Map<string, ApplyResultSession[]>();

  if (now.getDate() === 1) {
    const nextMonth = month === 12 ? 1        : month + 1;
    const nextYear  = month === 12 ? year + 1 : year;
    const next = await applyStandingAssignments(null, nextYear, nextMonth, "leave");
    nextFilled = next.filled;
    for (const [uid, sessions] of next.byUser) {
      if (!nextByUser.has(uid)) nextByUser.set(uid, []);
      nextByUser.get(uid)!.push(...sessions);
    }
  }

  // Merge current + next-month sessions per user, then send one email per
  // person-and-hub. Splitting by hub matches the apply route's behavior
  // (session 129) so a multi-hub host gets one email per hub, each linked
  // to the right Scheduler view.
  const allByUser = new Map<string, ApplyResultSession[]>();
  for (const [uid, sessions] of [...current.byUser, ...nextByUser]) {
    if (!allByUser.has(uid)) allByUser.set(uid, []);
    allByUser.get(uid)!.push(...sessions);
  }

  function groupByHub(
    sessions: ApplyResultSession[],
  ): Map<string, ApplyResultSession[]> {
    const out = new Map<string, ApplyResultSession[]>();
    for (const s of sessions) {
      const key = s.hubSlug;
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(s);
    }
    return out;
  }
  function earliestMonth(sessions: ApplyResultSession[]): string | undefined {
    const earliest = sessions.map((s) => s.dateStr).filter(Boolean).sort()[0];
    return earliest ? earliest.slice(0, 7) : undefined;
  }

  after(async () => {
    for (const [, sessions] of allByUser) {
      if (sessions.length === 0) continue;
      for (const [perHubSlug, group] of groupByHub(sessions)) {
        const { userEmail, firstName } = group[0];
        await sendStandingAssignmentScheduledEmail({
          to: userEmail,
          firstName,
          sessions: group.map((s) => ({ programName: s.programName, dateLabel: s.dateLabel })),
          hubSlug: perHubSlug,
          firstSessionMonth: earliestMonth(group),
        });
      }
    }
  });

  return Response.json({
    currentMonth: { filled: current.filled },
    nextMonth:    { filled: nextFilled },
  });
}
