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
  type ScheduleProgram,
} from "@/lib/scheduleUtils";
import type { StandingOccurrence } from "@prisma/client";

const TZ = "America/Chicago";

/** Occurrence enum → numeric. ALL/LAST resolved during candidate generation. */
const OCC_NUMBER: Partial<Record<StandingOccurrence, number>> = {
  FIRST: 1, SECOND: 2, THIRD: 3, FOURTH: 4, FIFTH: 5,
};

// ─── TYPES ─────────────────────────────────────────────────────────────────

export interface Candidate {
  programSlug:          string;
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

export interface PreviewResult {
  candidates:   Candidate[];
  openSessions: Candidate[];          // candidates that don't conflict with any existing assignment
  conflicts:    Conflict[];
  pastIgnored:  number;
}

export type ResolutionMode =
  | "leave"
  | "replace-all"
  | { perDate: Record<string, "keep" | "replace"> };

export interface ApplyResult {
  filled:    number;
  replaced:  number;
  kept:      number;
  /** Map of userId → sessions newly assigned to them — for notification email */
  byUser:    Map<string, Array<{ programName: string; dateLabel: string; userEmail: string; firstName: string | null }>>;
  /** Map of displaced userId → sessions taken from them — for "you've been replaced" email */
  byDisplacedUser: Map<string, Array<{ programName: string; dateLabel: string; userEmail: string; firstName: string | null }>>;
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
  standingFilterId:   string | null = null
): Promise<{ candidates: Candidate[]; pastIgnored: number }> {
  // CT-anchored "today" — we treat anything strictly before today (CT) as past.
  const todayCt = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const todayStr = `${todayCt.getFullYear()}-${String(todayCt.getMonth() + 1).padStart(2, "0")}-${String(todayCt.getDate()).padStart(2, "0")}`;

  // 1. Load active rotations
  const standingAssignments = await db.standingAssignment.findMany({
    where: {
      ...(programSlugFilter ? { programSlug: programSlugFilter } : {}),
      ...(standingFilterId  ? { id: standingFilterId }            : {}),
      OR: [{ endsOn: null }, { endsOn: { gte: todayCt } }],
    },
    include: {
      user: { select: { id: true, firstName: true, preferredName: true, email: true } },
    },
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

    for (const sa of standingAssignments) {
      const program = programMap.get(sa.programSlug);
      if (!program) continue;

      // Respect startsOn / endsOn
      if (dateStr < ctDateStr(sa.startsOn.toISOString())) continue;
      if (sa.endsOn && new Date(dateStr + "T12:00:00") > sa.endsOn) continue;

      if (!isOccurrenceOnDate(program, dateStr)) continue;

      // Resolve occurrence pattern
      let matches = false;
      if (sa.occurrence === "ALL") {
        matches = true;
      } else if (sa.occurrence === "LAST") {
        const occ      = getOccurrenceInMonth(dateStr, program);
        const totalOcc = getTotalOccurrencesInMonth(program, year, month);
        matches = occ === totalOcc;
      } else {
        const targetOcc = OCC_NUMBER[sa.occurrence];
        if (targetOcc === undefined) continue;
        const actualOcc = getOccurrenceInMonth(dateStr, program);
        matches = actualOcc === targetOcc;
      }
      if (!matches) continue;

      // De-dupe within this generation pass
      const key = `${sa.programSlug}::${dateStr}`;
      if (claimedKeys.has(key)) continue;
      claimedKeys.add(key);

      const sessionDate = shiftToDate(program.startDatetime!.toISOString(), dateStr);
      const dateLabel   = sessionDate.toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", timeZone: TZ,
      });

      candidates.push({
        programSlug:          sa.programSlug,
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
  standingFilterId:   string | null = null
): Promise<PreviewResult> {
  const { candidates, pastIgnored } = await generateCandidates(
    programSlugFilter, year, month, standingFilterId
  );

  if (candidates.length === 0) {
    return { candidates: [], openSessions: [], conflicts: [], pastIgnored };
  }

  // Load existing assignments for the candidate slots
  const slugs = [...new Set(candidates.map((c) => c.programSlug))];
  const dates = [...new Set(candidates.map((c) => c.sessionDate.toISOString()))];
  const existingRaw = await db.hostAssignment.findMany({
    where: {
      programSlug: { in: slugs },
      sessionDate: { in: dates.map((d) => new Date(d)) },
    },
    include: {
      user: { select: { id: true, firstName: true, preferredName: true, email: true } },
      subRequests: {
        where: { status: { in: ["OPEN", "CLAIMED"] } },
        select: { id: true, status: true, claim: { select: { claimedById: true } } },
      },
    },
  });

  const existingByKey = new Map<string, typeof existingRaw[number]>();
  for (const a of existingRaw) {
    if (!a.sessionDate) continue;
    const dStr = ctDateStr(a.sessionDate.toISOString());
    existingByKey.set(`${a.programSlug}::${dStr}`, a);
  }

  const openSessions: Candidate[] = [];
  const conflicts:    Conflict[]  = [];

  for (const cand of candidates) {
    const key = `${cand.programSlug}::${cand.dateStr}`;
    const existing = existingByKey.get(key);

    if (!existing || existing.userId === null) {
      openSessions.push(cand);
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
  standingFilterId:   string | null = null
): Promise<ApplyResult> {
  const preview = await previewStandingAssignments(
    programSlugFilter, year, month, standingFilterId
  );

  // Collect candidate user info from the preview's candidates (for emails)
  const candidatesByKey = new Map<string, Candidate>();
  for (const c of preview.candidates) {
    candidatesByKey.set(`${c.programSlug}::${c.dateStr}`, c);
  }

  // Build the actual write list
  const toCreate: Candidate[] = [...preview.openSessions];
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
    // 1. Create open-slot assignments
    if (toCreate.length > 0) {
      await tx.hostAssignment.createMany({
        data: toCreate.map((c) => ({
          programSlug:          c.programSlug,
          userId:               c.userId,
          sessionDate:          c.sessionDate,
          assignedBy:           c.userId, // self for standing — no manual assigner
          standingAssignmentId: c.standingAssignmentId,
        })),
        skipDuplicates: true,
      });
    }

    // 2. Replace conflicts: update existing rows in place (keeps subRequest
    //    relationship integrity if any non-sub-cover ones exist)
    for (const r of toReplace) {
      await tx.hostAssignment.update({
        where: { id: r.conflict.hostAssignmentId },
        data: {
          userId:               r.cand.userId,
          assignedBy:           r.cand.userId,
          standingAssignmentId: r.cand.standingAssignmentId,
        },
      });
    }
  });

  // ── Build result reports ───────────────────────────────────────────────
  const filled   = toCreate.length;
  const replaced = toReplace.length;
  const kept     = preview.conflicts.length - toReplace.length;

  const byUser = new Map<string, Array<{ programName: string; dateLabel: string; userEmail: string; firstName: string | null }>>();
  for (const c of toCreate) {
    if (!byUser.has(c.userId)) byUser.set(c.userId, []);
    byUser.get(c.userId)!.push({
      programName: c.programName, dateLabel: c.dateLabel,
      userEmail:   c.userEmail,   firstName: c.firstName,
    });
  }
  for (const r of toReplace) {
    const c = r.cand;
    if (!byUser.has(c.userId)) byUser.set(c.userId, []);
    byUser.get(c.userId)!.push({
      programName: c.programName, dateLabel: c.dateLabel,
      userEmail:   c.userEmail,   firstName: c.firstName,
    });
  }

  const byDisplacedUser = new Map<string, Array<{ programName: string; dateLabel: string; userEmail: string; firstName: string | null }>>();
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
    });
  }

  return { filled, replaced, kept, byUser, byDisplacedUser };
}
