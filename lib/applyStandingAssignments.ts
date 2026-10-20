/**
 * Standing-assignment generation, preview, and apply.
 *
 * Three pure-ish stages:
 *
 *   1. generateCandidates() — given a set of standing rotations + month, walks
 *      every future date and produces the list of (programSlug × date × user)
 *      tuples that *would* be assigned. No database writes. Future-only.
 *
 *   2. previewStandingAssignments() — diffs the candidates against existing
 *      HostAssignments and produces a conflict report:
 *        - openSessions   — empty slots the candidates would fill
 *        - conflicts      — slots already assigned to someone (with current host
 *                           and source: 'standing-self' | 'standing-other' | 'manual')
 *        - pastIgnored    — count of candidates whose date is in the past (informational)
 *
 *   3. applyStandingAssignments() — given a resolution mode and the candidate
 *      list, performs the writes:
 *        - 'leave'      → fills only open slots (default; cron uses this)
 *        - 'replace-all' → overwrites every conflict
 *        - { [date]: 'replace' | 'keep' }  → per-date choice
 *
 * Key invariants:
 *   - Past sessions are NEVER touched. Filter applied at candidate generation.
 *   - Sub-cover-protected: assignments referenced by an OPEN/CLAIMED SubRequest
 *     are never replaced even under replace-all (those slots are someone's
 *     committed coverage). The conflict report flags them as protected.
 *   - Standing-derived rows carry standingAssignmentId so future runs can
 *     distinguish "I created this; I can replace it" from "manual assignment".
 *
 * Used by:
 *   - POST /api/host/standing-assignments/preview     (coordinator UI dry-run)
 *   - POST /api/host/standing-assignments/apply       (coordinator commit)
 *   - GET  /api/cron/apply-standing-assignments       (daily, resolution='leave')
 */

import { db } from "@/lib/db";
import {
  ctDateStr,
  shiftToDate,
  isOccurrenceOnDate,
  getDayOfWeekOccurrenceInMonth,
  getTotalDayOfWeekOccurrencesInMonth,
  isCycleOccurrence,
  isCycleWeek,
  meetsEveryWeek,
  type ScheduleProgram,
} from "@/lib/scheduleUtils";
import type { StandingOccurrence } from "@prisma/client";
import { ctDayBounds } from "@/lib/timezone";
import { emptiedSessionKeys, recordHubEvents } from "@/lib/hubEvents";

const TZ = "America/Chicago";

/** Occurrence enum → numeric. ALL/LAST resolved during candidate generation. */
const OCC_NUMBER: Partial<Record<StandingOccurrence, number>> = {
  FIRST: 1, SECOND: 2, THIRD: 3, FOURTH: 4, FIFTH: 5,
};

/** The program fields the rotation test needs. */
const RULE_PROGRAM_SELECT = {
  startDatetime: true, endDatetime: true,
  recurrenceFreq: true, recurrenceInterval: true,
  recurrenceDays: true, recurrenceCount: true,
} as const;

/**
 * Would this rotation fill this Central date of its program: within its start
 * and end, a day the program meets, the rotation's weekday, and its week
 * pattern? The engine's own test, shared with holdRotationDate and the skip
 * check, so a skip holds a session open only on a date its rotation would
 * fill (2026-10-19 audit: a hand claim on another person's rotation date
 * held that date shut against them). Team coverage and "No host needed" are
 * the engine's separate checks. A rotation with no weekday (legacy) fills
 * nothing.
 */
export function ruleFillsDate(
  sa: { dayOfWeek: string | null; occurrence: StandingOccurrence; cycleStart: string | null; startsOn: Date; endsOn: Date | null },
  program: ScheduleProgram,
  dateStr: string,
): boolean {
  if (dateStr < ctDateStr(sa.startsOn.toISOString())) return false;
  if (sa.endsOn && new Date(dateStr + "T12:00:00") > sa.endsOn) return false;
  if (!isOccurrenceOnDate(program, dateStr)) return false;
  if (!sa.dayOfWeek) return false;
  if (sa.dayOfWeek !== DOW_FROM_INDEX[new Date(`${dateStr}T12:00:00`).getDay()]) return false;
  if (sa.occurrence === "ALL") return true;
  // Every other week, counted from the cycle's start (2026-10-18), and only
  // for a program that meets every week (2026-10-19 audit).
  if (isCycleOccurrence(sa.occurrence)) {
    return meetsEveryWeek(program) && isCycleWeek(sa.occurrence, sa.cycleStart, dateStr);
  }
  // The rotation's weekday counted in the month (not all program sessions).
  if (sa.occurrence === "LAST") {
    return getDayOfWeekOccurrenceInMonth(dateStr) === getTotalDayOfWeekOccurrencesInMonth(dateStr);
  }
  const target = OCC_NUMBER[sa.occurrence];
  return target !== undefined && getDayOfWeekOccurrenceInMonth(dateStr) === target;
}

/** Day index (0=Sun..6=Sat) → enum value used in StandingAssignment.dayOfWeek. */
const DOW_FROM_INDEX = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

/**
 * Specificity ranking for the apply loop. Lower number = more specific.
 * When multiple rotations could match the same date, the most-specific wins
 * (e.g. ALL=Nancy + FIFTH=Sue → Sue wins on a 5th-week date).
 */
function specificity(occ: StandingOccurrence): number {
  if (occ === "ALL")  return 2;
  if (occ === "LAST") return 1;
  return 0;
}

/**
 * Compute the month range to apply across, given a starting (year, month)
 * and an optional rotation `endsOn` cap. Returns an array of (year, month)
 * pairs (1-based month) to iterate through.
 *
 * Default horizon when endsOn is null: end of the calendar year. This
 * matches the form's default end-date affordance and the coordinator's
 * mental model of "set up the rotation for the rest of the year."
 *
 * If endsOn is in the past relative to start, returns just the start month
 * (the apply itself further filters to future dates only).
 */
export function getApplyMonthRange(
  startYear:  number,
  startMonth: number,
  endsOn:     Date | null
): Array<{ year: number; month: number }> {
  let endYear: number;
  let endMonth: number;
  if (endsOn) {
    endYear  = endsOn.getFullYear();
    endMonth = endsOn.getMonth() + 1;
  } else {
    endYear  = startYear;
    endMonth = 12;
  }
  if (endYear < startYear || (endYear === startYear && endMonth < startMonth)) {
    return [{ year: startYear, month: startMonth }];
  }
  const out: Array<{ year: number; month: number }> = [];
  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    out.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

// ─── TYPES ─────────────────────────────────────────────────────────────────

export interface Candidate {
  programSlug:          string;
  /** Hub that owns this candidate (session 129). Inherited from the source
   *  StandingAssignment.hubSlug — drives which hub's HostAssignment row is
   *  written and which hub's link the notification email points at. */
  hubSlug:              string;
  userId:               string;
  sessionDate:          Date;
  dateStr:              string;       // "YYYY-MM-DD"
  standingAssignmentId: string;       // FK back to the rotation rule
  programName:          string;
  dateLabel:            string;       // "Tue, Apr 7"
  userEmail:            string;
  firstName:            string | null;
}

export interface Conflict {
  dateStr:        string;             // "YYYY-MM-DD"
  programSlug:    string;
  /** Hub that owns the conflicting assignment (session 140). Lets the apply
   *  loop key candidates per hub so a multi-hub program doesn't cross-match. */
  hubSlug:        string;
  programName:    string;
  dateLabel:      string;
  /** The user we'd assign if conflict is resolved as 'replace' */
  proposedHost:   { userId: string; displayName: string };
  /** The user currently holding this session */
  currentHost:    { userId: string | null; displayName: string };
  /**
   * Source of the current assignment:
   *   - 'standing-self'  — created by THIS standing rotation rule (safe to replace silently;
   *                        usually means the rotation was previously applied for this date)
   *   - 'standing-other' — created by a DIFFERENT standing rotation rule
   *   - 'manual'         — created by a coordinator/host directly (self-claim, manager assign)
   *   - 'sub-cover'      — protected; covered via the sub-request flow
   */
  source:         "standing-self" | "standing-other" | "manual" | "sub-cover";
  protected:      boolean;            // true ⇒ replace-all skips it
  hostAssignmentId: string;
}

/** Open candidates may already have a row in the DB with userId=null
 *  (an unclaimed placeholder). When that's true, we must UPDATE that row
 *  rather than try to CREATE — the unique constraint on (programSlug,
 *  sessionDate) would otherwise drop the new write silently. */
interface OpenSlot extends Candidate {
  existingHostAssignmentId?: string;
}

export interface PreviewResult {
  candidates:   Candidate[];
  openSessions: OpenSlot[];           // candidates with no conflict (may have existing userId=null row)
  conflicts:    Conflict[];
  pastIgnored:  number;
}

export type ResolutionMode =
  | "leave"
  | "replace-all"
  | { perDate: Record<string, "keep" | "replace"> };

/** One row in the apply summary's per-user list. `hubSlug` (session 129)
 *  carries the source rotation's hub so the notification email link points
 *  at the right scheduler view — an AV rotation email lands the recipient
 *  at /tools/schedule?hub=audio-visual rather than host-team. `dateStr`
 *  (session 130) is the session's calendar date in CT (`YYYY-MM-DD`); the
 *  email builder uses the earliest of these to deep-link the Schedule URL
 *  to the right month, so the recipient lands on the actual rows they're
 *  hosting instead of the current month's view. */
export interface ApplyResultSession {
  programName: string;
  dateLabel:   string;
  userEmail:   string;
  firstName:   string | null;
  hubSlug:     string;
  dateStr:     string;
}

export interface ApplyResult {
  filled:    number;
  replaced:  number;
  kept:      number;
  /** Map of userId → sessions newly assigned to them — for notification email */
  byUser:    Map<string, ApplyResultSession[]>;
  /** Map of displaced userId → sessions taken from them — for "you've been replaced" email */
  byDisplacedUser: Map<string, ApplyResultSession[]>;
}

// ─── STAGE 1: GENERATE CANDIDATES ──────────────────────────────────────────

/**
 * Walks future dates in [year, month] (or [today, year+month] if month is the
 * current month) and produces the list of tuples each active standing
 * rotation would assign. No DB writes.
 *
 * @param programSlugFilter  null = all programs, slug = scoped
 * @param year               4-digit
 * @param month              1-based (Jan = 1)
 * @param standingFilterId   null = all rotations, id = scoped (for preview of a single rotation)
 */
export async function generateCandidates(
  programSlugFilter: string | null,
  year:               number,
  month:              number,
  standingFilterId:   string | null = null,
  dayOfWeekFilter:    string | null = null,
  /** Restrict to a single hub's rotations (session 129). null = all hubs. */
  hubSlugFilter:      string | null = null,
): Promise<{ candidates: Candidate[]; pastIgnored: number }> {
  // CT-anchored "today" — we treat anything strictly before today (CT) as past.
  const todayCt = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const todayStr = `${todayCt.getFullYear()}-${String(todayCt.getMonth() + 1).padStart(2, "0")}-${String(todayCt.getDate()).padStart(2, "0")}`;

  // 1. Load active rotations, sorted by specificity (specific wins over ALL)
  const standingAssignmentsRaw = await db.standingAssignment.findMany({
    where: {
      ...(programSlugFilter ? { programSlug: programSlugFilter } : {}),
      ...(standingFilterId  ? { id: standingFilterId }            : {}),
      ...(dayOfWeekFilter   ? { dayOfWeek:   dayOfWeekFilter   } : {}),
      ...(hubSlugFilter     ? { hubSlug:     hubSlugFilter     } : {}),
      OR: [{ endsOn: null }, { endsOn: { gte: todayCt } }],
      // An archived person is never scheduled (2026-10-16 audit).
      user: { archivedAt: null },
    },
    include: {
      user: { select: { id: true, firstName: true, preferredName: true, email: true } },
    },
  });
  // Specificity sort: numeric (FIRST/SECOND/.../FIFTH) → LAST → ALL.
  // Within same specificity, deterministic by id (so behavior is stable).
  const standingAssignments = standingAssignmentsRaw.sort((a, b) => {
    const sa = specificity(a.occurrence);
    const sb = specificity(b.occurrence);
    if (sa !== sb) return sa - sb;
    return a.id.localeCompare(b.id);
  });

  if (standingAssignments.length === 0) return { candidates: [], pastIgnored: 0 };

  // 2. Load programs. We DON'T filter out "No host needed" programs here —
  //    that flag governs the PRIMARY host only, so a self-led program may still
  //    carry auxiliary (AV/greeter) rotations that must apply. Instead we record
  //    each self-led program's primary hub and skip just its primary-hub
  //    rotations in the candidate loop below.
  const slugs = [...new Set(standingAssignments.map((sa) => sa.programSlug))];
  const programs = await db.program.findMany({
    where: { slug: { in: slugs }, archivedAt: null },
    select: {
      id: true, name: true, slug: true, programFormat: true,
      startDatetime: true, endDatetime: true,
      recurrenceFreq: true, recurrenceInterval: true,
      recurrenceDays: true, recurrenceCount: true,
      hostingRequired: true, hostingHubSlug: true,
    },
  });
  const programMap = new Map<string, ScheduleProgram>(
    programs.map((p) => [p.slug, p as ScheduleProgram])
  );
  // slug → its primary hub, ONLY for self-led programs. Used to skip
  // primary-hub rotations on a "No host needed" program while still letting
  // its auxiliary-hub (AV/greeter) rotations generate candidates.
  const selfLedPrimaryHub = new Map<string, string>();
  for (const p of programs) {
    if (!p.hostingRequired) selfLedPrimaryHub.set(p.slug, p.hostingHubSlug ?? "host-team");
  }

  // A rotation fires only where its team still covers the program, in a
  // format the team serves (2026-10-15: after a team was unticked, or the
  // format changed, rotations kept creating sessions nobody could see).
  const ruleHubs = [...new Set(standingAssignments.map((sa) => sa.hubSlug))];
  const [hubRows, coverageRows, skipRows] = await Promise.all([
    db.hub.findMany({
      where: { slug: { in: ruleHubs } },
      select: {
        slug: true, appliesToFormats: true, allowsMultipleAssignments: true, status: true,
        appLinks: { where: { toolSlug: "schedule", isEnabled: true }, select: { id: true }, take: 1 },
      },
    }),
    db.programCoverageHub.findMany({ where: { programSlug: { in: slugs } }, select: { programSlug: true, hubSlug: true } }),
    // Dates a rotation must not fill: someone was removed from it, or released it.
    db.standingSkip.findMany({
      where: { standingAssignmentId: { in: standingAssignments.map((sa) => sa.id) } },
      select: { standingAssignmentId: true, dateStr: true },
    }),
  ]);
  const hubBySlug = new Map(hubRows.map((h) => [h.slug, h]));
  const coverage = new Set(coverageRows.map((c) => `${c.programSlug}::${c.hubSlug}`));
  const teamCovers = (program: { slug: string; programFormat: string | null; hostingHubSlug?: string | null }, hubSlug: string) => {
    const hub = hubBySlug.get(hubSlug);
    // An archived team, or one with the Scheduler off, schedules no one
    // (2026-10-16 audit: an archived team's rotations kept filling sessions).
    if (!hub || hub.status !== "ACTIVE" || hub.appLinks.length === 0) return false;
    const covers = (program.hostingHubSlug ?? "host-team") === hubSlug || coverage.has(`${program.slug}::${hubSlug}`);
    // Same as the view: a program with no format shows on no team's schedule.
    return covers && !!program.programFormat && hub.appliesToFormats.includes(program.programFormat);
  };
  // A skip holds its rule's person off that date. On a one-person team it
  // also holds the seat open (no other rule fills the gap someone just made),
  // but only where its rule would have won the seat: decided in the loop
  // below, which runs the most specific rule first (2026-10-19 audit: a
  // broader rule's skip shut out a more specific rule's date).
  const skippedRuleDates = new Set(skipRows.map((s) => `${s.standingAssignmentId}::${s.dateStr}`));

  // 3. Walk every day of the month, building candidates
  const daysInMonth   = new Date(year, month, 0).getDate();
  const candidates: Candidate[] = [];
  let pastIgnored = 0;
  // Prevent two rotations from claiming the same slot in one pass (FIRST + ALL on same date)
  const claimedKeys = new Set<string>();

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // Future-only: skip past dates
    if (dateStr < todayStr) {
      // Count for the report once per date that any rotation would have fired on
      // (we don't actually need to check rotations to count — but we want a
      // meaningful number, so check at least one rotation matches this past date)
      let pastWouldFire = false;
      for (const sa of standingAssignments) {
        const p = programMap.get(sa.programSlug);
        if (!p) continue;
        if (!isOccurrenceOnDate(p, dateStr)) continue;
        pastWouldFire = true;
        break;
      }
      if (pastWouldFire) pastIgnored++;
      continue;
    }

    for (const sa of standingAssignments) {
      const program = programMap.get(sa.programSlug);
      if (!program) continue;

      // "No host needed" skips PRIMARY-hub rotations only — auxiliary
      // (AV/greeter) rotations on a self-led program still apply.
      const selfLedHub = selfLedPrimaryHub.get(sa.programSlug);
      if (selfLedHub && sa.hubSlug === selfLedHub) continue;
      if (!teamCovers(program as ScheduleProgram & { slug: string; programFormat: string | null; hostingHubSlug?: string | null }, sa.hubSlug)) continue;

      if (!ruleFillsDate(sa, program, dateStr)) continue;

      // De-dupe within this generation pass — first (most-specific) wins.
      // The specificity sort above ensures FIRST/.../FIFTH come before ALL.
      // Keyed by hubSlug too (session 129) so an AV rotation and a host-team
      // rotation on the same program/date don't crowd each other out — they
      // claim independent slots in different hubs.
      const key = `${sa.programSlug}::${dateStr}::${sa.hubSlug}`;
      // One rotation person per session per team, open sign-up included: a
      // team has one rotation per program and day, so the only rules that
      // meet here are a 5th-week person and the every-week one, and the 5th
      // week replaces (as the editor's preview shows). Additive open sign-up
      // means adding to the people already signed up, which
      // previewStandingAssignments handles (2026-10-15 review).
      if (claimedKeys.has(key)) continue;
      if (skippedRuleDates.has(`${sa.id}::${dateStr}`)) {
        // This rule won the seat and is held off it: a one-person team's
        // seat stays open; an open sign-up team just goes without this person.
        if (!hubBySlug.get(sa.hubSlug)?.allowsMultipleAssignments) claimedKeys.add(key);
        continue;
      }
      claimedKeys.add(key);

      const sessionDate = shiftToDate(program.startDatetime!.toISOString(), dateStr);
      const dateLabel   = sessionDate.toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", timeZone: TZ,
      });

      candidates.push({
        programSlug:          sa.programSlug,
        hubSlug:              sa.hubSlug,
        userId:               sa.userId,
        sessionDate,
        dateStr,
        standingAssignmentId: sa.id,
        programName:          program.name,
        dateLabel,
        userEmail:            sa.user.email,
        firstName:            sa.user.preferredName || sa.user.firstName || null,
      });
    }
  }

  // Membership invariant, defense-in-depth (session 146): drop any candidate
  // whose (userId, hubSlug) isn't a current HubMember of that hub. Rules for
  // non-members are removed at member-removal and by the heal migration, but
  // this guard means even a stray rotation rule can't have the daily cron
  // resurrect an orphan assignment for someone who has left a team.
  if (candidates.length > 0) {
    const neededSlugs = [...new Set(candidates.map((c) => c.hubSlug))];
    const hubs = await db.hub.findMany({
      where: { slug: { in: neededSlugs } },
      select: { id: true, slug: true },
    });
    const slugByHubId = new Map(hubs.map((h) => [h.id, h.slug]));
    const userIds = [...new Set(candidates.map((c) => c.userId))];
    // Active members who may cover: a paused member, or one whose coverage is
    // turned off, isn't scheduled by a rotation (Jesse, 2026-10-15).
    const members = await db.hubMember.findMany({
      where: { hubId: { in: hubs.map((h) => h.id) }, userId: { in: userIds }, status: "ACTIVE", hostingCapability: true },
      select: { hubId: true, userId: true },
    });
    const memberKeys = new Set(
      members.map((m) => `${m.userId}::${slugByHubId.get(m.hubId) ?? ""}`),
    );
    const kept = candidates.filter((c) => memberKeys.has(`${c.userId}::${c.hubSlug}`));
    if (kept.length < candidates.length) {
      const dropped = candidates.filter((c) => !memberKeys.has(`${c.userId}::${c.hubSlug}`));
      console.warn(
        `[standing-apply] dropped ${dropped.length} candidate(s) whose person isn't an active member who may cover (left, paused, or coverage off):`,
        dropped.map((c) => `${c.userId}@${c.hubSlug} ${c.programSlug} ${c.dateStr}`).join("; "),
      );
      return { candidates: kept, pastIgnored };
    }
  }

  return { candidates, pastIgnored };
}

// ─── STAGE 2: PREVIEW (DIFF AGAINST EXISTING) ──────────────────────────────

/**
 * Loads existing HostAssignments for the candidate dates and produces a
 * report of what would be filled, what conflicts, and which conflicts are
 * protected (sub-cover).
 */
export async function previewStandingAssignments(
  programSlugFilter: string | null,
  year:               number,
  month:              number,
  standingFilterId:   string | null = null,
  dayOfWeekFilter:    string | null = null,
  hubSlugFilter:      string | null = null,
): Promise<PreviewResult> {
  const { candidates, pastIgnored } = await generateCandidates(
    programSlugFilter, year, month, standingFilterId, dayOfWeekFilter, hubSlugFilter,
  );

  if (candidates.length === 0) {
    return { candidates: [], openSessions: [], conflicts: [], pastIgnored };
  }

  // Load existing assignments for the candidate slots.
  //
  // CRITICAL: query by date RANGE, not exact DateTime match. The previous
  // host_assignments unique constraint was `(programSlug, sessionDate)` on
  // the full DateTime, where two writes on the same calendar date with
  // even a millisecond difference would BOTH violate "one host per date"
  // intent while passing the constraint. The unique was dropped in session
  // 129 in favor of app-layer enforcement scoped per hub. We must catch
  // any existing row whose ctDateStr matches our candidate's calendar
  // date, regardless of the stored time-of-day. Otherwise:
  //   1. Preview misses zombies (any pre-existing row at a different t-o-d)
  //   2. createMany silently drops the new write
  //   3. Coordinator sees "saved" but no host appears
  // DST drift in shiftToDate also produces sessionDates whose UTC instant
  // straddles midnight CT, which the exact-match query was missing.
  //
  // The conflict key now includes hubSlug (session 129) — an AV rotation
  // candidate doesn't conflict with a host-team HostAssignment on the
  // same date, because they cover different roles in different hubs.
  const slugs = [...new Set(candidates.map((c) => c.programSlug))];
  const sessionDates = candidates.map((c) => c.sessionDate.getTime());
  // Pad ±1 day to absorb any DST or time-of-day variance
  const minMs = Math.min(...sessionDates) - 86400000;
  const maxMs = Math.max(...sessionDates) + 86400000;

  const existingRaw = await db.hostAssignment.findMany({
    where: {
      programSlug: { in: slugs },
      sessionDate: { gte: new Date(minMs), lte: new Date(maxMs) },
    },
    include: {
      user: { select: { id: true, firstName: true, preferredName: true, email: true } },
      subRequests: {
        where: { status: { in: ["OPEN", "CLAIMED"] } },
        select: { id: true, status: true, claim: { select: { claimedById: true } } },
      },
    },
  });

  // Key by (programSlug, calendarDate-in-CT, hubSlug). Multi-claimant hubs
  // (greeter) may have many rows per (programSlug, dateStr, hubSlug); only
  // the first claimant matters for conflict detection — a candidate
  // colliding with any existing row in that hub triggers the conflict.
  const existingByKey = new Map<string, typeof existingRaw[number]>();
  for (const a of existingRaw.sort(
    (x, y) => (x.sessionDate?.getTime() ?? 0) - (y.sessionDate?.getTime() ?? 0)
  )) {
    if (!a.sessionDate) continue;
    const dStr = ctDateStr(a.sessionDate.toISOString());
    const key  = `${a.programSlug}::${dStr}::${a.hubSlug}`;
    if (!existingByKey.has(key)) existingByKey.set(key, a);
  }

  const openSessions: OpenSlot[] = [];
  const conflicts:    Conflict[] = [];

  // Open sign-up teams are additive (Jesse, 2026-10-15): a rotation adds its
  // person to the session's list and never replaces anyone. The only thing
  // to avoid is signing the same person up twice.
  const openSignUpHubs = new Set(
    (await db.hub.findMany({
      where: { slug: { in: [...new Set(candidates.map((c) => c.hubSlug))] }, allowsMultipleAssignments: true },
      select: { slug: true },
    })).map((h) => h.slug),
  );
  const signedUp = new Map<string, Set<string>>();
  for (const a of existingRaw) {
    if (!a.sessionDate || !a.userId || !openSignUpHubs.has(a.hubSlug)) continue;
    const k = `${a.programSlug}::${ctDateStr(a.sessionDate.toISOString())}::${a.hubSlug}`;
    if (!signedUp.has(k)) signedUp.set(k, new Set());
    signedUp.get(k)!.add(a.userId);
  }

  for (const cand of candidates) {
    const key = `${cand.programSlug}::${cand.dateStr}::${cand.hubSlug}`;
    if (openSignUpHubs.has(cand.hubSlug)) {
      if (!signedUp.get(key)?.has(cand.userId)) {
        openSessions.push({ ...cand, existingHostAssignmentId: undefined });
      }
      continue;
    }
    const existing = existingByKey.get(key);

    if (!existing || existing.userId === null) {
      // No row, OR a placeholder row with userId=null. In the latter case
      // we'll UPDATE that row in apply rather than fight the unique
      // constraint with a CREATE.
      openSessions.push({
        ...cand,
        existingHostAssignmentId: existing?.id,
      });
      continue;
    }

    // Don't conflict with yourself — same person already on this date is just "no-op"
    if (existing.userId === cand.userId) {
      // already covered, skip silently
      continue;
    }

    // Determine source
    let source: Conflict["source"];
    let isProtected = false;

    // An open cover request is protected too, as the header says: replacing
    // the person under it would let a claimer take over the rotation's new
    // person (2026-10-16 audit).
    const hasSubCover = existing.subRequests.some(
      (sr) => sr.status === "OPEN" || (sr.status === "CLAIMED" && sr.claim?.claimedById === existing.userId)
    );
    if (hasSubCover) {
      source = "sub-cover";
      isProtected = true;
    } else if (existing.standingAssignmentId === null) {
      source = "manual";
    } else if (
      standingFilterId !== null && existing.standingAssignmentId === standingFilterId
    ) {
      source = "standing-self";
    } else {
      source = "standing-other";
    }

    const currentDisplayName = existing.user
      ? (existing.user.preferredName || existing.user.firstName || existing.user.email)
      : "(unknown)";

    conflicts.push({
      dateStr:        cand.dateStr,
      programSlug:    cand.programSlug,
      hubSlug:        cand.hubSlug,
      programName:    cand.programName,
      dateLabel:      cand.dateLabel,
      proposedHost:   { userId: cand.userId, displayName: cand.firstName || cand.userEmail },
      currentHost:    { userId: existing.userId, displayName: currentDisplayName },
      source,
      protected:      isProtected,
      hostAssignmentId: existing.id,
    });
  }

  return { candidates, openSessions, conflicts, pastIgnored };
}

// ─── STAGE 3: APPLY ────────────────────────────────────────────────────────

/**
 * Commits the writes. Future-only is enforced again at this layer (defense in
 * depth — even if a stale candidate sneaks through, it can't touch the past).
 *
 * @param resolution
 *   'leave'       — fill only open slots (default for cron, default for first save)
 *   'replace-all' — overwrite every conflict EXCEPT sub-cover (always protected)
 *   { perDate }   — per-date keep/replace decisions from the conflict modal.
 *                   Open slots always fill. Sub-cover always kept.
 */
export async function applyStandingAssignments(
  programSlugFilter: string | null,
  year:               number,
  month:              number,
  resolution:         ResolutionMode = "leave",
  standingFilterId:   string | null = null,
  dayOfWeekFilter:    string | null = null,
  hubSlugFilter:      string | null = null,
): Promise<ApplyResult> {
  const preview = await previewStandingAssignments(
    programSlugFilter, year, month, standingFilterId, dayOfWeekFilter, hubSlugFilter,
  );

  // Collect candidate user info from the preview's candidates (for emails)
  const candidatesByKey = new Map<string, Candidate>();
  for (const c of preview.candidates) {
    // Key by hub too (session 140) so a multi-hub program (e.g. host-team +
    // AV + greeter covering the same hybrid session) doesn't collapse to a
    // single candidate and let a replace write the wrong hub's host.
    candidatesByKey.set(`${c.programSlug}::${c.dateStr}::${c.hubSlug}`, c);
  }

  // Build the actual write list. Open candidates split into two streams:
  // toCreate = no existing row (createMany), toUpdate = placeholder userId=null
  // row exists (must update by id to avoid unique-constraint skipDuplicates).
  const toCreate: OpenSlot[] = preview.openSessions.filter((c) => !c.existingHostAssignmentId);
  const toUpdate: OpenSlot[] = preview.openSessions.filter((c) =>  c.existingHostAssignmentId);
  const toReplace: Array<{ conflict: Conflict; cand: Candidate }> = [];

  for (const conf of preview.conflicts) {
    const cand = candidatesByKey.get(`${conf.programSlug}::${conf.dateStr}::${conf.hubSlug}`);
    if (!cand) continue; // shouldn't happen

    // Sub-cover is sacred regardless of resolution mode
    if (conf.protected) continue;

    let shouldReplace = false;
    if (resolution === "leave") {
      // Special case: 'standing-self' means we created it; safe to replace with
      // the current rotation's user (in case user changed). But for "leave"
      // mode (cron, default), we still skip — cron is conservative.
      shouldReplace = false;
    } else if (resolution === "replace-all") {
      // Replace-all overrides standing conflicts but NOT manually self-
      // assigned sessions — a blanket "replace all" shouldn't silently stomp
      // a date someone deliberately picked for themselves (session 140; the
      // likely cause of the "Maria removed unexpectedly" report). Sub-cover
      // is already protected above. To override a manual claim, the
      // coordinator switches to "Decide one by one" and toggles it.
      shouldReplace = conf.source !== "manual";
    } else if (typeof resolution === "object" && resolution.perDate) {
      shouldReplace = resolution.perDate[conf.dateStr] === "replace";
    }

    if (shouldReplace) toReplace.push({ conflict: conf, cand });
  }

  // ── Lookup displaced-user info for emails ──────────────────────────────
  const displacedUserIds = [
    ...new Set(toReplace.map((r) => r.conflict.currentHost.userId).filter((u): u is string => u !== null)),
  ];
  const displacedUsers = displacedUserIds.length > 0
    ? await db.user.findMany({
        where: { id: { in: displacedUserIds } },
        select: { id: true, firstName: true, preferredName: true, email: true },
      })
    : [];
  const displacedUserMap = new Map(displacedUsers.map((u) => [u.id, u]));

  // ── Writes ─────────────────────────────────────────────────────────────
  // Each session is written under the same lock a volunteer's claim takes
  // (seat:<program>:<Central day>:<team>, app/api/host/assignments POST), and
  // only if it is still as the preview found it: the preview reads outside
  // this transaction, and a coordinator's daytime Save & apply could
  // otherwise put two people in one seat, or overwrite a claim made a moment
  // before without telling anyone (2026-10-19 audit). A session that changed
  // is left as it is and left out of the emails; the next run looks again.
  const openSignUp = new Set(
    (await db.hub.findMany({
      where: { slug: { in: [...new Set(toCreate.map((c) => c.hubSlug))] }, allowsMultipleAssignments: true },
      select: { slug: true },
    })).map((h) => h.slug),
  );
  const created: OpenSlot[] = [];
  const updated: OpenSlot[] = [];
  const replacedRows: Array<{ conflict: Conflict; cand: Candidate }> = [];
  await db.$transaction(async (tx) => {
    const lockSeat = (c: Candidate) =>
      tx.$queryRawUnsafe("SELECT 1 FROM pg_advisory_xact_lock(hashtext($1))", `seat:${c.programSlug}:${c.dateStr}:${c.hubSlug}`);

    // 1. Create rows for slots that had no row at all. `hubSlug` carries the
    //    candidate's hub (session 129) so the row lands in the right team.
    for (const c of toCreate) {
      await lockSeat(c);
      const day = ctDayBounds(c.sessionDate);
      const taken = await tx.hostAssignment.findFirst({
        where: {
          programSlug: c.programSlug,
          hubSlug: c.hubSlug,
          sessionDate: { gte: day.start, lte: day.end },
          // An open sign-up team: only this person's own sign-up blocks it.
          ...(openSignUp.has(c.hubSlug) ? { userId: c.userId } : {}),
        },
        select: { id: true },
      });
      if (taken) continue;
      await tx.hostAssignment.create({
        data: {
          programSlug:          c.programSlug,
          hubSlug:              c.hubSlug,
          userId:               c.userId,
          sessionDate:          c.sessionDate,
          assignedBy:           c.userId, // self for standing — no manual assigner
          standingAssignmentId: c.standingAssignmentId,
        },
      });
      created.push(c);
    }

    // 2. Fill placeholder rows (userId=null), only while still empty. We
    //    don't reset hubSlug: the row's hubSlug is what bound it to the
    //    open-slot lookup, so it already matches the candidate's hub.
    for (const u of toUpdate) {
      await lockSeat(u);
      const r = await tx.hostAssignment.updateMany({
        where: { id: u.existingHostAssignmentId!, userId: null },
        data: {
          userId:               u.userId,
          sessionDate:          u.sessionDate,
          assignedBy:           u.userId,
          standingAssignmentId: u.standingAssignmentId,
        },
      });
      if (r.count === 1) updated.push(u);
    }

    // 3. Replace conflicts in place (keeps subRequest integrity), only while
    //    the person the coordinator chose to replace still holds the seat.
    for (const r of toReplace) {
      await lockSeat(r.cand);
      const res = await tx.hostAssignment.updateMany({
        where: { id: r.conflict.hostAssignmentId, userId: r.conflict.currentHost.userId },
        data: {
          userId:               r.cand.userId,
          sessionDate:          r.cand.sessionDate,  // canonicalize the t-o-d
          assignedBy:           r.cand.userId,
          standingAssignmentId: r.cand.standingAssignmentId,
        },
      });
      if (res.count === 1) replacedRows.push(r);
    }
  }, { maxWait: 10_000, timeout: 120_000 });

  // Removable diagnostic (session 140): when a coordinator replaces hosts,
  // log the exact per-date deltas so an unclear "my edit changed the wrong
  // host" report (the Qigong head-scratcher) can be reconstructed from the
  // server logs. Only fires on replacements — routine cron fills ("leave"
  // mode) never reach this, so it doesn't spam the daily run.
  if (replacedRows.length > 0) {
    console.log("[rotation-apply]", JSON.stringify({
      program: programSlugFilter, hub: hubSlugFilter, day: dayOfWeekFilter,
      standingId: standingFilterId, year, month,
      resolution: typeof resolution === "string" ? resolution : "perDate",
      filled: created.length + updated.length,
      replaced: replacedRows.length,
      replaces: replacedRows.map((r) => ({
        program: r.cand.programSlug, hub: r.cand.hubSlug, date: r.cand.dateStr,
        from: r.conflict.currentHost.userId, to: r.cand.userId, source: r.conflict.source,
      })),
    }));
  }

  // ── Build result reports ───────────────────────────────────────────────
  // "filled" = slots that now have a host (creates + placeholder-updates)
  const filled   = created.length + updated.length;
  const replaced = replacedRows.length;
  const kept     = preview.conflicts.length - replacedRows.length;

  const byUser = new Map<string, ApplyResultSession[]>();
  const pushUser = (c: Candidate) => {
    if (!byUser.has(c.userId)) byUser.set(c.userId, []);
    byUser.get(c.userId)!.push({
      programName: c.programName, dateLabel: c.dateLabel,
      userEmail:   c.userEmail,   firstName: c.firstName,
      hubSlug:     c.hubSlug,
      dateStr:     c.dateStr,
    });
  };
  for (const c of created) pushUser(c);
  for (const c of updated) pushUser(c);
  for (const r of replacedRows) pushUser(r.cand);

  const byDisplacedUser = new Map<string, ApplyResultSession[]>();
  for (const r of replacedRows) {
    const uid = r.conflict.currentHost.userId;
    if (!uid) continue;
    const u = displacedUserMap.get(uid);
    if (!u) continue;
    if (!byDisplacedUser.has(uid)) byDisplacedUser.set(uid, []);
    byDisplacedUser.get(uid)!.push({
      programName: r.cand.programName,
      dateLabel:   r.cand.dateLabel,
      userEmail:   u.email,
      firstName:   u.preferredName || u.firstName || null,
      hubSlug:     r.cand.hubSlug,
      dateStr:     r.cand.dateStr,
    });
  }

  return { filled, replaced, kept, byUser, byDisplacedUser };
}

/**
 * A session a rotation made, emptied by hand (released or removed), stays
 * empty: record a skip so the daily rotation run doesn't fill it again the
 * next morning (2026-10-15; it used to re-add the person and re-email them).
 *
 * A seat the person had claimed themselves before their rotation existed
 * carries no rotation id, and the run skips it as "already covered" while it
 * is theirs. Emptied, it would be filled again the next morning, so its date
 * is held on each of their rotations that would fill it (ruleFillsDate,
 * 2026-10-19 audit). A date that is another person's rotation date is left
 * for that rotation.
 */
export async function holdRotationDate(
  assignment: {
    standingAssignmentId: string | null;
    sessionDate: Date | null;
    userId?: string | null;
    programSlug?: string;
    hubSlug?: string;
  },
  byUserId: string,
  client: Pick<typeof db, "standingSkip" | "standingAssignment" | "program"> = db,
) {
  if (!assignment.sessionDate) return;
  const dateStr = ctDateStr(assignment.sessionDate.toISOString());
  let ruleIds: string[] = [];
  if (assignment.standingAssignmentId) {
    ruleIds = [assignment.standingAssignmentId];
  } else if (assignment.userId && assignment.programSlug && assignment.hubSlug) {
    const program = await client.program.findUnique({
      where: { slug: assignment.programSlug },
      select: RULE_PROGRAM_SELECT,
    });
    const rules = program
      ? await client.standingAssignment.findMany({
          where: { userId: assignment.userId, programSlug: assignment.programSlug, hubSlug: assignment.hubSlug },
          select: { id: true, dayOfWeek: true, occurrence: true, cycleStart: true, startsOn: true, endsOn: true },
        })
      : [];
    ruleIds = rules.filter((r) => ruleFillsDate(r, program as ScheduleProgram, dateStr)).map((r) => r.id);
  }
  for (const standingAssignmentId of ruleIds) {
    await client.standingSkip.upsert({
      where: { standingAssignmentId_dateStr: { standingAssignmentId, dateStr } },
      create: { standingAssignmentId, dateStr, createdById: byUserId },
      update: {},
    });
  }
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Take one person off their upcoming sessions (2026-10-16 audit: the member
 * release, archiving and account deletion each did this differently, and
 * archiving didn't do it at all). Within one team (`hubSlug`) or all.
 *
 * - An open sign-up team's sign-up is removed; a one-person team's seat is
 *   emptied and its open cover request closed (FK-safe throughout).
 * - `endRotations`: their rotations go too (archive, delete). Otherwise each
 *   rotation date is held so their rotation won't put them back when they
 *   return (a pause).
 *
 * Returns the sessions they were taken off, for telling them. Run inside the
 * caller's transaction.
 */
export async function releasePersonCoverage(
  tx: Tx,
  userId: string,
  byUserId: string,
  opts: {
    hubSlug?: string;
    endRotations: boolean;
    /** Why, for the team's record ("paused", "inactive", "archived", "deleted"). */
    reason?: string;
    /** The daily pass did it, not a person. */
    bySystem?: boolean;
  },
): Promise<{ rows: { userId: string; hubSlug: string; programSlug: string; sessionDate: Date | null }[]; rotations: number }> {
  const rows = await tx.hostAssignment.findMany({
    where: {
      userId,
      ...(opts.hubSlug ? { hubSlug: opts.hubSlug } : {}),
      OR: [{ sessionDate: null }, { sessionDate: { gte: new Date() } }],
    },
    select: { id: true, hubSlug: true, programSlug: true, standingAssignmentId: true, sessionDate: true },
  });
  const openSignUp = new Set(
    (await tx.hub.findMany({
      where: { slug: { in: [...new Set(rows.map((r) => r.hubSlug))] }, allowsMultipleAssignments: true },
      select: { slug: true },
    })).map((h) => h.slug),
  );
  if (!opts.endRotations) for (const r of rows) await holdRotationDate({ ...r, userId }, byUserId, tx);
  const remove = rows.filter((r) => openSignUp.has(r.hubSlug)).map((r) => r.id);
  const empty = rows.filter((r) => !openSignUp.has(r.hubSlug)).map((r) => r.id);
  if (remove.length) {
    await tx.subClaim.deleteMany({ where: { request: { assignmentId: { in: remove } } } });
    await tx.subRequest.deleteMany({ where: { assignmentId: { in: remove } } });
    await tx.hostAssignment.deleteMany({ where: { id: { in: remove } } });
  }
  if (empty.length) {
    await tx.subRequest.updateMany({ where: { assignmentId: { in: empty }, status: "OPEN" }, data: { status: "CANCELLED" } });
    await tx.hostAssignment.updateMany({ where: { id: { in: empty } }, data: { userId: null } });
  }
  const rotationHubs = opts.endRotations
    ? (await tx.standingAssignment.findMany({ where: { userId, ...(opts.hubSlug ? { hubSlug: opts.hubSlug } : {}) }, select: { hubSlug: true } })).map((r) => r.hubSlug)
    : [];
  const rotations = opts.endRotations
    ? (await tx.standingAssignment.deleteMany({ where: { userId, ...(opts.hubSlug ? { hubSlug: opts.hubSlug } : {}) } })).count
    : 0;
  // The team's record, one line per team, for its leads and the person.
  const hubs = [...new Set([...rows.map((r) => r.hubSlug), ...rotationHubs])];
  await recordHubEvents(tx, hubs.map((hubSlug) => ({
    hubSlug,
    kind: "sessions-released" as const,
    actorId: opts.bySystem ? null : byUserId,
    subjectUserId: userId,
    count: rows.filter((r) => r.hubSlug === hubSlug && r.sessionDate).length,
    detail: {
      reason: opts.reason ?? null,
      rotationsEnded: rotationHubs.filter((h) => h === hubSlug).length,
      sessions: emptiedSessionKeys(rows.filter((r) => r.hubSlug === hubSlug)),
    },
  })));
  return {
    rows: rows.map((r) => ({ userId, hubSlug: r.hubSlug, programSlug: r.programSlug, sessionDate: r.sessionDate })),
    rotations,
  };
}
