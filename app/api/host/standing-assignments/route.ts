/**
 * GET  /api/host/standing-assignments?programSlug=...&userId=...
 *   Lists active standing rotations. Optional filters.
 *   Available to any authenticated host-team member (read-only).
 *
 * POST /api/host/standing-assignments
 *   Saves an entire rotation BUNDLE for one (programSlug, dayOfWeek) in a
 *   single atomic transaction. Body shape (pattern-based, matches the
 *   coordinator UX):
 *
 *     {
 *       programSlug: string,
 *       dayOfWeek:   "MO"|"TU"|"WE"|"TH"|"FR"|"SA"|"SU",
 *       pattern:     "same" | "alternate" | "pair" | "custom",
 *       hosts: {                       -- shape depends on pattern:
 *         every?:  string,             -- "same"
 *         oddWk?:  string, evenWk?: string,  -- "alternate" (1st&3rd, 2nd&4th)
 *         firstHalf?: string, secondHalf?: string,  -- "pair" (1st&2nd, 3rd&4th)
 *         first?: string, second?: string, third?: string, fourth?: string,
 *                                       -- "custom" (any subset filled)
 *       },
 *       fifthHost?:   string | null,  -- 5th-occurrence host (any pattern)
 *       endsOn?:      string | null   -- ISO date or null
 *     }
 *
 *   Backend translates this into 1–6 StandingAssignment records, atomically:
 *     - DELETEs any existing records in (programSlug, dayOfWeek) bundle that
 *       aren't in the new set
 *     - UPSERTs each record in the new set
 *
 *   Returns: { saved: [{id, occurrence, userId}, ...], dayOfWeek, programSlug }
 *
 *   Coordinator / HOST_MANAGER / ADMIN only.
 */

import { after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import { isHubCoordinator } from "@/lib/hubAuth";
import { getProgramHubSlug, DEFAULT_HOSTING_HUB_SLUG, getProgramSlugsForHub, getHubCoverageCopy } from "@/lib/programHub";
import { applyStandingAssignments, getApplyMonthRange } from "@/lib/applyStandingAssignments";
import {
  sendStandingAssignmentScheduledEmail,
  sendStandingAssignmentReplacedEmail,
} from "@/lib/email";
import type { StandingOccurrence } from "@prisma/client";

const TZ = "America/Chicago";

const VALID_DAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
type DayOfWeek = (typeof VALID_DAYS)[number];

/**
 * Parse a "YYYY-MM-DD" date input as the END of that calendar day, NOT
 * midnight UTC (which would land in the previous CT day).
 *
 * Apply-loop compares `new Date(dateStr + "T12:00:00") > endsOn`. Storing
 * endsOn at 23:59:59Z makes the user's picked day still active (noon-of-day
 * < 23:59:59-of-day) while next-day correctly evaluates as past
 * (next-day-noon > 23:59:59-of-prev-day). Works for any user timezone
 * because the comparison is between two UTC instants.
 *
 * Previously: `new Date("2026-12-31")` parsed as 2026-12-31T00:00:00Z =
 * Dec 30 18:00 CT. Rotation expired one day early in CT.
 */
function endOfCalendarDay(yyyyMmDd: string): Date {
  return new Date(yyyyMmDd + "T23:59:59Z");
}

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

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const roles = session.user.roles ?? [];

  const { searchParams } = new URL(request.url);
  const programSlug   = searchParams.get("programSlug");
  const userId        = searchParams.get("userId");
  // ?hub= scopes the query to one hub's programs and gates auth by that hub.
  // Defaults to host-team for backward compat with existing callers that
  // don't yet pass it. Slice 2.6.
  const hubSlug       = searchParams.get("hub") || DEFAULT_HOSTING_HUB_SLUG;
  // ?includeEnded=1 returns ended rotations too. Default: active only — ended
  // rotations would otherwise display in the grid as if active and let users
  // edit/save them with stale endsOn=today values.
  const includeEnded  = searchParams.get("includeEnded") === "1";

  // If a programSlug filter is given, the effective hub is THAT program's
  // hub (so a peer-led-silent-meditation coordinator can read rotations for
  // their hub's programs even without passing ?hub=). Otherwise use the
  // ?hub= param (or host-team default).
  const effectiveHubSlug = programSlug
    ? await getProgramHubSlug(programSlug)
    : hubSlug;

  if (!(await hasEffectiveHostAccess(session.user.id, roles, effectiveHubSlug))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();

  // StandingAssignment now carries its own `hubSlug` column (session 129),
  // so we filter directly on the record. When a coordinator narrows by
  // programSlug, the program's primary hub is the implicit filter for
  // host-team / peer-led cases; aux hubs (AV, greeter) get their own
  // rotation records and pass through naturally via hubSlug.
  const assignments = await db.standingAssignment.findMany({
    where: {
      hubSlug: effectiveHubSlug,
      ...(programSlug ? { programSlug } : {}),
      ...(userId      ? { userId      } : {}),
      ...(includeEnded
        ? {}
        : { OR: [{ endsOn: null }, { endsOn: { gte: now } }] }),
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
    },
    orderBy: [{ programSlug: "asc" }, { dayOfWeek: "asc" }, { occurrence: "asc" }],
  });

  return Response.json(
    assignments.map((a) => ({
      id:          a.id,
      programSlug: a.programSlug,
      dayOfWeek:   a.dayOfWeek,
      occurrence:  a.occurrence,
      userId:      a.userId,
      hostName:
        a.user.preferredName ||
        [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") ||
        null,
      startsOn: a.startsOn.toISOString(),
      endsOn:   a.endsOn?.toISOString() ?? null,
    }))
  );
}

// ── POST: pattern-based bundle save ──────────────────────────────────────────

interface BundleInput {
  programSlug: string;
  dayOfWeek:   DayOfWeek;
  /** Hub that owns this rotation (session 129). Omitted = program's
   *  primary hosting hub. AV / greeter hub callers must pass their own
   *  hub slug so the rotation lands on the right team. */
  hubSlug?:    string;
  pattern:     "same" | "alternate" | "custom";
  hosts: {
    every?:  string;
    oddWk?:  string;
    evenWk?: string;
    first?:  string;
    second?: string;
    third?:  string;
    fourth?: string;
  };
  fifthHost?: string | null;
  endsOn?:    string | null;
}

/**
 * Translates a pattern + hosts payload into the underlying record set.
 * Returns Map<occurrence, userId> — only filled cells.
 */
function patternToRecords(input: BundleInput): Map<StandingOccurrence, string> {
  const out = new Map<StandingOccurrence, string>();
  const h = input.hosts;

  switch (input.pattern) {
    case "same":
      // One ALL record. Apply-time specificity rule lets a FIFTH override it.
      if (h.every) out.set("ALL", h.every);
      break;

    case "alternate":
      if (h.oddWk) {
        out.set("FIRST", h.oddWk);
        out.set("THIRD", h.oddWk);
      }
      if (h.evenWk) {
        out.set("SECOND", h.evenWk);
        out.set("FOURTH", h.evenWk);
      }
      break;

    case "custom":
      if (h.first)  out.set("FIRST",  h.first);
      if (h.second) out.set("SECOND", h.second);
      if (h.third)  out.set("THIRD",  h.third);
      if (h.fourth) out.set("FOURTH", h.fourth);
      break;
  }

  if (input.fifthHost) out.set("FIFTH", input.fifthHost);
  return out;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const roles = session.user.roles ?? [];

  const body = await request.json().catch(() => null) as BundleInput | null;
  if (!body?.programSlug || !body?.dayOfWeek || !body?.pattern || !body?.hosts) {
    return Response.json(
      { error: "programSlug, dayOfWeek, pattern, and hosts are required" },
      { status: 400 }
    );
  }

  // Resolve the rotation's hub. Body wins when supplied (AV / greeter
  // hubs save into their own scope); otherwise fall back to the program's
  // primary hosting hub. Slice 2.6 (peer-led) routed by program; session
  // 129 generalises to allow any hub to own a rotation.
  const programHubSlug = await getProgramHubSlug(body.programSlug);
  const targetHubSlug = body.hubSlug || programHubSlug;
  if (!isManager(roles) && !(await isHubCoordinator(session.user.id, targetHubSlug))) {
    return Response.json({ error: "Forbidden — coordinator or manager required" }, { status: 403 });
  }
  if (!VALID_DAYS.includes(body.dayOfWeek)) {
    return Response.json({ error: `Invalid dayOfWeek: ${body.dayOfWeek}` }, { status: 400 });
  }
  if (!["same", "alternate", "custom"].includes(body.pattern)) {
    return Response.json({ error: `Invalid pattern: ${body.pattern}` }, { status: 400 });
  }

  const targets = patternToRecords(body);

  if (targets.size === 0) {
    return Response.json(
      { error: "Pattern requires at least one host. Pick a person before saving." },
      { status: 400 }
    );
  }

  // CRITICAL endsOn parsing: a date input like "2026-12-31" parsed via
  // `new Date(...)` becomes 2026-12-31T00:00:00Z = midnight UTC = 6pm
  // CST the previous evening. The rotation's endsOn would be effectively
  // Dec 30 in CT — one day early. Same problem when end-bundle writes
  // `today` and the user picks "Dec 31" — they expect "through Dec 31"
  // but get "through Dec 30".
  //
  // Fix: anchor endsOn at 23:59:59 in CT on the picked calendar day so
  // the apply-loop's `dateStr <= ctDateStr(endsOn)` comparison treats
  // the user's intended last day as still active.
  const endsOn = body.endsOn ? endOfCalendarDay(body.endsOn) : null;

  // Single transaction: delete any existing records in the bundle that aren't
  // in the new set, then upsert each target record. The bundle is now
  // scoped by hubSlug too (session 129) — an AV rotation and a host-team
  // rotation can coexist for the same program/day independently.
  // CT-anchored today for the future-assignment cutoff during cleanup below.
  const todayCtForCleanup = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  todayCtForCleanup.setHours(0, 0, 0, 0);

  // Captured inside the transaction; consumed after it to notify displaced
  // hosts. Map<userId, sessionDate[]>.
  const displacedByUser = new Map<string, Array<Date | null>>();
  let clearedCount = 0;

  const saved = await db.$transaction(async (tx) => {
    const existing = await tx.standingAssignment.findMany({
      where: {
        programSlug: body.programSlug,
        dayOfWeek: body.dayOfWeek,
        hubSlug: targetHubSlug,
      },
      select: { id: true, occurrence: true },
    });

    // Rules being removed = existing occurrences not present in the new set.
    const targetOccs = new Set(targets.keys());
    const removedRuleIds = existing
      .filter((ex) => !targetOccs.has(ex.occurrence))
      .map((ex) => ex.id);

    // Clean up the FUTURE HostAssignments those removed rules created.
    // Without this, removing a host/occurrence from the pattern left their
    // upcoming sessions on the calendar as orphans (standingAssignmentId is
    // SetNull on rule delete) — so "remove Nancy" silently didn't take
    // (session 140, coordinator bug #4). FK-safe order matches the other
    // destructive Scheduler routes: SubClaim → SubRequest → HostAssignment
    // → StandingAssignment.
    if (removedRuleIds.length > 0) {
      const futureRows = await tx.hostAssignment.findMany({
        where: {
          standingAssignmentId: { in: removedRuleIds },
          sessionDate: { gte: todayCtForCleanup },
        },
        select: { id: true, userId: true, sessionDate: true },
      });
      for (const r of futureRows) {
        if (!r.userId || !r.sessionDate) continue;
        if (!displacedByUser.has(r.userId)) displacedByUser.set(r.userId, []);
        displacedByUser.get(r.userId)!.push(r.sessionDate);
      }
      const futureIds = futureRows.map((r) => r.id);
      if (futureIds.length > 0) {
        await tx.subClaim.deleteMany({ where: { request: { assignmentId: { in: futureIds } } } });
        await tx.subRequest.deleteMany({ where: { assignmentId: { in: futureIds } } });
        await tx.hostAssignment.deleteMany({ where: { id: { in: futureIds } } });
        clearedCount = futureIds.length;
      }
      await tx.standingAssignment.deleteMany({ where: { id: { in: removedRuleIds } } });
    }

    // UPSERT each target record on the (programSlug, dayOfWeek,
    // occurrence, hubSlug) composite unique.
    const out: Array<{ id: string; occurrence: StandingOccurrence; userId: string }> = [];
    for (const [occurrence, userId] of targets.entries()) {
      const rec = await tx.standingAssignment.upsert({
        where: {
          programSlug_dayOfWeek_occurrence_hubSlug: {
            programSlug: body.programSlug,
            dayOfWeek:   body.dayOfWeek,
            occurrence,
            hubSlug:     targetHubSlug,
          },
        },
        create: {
          programSlug: body.programSlug,
          dayOfWeek:   body.dayOfWeek,
          hubSlug:     targetHubSlug,
          occurrence,
          userId,
          endsOn,
          createdById: session.user!.id,
        },
        update: {
          userId,
          endsOn,
          // Reset window when re-saving so the new assignment takes effect now
          startsOn: new Date(),
        },
      });
      out.push({ id: rec.id, occurrence: rec.occurrence, userId: rec.userId });
    }

    return out;
  });

  // ── Atomic auto-apply with `leave` mode across the full rotation horizon.
  //
  // Horizon = current month through `endsOn` (or end-of-current-year if
  // no end date). When a coordinator sets up "Alex on 1st Mondays through
  // Dec 31," they want all those Mondays filled now — not gradually as
  // the cron rolls forward month by month.
  //
  // 'leave' mode is non-destructive — only fills empty slots. If conflicts
  // exist, conflictCount comes back > 0 and the client opens the resolution
  // modal.
  const now   = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const months = getApplyMonthRange(year, month, endsOn);

  // Apply month-by-month. Each call is an independent transaction so a
  // failure mid-stream doesn't roll back earlier months. Idempotent —
  // re-running fills nothing new.
  const results: Awaited<ReturnType<typeof applyStandingAssignments>>[] = [];
  for (const { year: y, month: m } of months) {
    results.push(
      // Scope the apply to the target hub so saving a greeter rotation
      // doesn't re-fire host-team rules for the same (program, day). The
      // client now passes hubSlug (session 130 follow-up); this scopes
      // the side effects correctly. "leave" mode means no-op anyway when
      // slots are filled, but we'd still spurious-email users in other
      // hubs on the same program+day.
      await applyStandingAssignments(body.programSlug, y, m, "leave", null, body.dayOfWeek, targetHubSlug)
    );
  }

  // Aggregate filled count and merge byUser for one email per host
  let totalFilled = 0;
  type SessSum = { programName: string; dateLabel: string; userEmail: string; firstName: string | null; dateStr: string };
  const merged = new Map<string, SessSum[]>();
  for (const r of results) {
    totalFilled += r.filled;
    for (const [uid, sessions] of r.byUser) {
      if (!merged.has(uid)) merged.set(uid, []);
      merged.get(uid)!.push(...sessions);
    }
  }
  // Role-aware copy for the target hub (session 130 follow-up). Resolved
  // once; passed to every per-user email so the subject + body match the
  // hub's role ("scheduled to be covering AV" vs. "scheduled to be hosting").
  const coverageCopy = await getHubCoverageCopy(targetHubSlug);
  after(async () => {
    for (const [, sessions] of merged) {
      if (sessions.length === 0) continue;
      const { userEmail, firstName } = sessions[0];
      const earliest = sessions
        .map((s) => s.dateStr)
        .filter(Boolean)
        .sort()[0];
      const firstSessionMonth = earliest ? earliest.slice(0, 7) : undefined;
      await sendStandingAssignmentScheduledEmail({
        to: userEmail,
        firstName,
        sessions: sessions.map((s) => ({ programName: s.programName, dateLabel: s.dateLabel })),
        hubSlug: targetHubSlug,
        firstSessionMonth,
        coverageCopy,
      });
    }

    // Notify hosts removed by this pattern edit (session 140, Fix C). Their
    // upcoming sessions were cleared above; tell them which dates, with the
    // same "you're no longer scheduled" wording the conflict-replace path
    // uses, so a pattern-editor removal isn't silent.
    if (displacedByUser.size > 0) {
      const removedProgram = await db.program.findUnique({
        where: { slug: body.programSlug },
        select: { name: true },
      });
      const removedProgramName = removedProgram?.name ?? body.programSlug;
      const displacedUsers = await db.user.findMany({
        where: { id: { in: [...displacedByUser.keys()] } },
        select: { id: true, email: true, firstName: true, preferredName: true },
      });
      for (const u of displacedUsers) {
        const dates = displacedByUser.get(u.id) ?? [];
        if (dates.length === 0) continue;
        await sendStandingAssignmentReplacedEmail({
          to: u.email,
          firstName: u.preferredName || u.firstName || null,
          sessions: dates.map((d) => ({
            programName: removedProgramName,
            dateLabel: d
              ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: TZ })
              : "(no date)",
          })),
          hubSlug: targetHubSlug,
          coverageCopy,
        });
      }
    }
  });

  // Re-run preview AFTER apply to surface remaining conflicts. The leave-
  // apply just filled opens; what remains is conflicts that need a decision.
  const { previewStandingAssignments } = await import("@/lib/applyStandingAssignments");
  let conflictCount = 0;
  for (const { year: y, month: m } of months) {
    const p = await previewStandingAssignments(body.programSlug, y, m, null, body.dayOfWeek, targetHubSlug);
    conflictCount += p.conflicts.length;
  }

  return Response.json({
    programSlug:   body.programSlug,
    dayOfWeek:     body.dayOfWeek,
    saved,
    filled:        totalFilled,
    removed:       clearedCount,
    conflictCount,
    monthsSpanned: months.length,
  });
}
