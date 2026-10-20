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
 *       pattern:     "same" | "alternate" | "pair" | "custom" | "biweekly",
 *       hosts: {                       -- shape depends on pattern:
 *         every?:  string,             -- "same"
 *         oddWk?:  string, evenWk?: string,  -- "alternate" (1st&3rd, 2nd&4th)
 *         firstHalf?: string, secondHalf?: string,  -- "pair" (1st&2nd, 3rd&4th)
 *         first?: string, second?: string, third?: string, fourth?: string,
 *                                       -- "custom" (any subset filled)
 *       },
 *         weekA?: string, weekB?: string,  -- "biweekly" (every other week,
 *                                       --  taking turns from cycleStart)
 *       },
 *       cycleStart?:  string,         -- "biweekly": first week-A date, YYYY-MM-DD
 *       fifthHost?:   string | null,  -- 5th-occurrence host (not "biweekly")
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
import { canAccessHubScheduler, canManageHubCoverage } from "@/lib/hubAuth";
import { teamCannotStaff, getProgramHubSlug, DEFAULT_HOSTING_HUB_SLUG, getHubCoverageCopy } from "@/lib/programHub";
import { applyStandingAssignments, getApplyMonthRange } from "@/lib/applyStandingAssignments";
import { emptiedSessionKeys, recordHubEvents } from "@/lib/hubEvents";
import {
  sendStandingAssignmentScheduledEmail,
  sendStandingAssignmentReplacedEmail,
} from "@/lib/email";
import type { StandingOccurrence } from "@prisma/client";
import { ctMonthKey, ctStartOfToday } from "@/lib/timezone";
import { dateToDayCode, isCycleOccurrence, isOccurrenceOnDate, meetsEveryWeek, type ScheduleProgram } from "@/lib/scheduleUtils";

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
  const hubParam      = searchParams.get("hub");
  const hubSlug       = hubParam || DEFAULT_HOSTING_HUB_SLUG;
  // ?includeEnded=1 returns ended rotations too. Default: active only — ended
  // rotations would otherwise display in the grid as if active and let users
  // edit/save them with stale endsOn=today values.
  const includeEnded  = searchParams.get("includeEnded") === "1";

  // If a programSlug filter is given, the effective hub is THAT program's
  // hub (so a peer-led-silent-meditation coordinator can read rotations for
  // their hub's programs even without passing ?hub=). Otherwise use the
  // ?hub= param (or host-team default).
  // ?hub= wins when given (an AV or greeter view asking about a program
  // whose hosting team is another one must get its own team's rotations).
  const effectiveHubSlug = hubParam
    ? hubParam
    : programSlug
      ? await getProgramHubSlug(programSlug)
      : hubSlug;

  // Seeing a team's rotations is seeing its schedule: the per-team door, not
  // the right to cover (a coordinator who doesn't host still manages them).
  if (!(await canAccessHubScheduler(session.user.id, roles, effectiveHubSlug))) {
    return Response.json({ error: "You don't have permission to do that on this team's schedule." }, { status: 403 });
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
        // By Central day: endsOn is stored at 23:59:59Z, 6 PM Central in
        // winter, so comparing with the moment hid a rotation on the evening
        // of its last day (2026-10-19 audit).
        : { OR: [{ endsOn: null }, { endsOn: { gte: ctStartOfToday() } }] }),
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
      cycleStart: a.cycleStart ?? null,
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
  pattern:     "same" | "alternate" | "custom" | "biweekly";
  hosts: {
    every?:  string;
    weekA?:  string;
    weekB?:  string;
    oddWk?:  string;
    evenWk?: string;
    first?:  string;
    second?: string;
    third?:  string;
    fourth?: string;
  };
  fifthHost?: string | null;
  endsOn?:    string | null;
  /** "biweekly": the first week-A session's Central day, "YYYY-MM-DD". */
  cycleStart?: string | null;
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

    case "biweekly":
      // Every other week (2026-10-18): two people take turns from
      // cycleStart, whatever the month does. No 5th-week override: a
      // cycle has no 5th week.
      if (h.weekA) out.set("ALT_WEEK_A", h.weekA);
      if (h.weekB) out.set("ALT_WEEK_B", h.weekB);
      return out;
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
  if (!(await canManageHubCoverage(session.user.id, roles, targetHubSlug))) {
    return Response.json({ error: "Only this team's coordinator or a Host Manager can do that." }, { status: 403 });
  }
  // The team must staff this program: covers it, in a format it serves, and
  // on the hosting team the program needs a host (lib/programHub.ts).
  const cannot = await teamCannotStaff(targetHubSlug, body.programSlug);
  if (cannot) return Response.json({ error: cannot.message }, { status: 422 });
  if (!VALID_DAYS.includes(body.dayOfWeek)) {
    return Response.json({ error: `Invalid dayOfWeek: ${body.dayOfWeek}` }, { status: 400 });
  }
  if (!["same", "alternate", "custom", "biweekly"].includes(body.pattern)) {
    return Response.json({ error: `Invalid pattern: ${body.pattern}` }, { status: 400 });
  }
  // Every other week: turns are counted in weeks, so only a program that
  // meets every week can take turns (reviewer, 2026-10-18: on a program that
  // already meets every other week, the second person would never get a
  // turn). It starts on a day the program meets, on this weekday; an
  // unchanged start is kept even if the program's own start moved later.
  const cycleStart = body.pattern === "biweekly"
    ? (typeof body.cycleStart === "string" ? body.cycleStart.trim() : "")
    : null;
  if (cycleStart !== null) {
    const program = await db.program.findUnique({
      where: { slug: body.programSlug },
      select: { startDatetime: true, endDatetime: true, recurrenceFreq: true, recurrenceInterval: true, recurrenceDays: true, recurrenceCount: true },
    });
    if (!program || !meetsEveryWeek(program)) {
      return Response.json({ error: "Every other week is for programs that meet every week." }, { status: 400 });
    }
    const unchanged = !!(await db.standingAssignment.findFirst({
      where: { programSlug: body.programSlug, dayOfWeek: body.dayOfWeek, hubSlug: body.hubSlug || programHubSlug, cycleStart },
      select: { id: true },
    }));
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(cycleStart) ||
      dateToDayCode(cycleStart) !== body.dayOfWeek ||
      (!unchanged && !isOccurrenceOnDate(program as ScheduleProgram, cycleStart))
    ) {
      return Response.json({ error: "Choose a first date the program meets on this day." }, { status: 400 });
    }
  }

  const targets = patternToRecords(body);

  // Everyone placed on a rotation must be a member of the team who may cover
  // (2026-10-15: any id could be saved; the engine then skipped or placed
  // them inconsistently). Someone new to this rotation must be able to cover
  // now. Someone already on it may be paused: the rotation skips them while
  // paused (Jesse, 2026-10-15), and editing the rest of the rotation must not
  // force them off it. Only someone who has left the team is refused.
  const alreadyOn = new Set(
    (await db.standingAssignment.findMany({
      where: { programSlug: body.programSlug, dayOfWeek: body.dayOfWeek, hubSlug: targetHubSlug },
      select: { userId: true },
    })).map((r) => r.userId),
  );
  for (const uid of new Set(targets.values())) {
    const ok = alreadyOn.has(uid)
      ? !!(await db.hubMember.findFirst({
          where: { userId: uid, hub: { slug: targetHubSlug }, status: { not: "INACTIVE" } },
          select: { id: true },
        }))
      : await getEffectiveHostingCapability(uid, targetHubSlug, false);
    if (!ok) {
      return Response.json(
        { error: "Someone in this rotation isn't a member of this team who can cover sessions. Check the team's members and try again." },
        { status: 422 },
      );
    }
  }

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
  // Fix: anchor endsOn at 23:59:59 UTC on the picked calendar day (6 PM
  // Central in winter, 7 PM in summer) so the apply loop's noon-of-day
  // comparison treats the intended last day as still active. Anything that
  // compares endsOn with a moment must do it by Central day (2026-10-19).
  const endsOn = body.endsOn ? endOfCalendarDay(body.endsOn) : null;

  // Single transaction: delete any existing records in the bundle that aren't
  // in the new set, then upsert each target record. The bundle is now
  // scoped by hubSlug too (session 129) — an AV rotation and a host-team
  // rotation can coexist for the same program/day independently.
  // CT-anchored today for the future-assignment cutoff during cleanup below.
  const todayCtForCleanup = ctStartOfToday(); // Central midnight, not UTC (2026-10-15)

  // Captured inside the transaction; consumed after it to notify displaced
  // hosts. Map<userId, sessionDate[]>.
  const displacedByUser = new Map<string, Array<Date | null>>();
  let clearedCount = 0;

  const emptiedRows: { programSlug: string; sessionDate: Date | null; userId: string | null }[] = [];
  const saved = await db.$transaction(async (tx) => {
    const existing = await tx.standingAssignment.findMany({
      where: {
        programSlug: body.programSlug,
        dayOfWeek: body.dayOfWeek,
        hubSlug: targetHubSlug,
      },
      select: { id: true, occurrence: true, userId: true, cycleStart: true },
    });

    // Rules being removed = existing occurrences not present in the new set.
    const targetOccs = new Set(targets.keys());
    const removedRuleIds = existing
      .filter((ex) => !targetOccs.has(ex.occurrence))
      .map((ex) => ex.id);
    // An every-other-week rule whose start date or person changed keeps its
    // id but its turns move, so its future sessions are cleared like a
    // removed rule's and refilled below (reviewer, 2026-10-18: a shifted
    // cycle left the old sessions, and on an open sign-up team doubled
    // people up with no prompt). Its skip dates go with them.
    const movedCycleIds = existing
      .filter((ex) => isCycleOccurrence(ex.occurrence) && targets.has(ex.occurrence)
        && (ex.cycleStart !== cycleStart || ex.userId !== targets.get(ex.occurrence)))
      .map((ex) => ex.id);
    if (movedCycleIds.length > 0) {
      await tx.standingSkip.deleteMany({ where: { standingAssignmentId: { in: movedCycleIds } } });
    }
    const clearSessionsOf = [...removedRuleIds, ...movedCycleIds];

    // Clean up the FUTURE HostAssignments those removed rules created.
    // Without this, removing a host/occurrence from the pattern left their
    // upcoming sessions on the calendar as orphans (standingAssignmentId is
    // SetNull on rule delete) — so "remove Nancy" silently didn't take
    // (session 140, coordinator bug #4). FK-safe order matches the other
    // destructive Scheduler routes: SubClaim → SubRequest → HostAssignment
    // → StandingAssignment.
    if (clearSessionsOf.length > 0) {
      const futureRows = await tx.hostAssignment.findMany({
        where: {
          standingAssignmentId: { in: clearSessionsOf },
          sessionDate: { gte: todayCtForCleanup },
        },
        select: { id: true, userId: true, sessionDate: true, standingAssignmentId: true },
      });
      // On a moved cycle, someone still on the rotation is refilled on their
      // new turns, not told they were taken off.
      const stillOn = new Set(targets.values());
      const moved = new Set(movedCycleIds);
      for (const r of futureRows) {
        if (!r.userId || !r.sessionDate) continue;
        if (r.standingAssignmentId && moved.has(r.standingAssignmentId) && stillOn.has(r.userId)) continue;
        if (!displacedByUser.has(r.userId)) displacedByUser.set(r.userId, []);
        displacedByUser.get(r.userId)!.push(r.sessionDate);
      }
      emptiedRows.push(...futureRows.map((r) => ({ programSlug: body.programSlug, sessionDate: r.sessionDate, userId: r.userId })));
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
      // A skipped date belongs to the person it was made for: when this slot
      // gets a different person, their skips go (2026-10-15 review).
      await tx.standingSkip.deleteMany({
        where: {
          standingAssignment: {
            programSlug: body.programSlug,
            dayOfWeek: body.dayOfWeek,
            occurrence,
            hubSlug: targetHubSlug,
            userId: { not: userId },
          },
        },
      });
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
          cycleStart,
          createdById: session.user!.id,
        },
        update: {
          userId,
          endsOn,
          cycleStart,
          // Reset window when re-saving so the new assignment takes effect now
          startsOn: new Date(),
        },
      });
      out.push({ id: rec.id, occurrence: rec.occurrence, userId: rec.userId });
    }

    // The team's record: a person newly on a rotation (the team sees it), and
    // a person no longer on one (the leads and the person). A re-save with
    // the same people records nothing.
    const before = new Map(existing.map((ex) => [ex.occurrence, ex.userId]));
    const rotationAt = { hubSlug: targetHubSlug, programSlug: body.programSlug, actorId: session.user!.id };
    await recordHubEvents(tx, [
      ...[...targets.entries()]
        .filter(([occ, uid]) => before.get(occ) !== uid)
        .map(([occurrence, uid]) => ({
          ...rotationAt, kind: "rotation-set" as const, subjectUserId: uid,
          detail: { occurrence, dayOfWeek: body.dayOfWeek ?? null, cycleStart: cycleStart ?? null },
        })),
      ...existing
        .filter((ex) => targets.get(ex.occurrence) !== ex.userId)
        .map((ex) => ({
          ...rotationAt, kind: "rotation-ended" as const, subjectUserId: ex.userId,
          detail: {
            occurrence: ex.occurrence,
            dayOfWeek: body.dayOfWeek ?? null,
            sessions: emptiedSessionKeys(emptiedRows.filter((r) => r.userId === ex.userId)),
          },
        })),
    ]);

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
          firstSessionMonth: (() => {
            const first = dates.filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0];
            return first ? ctMonthKey(first) : undefined;
          })(),
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
