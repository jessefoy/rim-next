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
  getOccurrenceInMonth,
  getTotalOccurrencesInMonth,
  getDayOfWeekOccurrenceInMonth,
  getTotalDayOfWeekOccurrencesInMonth,
  type ScheduleProgram,
} from "@/lib/scheduleUtils";
import type { StandingOccurrence } from "@prisma/client";

const TZ = "America/Chicago";

/** Occurrence enum → numeric. ALL/LAST resolved during candidate generation. */
const OCC_NUMBER: Partial<Record<StandingOccurrence, number>> = {
  FIRST: 1, SECOND: 2, THIRD: 3, FOURTH: 4, FIFTH: 5,
};

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

  // 2. Load programs
  const slugs = [...new Set(standingAssignments.map((sa) => sa.programSlug))];
  const programs = await db.program.findMany({
    where: { slug: { in: slugs }, archivedAt: null },
    select: {
      id: true, name: true, slug: true, programFormat: true,
      startDatetime: true, endDatetime: true,
      recurrenceFreq: true, recurrenceInterval: true,
      recurrenceDays: true, recurrenceCount: true,
    },
  });
  const programMap = new Map<string, ScheduleProgram>(
    programs.map((p) => [p.slug, p as ScheduleProgram])
  );

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

    // Pre-compute the date's weekday once
    const dateDow = DOW_FROM_INDEX[new Date(`${dateStr}T12:00:00`).getDay()];

    for (const sa of standingAssignments) {
      const program = programMap.get(sa.programSlug);
      if (!program) continue;

      // Respect startsOn / endsOn
      if (dateStr < ctDateStr(sa.startsOn.toISOString())) continue;
      if (sa.endsOn && new Date(dateStr + "T12:00:00") > sa.endsOn) continue;

      if (!isOccurrenceOnDate(program, dateStr)) continue;

      // Day-of-week scope. v3 requires dayOfWeek to be set explicitly; null
      // rotations are legacy from v2 (before the column existed) and the
      // migration backfilled what it could. Skip any remaining null rows
      // so they don't fire on every weekday and compete with new editor-
      // created rotations.
      if (!sa.dayOfWeek) continue;
      if (sa.dayOfWeek !== dateDow) continue;

      // Resolve occurrence pattern. When dayOfWeek is set, count occurrences
      // of THAT WEEKDAY in the month (not all program sessions). For null
      // dayOfWeek (legacy / single-day programs), use program-level occurrence.
      let matches = false;
      if (sa.occurrence === "ALL") {
        matches = true;
      } else if (sa.occurrence === "LAST") {
        const occ      = sa.dayOfWeek
          ? getDayOfWeekOccurrenceInMonth(dateStr)
          : getOccurrenceInMonth(dateStr, program);
        const totalOcc = sa.dayOfWeek
          ? getTotalDayOfWeekOccurrencesInMonth(dateStr)
          : getTotalOccurrencesInMonth(program, year, month);
        matches = occ === totalOcc;
      } else {
        const targetOcc = OCC_NUMBER[sa.occurrence];
        if (targetOcc === undefined) continue;
        const actualOcc = sa.dayOfWeek
          ? getDayOfWeekOccurrenceInMonth(dateStr)
          : getOccurrenceInMonth(dateStr, program);
        matches = actualOcc === targetOcc;
      }
      if (!matches) continue;

      // De-dupe within this generation pass — first (most-specific) wins.
      // The specificity sort above ensures FIRST/.../FIFTH come before ALL.
      // Keyed by hubSlug too (session 129) so an AV rotation and a host-team
      // rotation on the same program/date don't crowd each other out — they
      // claim independent slots in different hubs.
      const key = `${sa.programSlug}::${dateStr}::${sa.hubSlug}`;
      if (claimedKeys.has(key)) continue;
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

  for (const cand of candidates) {
    const key = `${cand.programSlug}::${cand.dateStr}::${cand.hubSlug}`;
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

    const hasSubCover = existing.subRequests.some(
      (sr) => sr.status === "CLAIMED" && sr.claim?.claimedById === existing.userId
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
    candidatesByKey.set(`${c.programSlug}::${c.dateStr}`, c);
  }

  // Build the actual write list. Open candidates split into two streams:
  // toCreate = no existing row (createMany), toUpdate = placeholder userId=null
  // row exists (must update by id to avoid unique-constraint skipDuplicates).
  const toCreate: OpenSlot[] = preview.openSessions.filter((c) => !c.existingHostAssignmentId);
  const toUpdate: OpenSlot[] = preview.openSessions.filter((c) =>  c.existingHostAssignmentId);
  const toReplace: Array<{ conflict: Conflict; cand: Candidate }> = [];

  for (const conf of preview.conflicts) {
    const cand = candidatesByKey.get(`${conf.programSlug}::${conf.dateStr}`);
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
      shouldReplace = true;
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
  await db.$transaction(async (tx) => {
    // 1. Create rows for slots that don't have any existing row at all.
    //    `hubSlug` carries the candidate's hub (session 129) so the row
    //    lands in the right team's scope — AV rotations write into the
    //    audio-visual hub, host-team rotations into host-team, etc.
    if (toCreate.length > 0) {
      await tx.hostAssignment.createMany({
        data: toCreate.map((c) => ({
          programSlug:          c.programSlug,
          hubSlug:              c.hubSlug,
          userId:               c.userId,
          sessionDate:          c.sessionDate,
          assignedBy:           c.userId, // self for standing — no manual assigner
          standingAssignmentId: c.standingAssignmentId,
        })),
        skipDuplicates: true,
      });
    }

    // 2. Update placeholder rows (userId=null) to point at the rotation host.
    //    These rows already exist in the DB so we can't CREATE — must UPDATE
    //    by id. We don't reset hubSlug here: the existing row's hubSlug
    //    is what bound it to the open-slot lookup in the first place,
    //    so it already matches the candidate's hub.
    for (const u of toUpdate) {
      await tx.hostAssignment.update({
        where: { id: u.existingHostAssignmentId! },
        data: {
          userId:               u.userId,
          sessionDate:          u.sessionDate,
          assignedBy:           u.userId,
          standingAssignmentId: u.standingAssignmentId,
        },
      });
    }

    // 3. Replace conflicts: update existing rows in place (keeps subRequest
    //    relationship integrity if any non-sub-cover ones exist)
    for (const r of toReplace) {
      await tx.hostAssignment.update({
        where: { id: r.conflict.hostAssignmentId },
        data: {
          userId:               r.cand.userId,
          sessionDate:          r.cand.sessionDate,  // canonicalize the t-o-d
          assignedBy:           r.cand.userId,
          standingAssignmentId: r.cand.standingAssignmentId,
        },
      });
    }
  });

  // ── Build result reports ───────────────────────────────────────────────
  // "filled" = slots that now have a host (creates + placeholder-updates)
  const filled   = toCreate.length + toUpdate.length;
  const replaced = toReplace.length;
  const kept     = preview.conflicts.length - toReplace.length;

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
  for (const c of toCreate) pushUser(c);
  for (const c of toUpdate) pushUser(c);
  for (const r of toReplace) pushUser(r.cand);

  const byDisplacedUser = new Map<string, ApplyResultSession[]>();
  for (const r of toReplace) {
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
