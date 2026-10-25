/**
 * Program → Hub lookup helpers.
 *
 * Every program has a hosting hub. By default this is `host-team` (RIM's
 * operational host volunteer team), but the `Program.hostingHubSlug` column
 * lets a coordinator transfer hosting authority to a different hub —
 * `peer-led-silent-meditation` for community-led silent sits, future hubs
 * for Recovery Dharma, skills classes, etc.
 *
 * It also holds the shared Scheduler rules: which team may staff a program
 * (`teamCannotStaff`, `hostingTeamRefusal`, `supportingTeamRefusal`), and the
 * cleanups when that changes. (The teacher-pill settings this header once
 * described, `assignmentGrantsTeacher` and `teacherLabel`, were retired
 * 2026-10-16; their columns stay on the record, unused.)
 *
 * Why slug, not FK? `HostAssignment.programSlug` already uses slug as the
 * join key. Programs and hubs share that convention; slugs are stable once
 * assignments exist (per CLAUDE.md). A FK would have to be nullable too,
 * which gives us the same migration profile without the cascade complexity.
 */

import { db } from "@/lib/db";
import { emptiedSessionKeys, recordHubEvent, recordHubEvents } from "@/lib/hubEvents";
import {
  ctDateStr, dateToDayCode, getDayOfWeekOccurrenceInMonth, getTotalDayOfWeekOccurrencesInMonth,
  isCycleOccurrence, isCycleWeek, isOccurrenceOnDate, meetsEveryWeek, type ScheduleProgram,
} from "@/lib/scheduleUtils";

/** The implicit default hub when `Program.hostingHubSlug` is null. */
export const DEFAULT_HOSTING_HUB_SLUG = "host-team" as const;

/** A program's resolved hosting team. */
export interface ProgramHostingHub {
  /** The effective slug — always populated. `null` source resolves to host-team. */
  hubSlug: string;
}

/**
 * Look up the effective hosting hub slug for a program. Always returns a
 * string — `null` in the column resolves to `host-team`.
 *
 * Used by capability gates that don't need the hub config record
 * (e.g. notification-recipient lookups).
 */
export async function getProgramHubSlug(programSlug: string): Promise<string> {
  const program = await db.program.findUnique({
    where: { slug: programSlug },
    select: { hostingHubSlug: true },
  });
  return program?.hostingHubSlug ?? DEFAULT_HOSTING_HUB_SLUG;
}

/**
 * A program's hosting team, resolved (null in the column is host-team).
 * Returns null only when the program doesn't exist. Used by
 * `resolveSessionRole`. (It also returned the teacher-pill settings, retired
 * 2026-10-16; `resolveTeacherPillLabel` went with them.)
 */
export async function getProgramHostingHub(
  programSlug: string,
): Promise<ProgramHostingHub | null> {
  const program = await db.program.findUnique({
    where: { slug: programSlug },
    select: { hostingHubSlug: true },
  });
  if (!program) return null;
  return { hubSlug: program.hostingHubSlug ?? DEFAULT_HOSTING_HUB_SLUG };
}

// ───────────────────────────────────────────────────────────────────────────
// Auxiliary-hub coverage (session 129 — AV + Greeter hubs).
//
// A program has one primary hosting hub (above) plus zero-or-more auxiliary
// hubs that schedule supporting roles for it. Auxiliary hubs are joined via
// the `ProgramCoverageHub` table; the program's slug is the join key.
// ───────────────────────────────────────────────────────────────────────────

/**
 * List the slugs of every auxiliary hub providing coverage for a program.
 * Does not include the primary hub. Returns [] when nothing's configured.
 *
 * Used by the Scheduler page to union primary + auxiliary programs for the
 * active hub's view, and by the ProgramEditor's Who's helping section to
 * pre-populate the checkbox list.
 */
export async function getProgramCoverageHubs(
  programSlug: string,
): Promise<string[]> {
  const rows = await db.programCoverageHub.findMany({
    where: { programSlug },
    select: { hubSlug: true },
  });
  return rows.map((r) => r.hubSlug);
}

/**
 * The reverse direction: list every program slug that a given hub covers
 * (whether primary or auxiliary). Used by the Scheduler page query.
 *
 * The result is the union of:
 *   1. Programs where `hostingHubSlug` equals this hub (or null + this is host-team)
 *   2. Programs that have an explicit `ProgramCoverageHub` row pointing here
 */
export async function getProgramSlugsForHub(hubSlug: string): Promise<string[]> {
  const primaryFilter = hubSlug === DEFAULT_HOSTING_HUB_SLUG
    ? { OR: [{ hostingHubSlug: null }, { hostingHubSlug: DEFAULT_HOSTING_HUB_SLUG }] }
    : { hostingHubSlug: hubSlug };

  const [primaryRows, coverageRows] = await Promise.all([
    db.program.findMany({
      // `hostingRequired: true` excludes "No host needed" programs from their
      // PRIMARY hosting hub's view (host-team / peer-led) — a self-led offering
      // (Recovery Dharma, drop-in groups) never surfaces as "Needs Coverage"
      // there. It does NOT touch auxiliary coverage (below): "No host needed"
      // governs the primary host only; AV/greeter coverage is an independent
      // per-hub decision.
      where: { ...primaryFilter, archivedAt: null, hostingRequired: true },
      select: { slug: true },
    }),
    db.programCoverageHub.findMany({
      where: { hubSlug },
      select: { programSlug: true },
    }),
  ]);

  const slugs = new Set<string>();
  for (const p of primaryRows) slugs.add(p.slug);

  // Auxiliary coverage (AV / greeter): filter archived only, NOT hostingRequired.
  // "No host needed" scopes to the primary host — it must not strip explicitly-
  // configured supporting-role coverage. A self-led in-person group that a
  // coordinator put on greeter coverage still appears in the greeter scheduler.
  const coverageSlugs = coverageRows.map((c) => c.programSlug);
  if (coverageSlugs.length > 0) {
    const liveCoverage = await db.program.findMany({
      where: { slug: { in: coverageSlugs }, archivedAt: null },
      select: { slug: true },
    });
    for (const p of liveCoverage) slugs.add(p.slug);
  }

  return [...slugs];
}

/**
 * True when a program needs scheduled host coverage (the default). False means
 * the program is flagged "No host needed" (self-led / community-led) — used by
 * the Scheduler mutation guards (assignment claim, rotation save) to refuse
 * creating coverage state for a self-led program even via a crafted request.
 * Unknown / missing program → true (fail safe: assume it needs a host).
 */
export async function programNeedsHost(programSlug: string): Promise<boolean> {
  const p = await db.program.findUnique({
    where: { slug: programSlug },
    select: { hostingRequired: true },
  });
  return p?.hostingRequired ?? true;
}

/** Resolved coverage config for one hub in one place — fetched once per page. */
export interface HubCoverageConfig {
  slug: string;
  appliesToFormats: string[];
  allowsMultipleAssignments: boolean;
}

/** Role-aware copy strings for one hub. Session 130 follow-up — UI and email
 *  copy that used to hardcode "host" now reads from these. Defaults preserve
 *  host-team language. */
export interface HubCoverageCopy {
  noun:   string; // "Host" / "AV" / "Greeter" / "Facilitator"
  verb:   string; // "hosting" / "covering AV" / "greeting" / "facilitating"
  action: string; // "host this" / "cover AV" / "greet" / "facilitate"
}

export const DEFAULT_COVERAGE_COPY: HubCoverageCopy = {
  noun:   "Host",
  verb:   "hosting",
  action: "host this",
};

/**
 * Load role-aware copy for a hub. Returns defaults ("Host" / "hosting" /
 * "host this") when the hub doesn't exist or its config is missing. UI
 * surfaces (Schedule cards, toasts) and email builders read from this
 * so each hub speaks its own language without code branches per hub.
 * Configured per-hub via `/admin/hubs` and seeded by the migration
 * `add_hub_coverage_copy_v1`.
 */
export async function getHubCoverageCopy(hubSlug: string): Promise<HubCoverageCopy> {
  const hub = await db.hub.findUnique({
    where: { slug: hubSlug },
    select: { coverageNoun: true, coverageVerb: true, coverageAction: true },
  });
  if (!hub) return DEFAULT_COVERAGE_COPY;
  return {
    noun:   hub.coverageNoun   ?? DEFAULT_COVERAGE_COPY.noun,
    verb:   hub.coverageVerb   ?? DEFAULT_COVERAGE_COPY.verb,
    action: hub.coverageAction ?? DEFAULT_COVERAGE_COPY.action,
  };
}

/**
 * Load coverage-relevant config for a hub. Returns null when the hub doesn't
 * exist (caller decides whether that's an error or a fallthrough to defaults).
 *
 * Used by the Scheduler page (format filter), the assignments POST (multi-claim
 * gate), and the standing-assignments routes.
 */
export async function getHubCoverageConfig(
  hubSlug: string,
): Promise<HubCoverageConfig | null> {
  const hub = await db.hub.findUnique({
    where: { slug: hubSlug },
    select: { slug: true, appliesToFormats: true, allowsMultipleAssignments: true },
  });
  if (!hub) return null;
  return {
    slug: hub.slug,
    appliesToFormats: hub.appliesToFormats ?? ["virtual", "hybrid"],
    allowsMultipleAssignments: hub.allowsMultipleAssignments ?? false,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// One resolver and one eligibility rule (2026-10-15 Scheduler integrity audit:
// "hostingHubSlug ?? host-team" was inlined at a dozen sites, and which team
// may staff which program was checked only where the schedule is shown, never
// where it is changed).
// ───────────────────────────────────────────────────────────────────────────

/**
 * May this team be ticked as a program's supporting team (Auxiliary role
 * coverage)? Active, a supporting team (not one that runs sessions), the
 * Scheduler installed, and the program's format among the team's. The
 * editor's list applies the same rule; the server checked only that the team
 * existed (2026-10-16 audit). Returns why not, or null.
 */
export async function supportingTeamRefusal(hubSlug: string, programFormat: string | null): Promise<string | null> {
  const hub = await db.hub.findUnique({
    where: { slug: hubSlug },
    select: {
      name: true, status: true, hasSchedule: true, appliesToFormats: true,
      appLinks: { where: { toolSlug: "schedule", isEnabled: true }, select: { id: true }, take: 1 },
    },
  });
  if (!hub) return `Unknown team: ${hubSlug}`;
  if (hub.status !== "ACTIVE") return `${hub.name} is archived.`;
  if (hub.hasSchedule) return `${hub.name} runs sessions itself; choose it as the Hosting team instead.`;
  if (hub.appLinks.length === 0) return `${hub.name} doesn't have the Scheduler installed yet.`;
  if (!programFormat || !hub.appliesToFormats.includes(programFormat)) {
    return `${hub.name} doesn't staff ${programFormat ?? "unformatted"} sessions.`;
  }
  return null;
}

/**
 * May this team be chosen as a program's Hosting team? It must run sessions
 * (`hasSchedule`), be active, and have the Scheduler installed, or the
 * program would be hosted by a team with no schedule to staff it (2026-10-15
 * audit). Returns why not, in words for the editor, or null when it may.
 * The editor's list applies the same rule.
 */
export async function hostingTeamRefusal(hubSlug: string, programFormat?: string | null): Promise<string | null> {
  const hub = await db.hub.findUnique({
    where: { slug: hubSlug },
    select: {
      name: true, status: true, hasSchedule: true, appliesToFormats: true,
      appLinks: { where: { toolSlug: "schedule", isEnabled: true }, select: { id: true }, take: 1 },
    },
  });
  if (!hub) return `Unknown team: ${hubSlug}`;
  if (hub.status !== "ACTIVE") return `${hub.name} is archived, so it can't host programs.`;
  if (!hub.hasSchedule) return `${hub.name} staffs a supporting role. Choose it under Supporting teams instead.`;
  if (hub.appLinks.length === 0) return `${hub.name} doesn't have the Scheduler installed yet, so it can't host programs.`;
  // The program's format must be one the team staffs, or the program shows
  // on no schedule at all (2026-10-16 audit).
  if (programFormat && !hub.appliesToFormats.includes(programFormat)) {
    return `${hub.name} doesn't staff ${programFormat} sessions. Choose another hosting team, or add ${programFormat} to the team's formats in /admin/hubs.`;
  }
  return null;
}

/** A program's hosting team: its own setting, else the Hosting Team. */
export function resolveHostingHubSlug(p: { hostingHubSlug?: string | null } | null | undefined): string {
  return p?.hostingHubSlug ?? DEFAULT_HOSTING_HUB_SLUG;
}

/**
 * Why this team can't staff this program, or null when it can. The rule every
 * write to the schedule checks (assignments, rotations, reassign) and the
 * rotation engine mirrors: the team exists, is active and has the Scheduler
 * installed; the program exists and isn't archived; the team is its hosting
 * team or a covering team; the program's format is one the team serves; and
 * on the hosting team, the program needs a host.
 */
export type StaffRefusal = {
  code: "no-scheduler" | "not-running" | "not-covering" | "wrong-format" | "no-host-needed";
  message: string;
};

export async function teamCannotStaff(hubSlug: string, programSlug: string): Promise<StaffRefusal | null> {
  const [hub, program, covering] = await Promise.all([
    db.hub.findUnique({
      where: { slug: hubSlug },
      select: {
        status: true,
        appliesToFormats: true,
        appLinks: { where: { toolSlug: "schedule", isEnabled: true }, select: { id: true } },
      },
    }),
    db.program.findUnique({
      where: { slug: programSlug },
      select: { archivedAt: true, programFormat: true, hostingHubSlug: true, hostingRequired: true },
    }),
    db.programCoverageHub.findUnique({
      where: { programSlug_hubSlug: { programSlug, hubSlug } },
      select: { hubSlug: true },
    }),
  ]);
  if (!hub || hub.status !== "ACTIVE" || hub.appLinks.length === 0) return { code: "no-scheduler", message: "This team doesn't use the Scheduler." };
  if (!program || program.archivedAt) return { code: "not-running", message: "This program isn't running." };
  const isHosting = resolveHostingHubSlug(program) === hubSlug;
  if (!isHosting && !covering) return { code: "not-covering", message: "This team doesn't cover this program." };
  if (!program.programFormat || !(hub.appliesToFormats ?? []).includes(program.programFormat)) {
    return { code: "wrong-format", message: "This team doesn't cover this kind of session." };
  }
  if (isHosting && !program.hostingRequired) return { code: "no-host-needed", message: 'This program is marked "No host needed".' };
  return null;
}

/**
 * After a program changes, clear the future coverage of any team that no
 * longer staffs it (unticked as a covering team, or the format left the
 * team's set). Past sessions stay as history; an archived program is left
 * alone (archiving can be undone). Same FK-safe order as every coverage
 * delete: SubClaim → SubRequest → HostAssignment, then the team's rotations.
 * Returns what was cleared, per team, for the log.
 */
export async function clearCoverageNoLongerStaffed(
  programSlug: string,
  /** Only these teams are judged: the ones this save changed. Old leftovers
   *  on other teams are not swept up by an unrelated save (2026-10-15 review). */
  onlyHubs: string[],
): Promise<{ hubSlug: string; assignments: number; rotations: number; rows: { userId: string | null; hubSlug: string; programSlug: string; sessionDate: Date | null }[] }[]> {
  if (onlyHubs.length === 0) return [];
  const program = await db.program.findUnique({ where: { slug: programSlug }, select: { archivedAt: true } });
  if (!program || program.archivedAt) return [];
  const now = new Date();
  const [assignmentHubs, rotationHubs] = await Promise.all([
    db.hostAssignment.findMany({
      where: { programSlug, OR: [{ sessionDate: null }, { sessionDate: { gte: now } }] },
      select: { hubSlug: true },
      distinct: ["hubSlug"],
    }),
    db.standingAssignment.findMany({ where: { programSlug }, select: { hubSlug: true }, distinct: ["hubSlug"] }),
  ]);
  const hubs = [...new Set([...assignmentHubs, ...rotationHubs].map((r) => r.hubSlug))]
    .filter((h) => onlyHubs.includes(h));
  const cleared: { hubSlug: string; assignments: number; rotations: number; rows: { userId: string | null; hubSlug: string; programSlug: string; sessionDate: Date | null }[] }[] = [];
  for (const hubSlug of hubs) {
    // Only when the program itself says this team no longer covers it; a
    // switched-off Scheduler app is a setting, not a reason to clear coverage.
    const refusal = await teamCannotStaff(hubSlug, programSlug);
    if (!refusal || refusal.code === "no-scheduler" || refusal.code === "not-running") continue;
    const result = await db.$transaction(async (tx) => {
      const future = await tx.hostAssignment.findMany({
        where: { programSlug, hubSlug, OR: [{ sessionDate: null }, { sessionDate: { gte: now } }] },
        select: { id: true, userId: true, hubSlug: true, programSlug: true, sessionDate: true },
      });
      const ids = future.map((a) => a.id);
      if (ids.length) {
        await tx.subClaim.deleteMany({ where: { request: { assignmentId: { in: ids } } } });
        await tx.subRequest.deleteMany({ where: { assignmentId: { in: ids } } });
        await tx.hostAssignment.deleteMany({ where: { id: { in: ids } } });
      }
      const rot = await tx.standingAssignment.deleteMany({ where: { programSlug, hubSlug } });
      // The team's record, for its leads: the program's change took sessions off.
      if (ids.length || rot.count) {
        await recordHubEvent(tx, {
          hubSlug, kind: "sessions-released", actorId: null, subjectUserId: null, programSlug,
          count: future.filter((r) => r.userId).length,
          detail: { reason: "program-no-longer-staffed", rotationsEnded: rot.count, sessions: emptiedSessionKeys(future) },
        });
      }
      return { hubSlug, assignments: ids.length, rotations: rot.count, rows: future.map((r) => ({ userId: r.userId, hubSlug: r.hubSlug, programSlug: r.programSlug, sessionDate: r.sessionDate })) };
    });
    if (result.assignments || result.rotations) cleared.push(result);
  }
  return cleared;
}

/**
 * After a program's schedule changes (start date, days, frequency, count),
 * clear what no longer has a session to belong to: every team's upcoming
 * assignments on dates the program no longer meets, with their cover
 * requests (FK-safe: SubClaim → SubRequest → HostAssignment), and rotations
 * that can't match any meeting in the coming year (weekday and week). Jesse,
 * 2026-10-16: "I don't like a lot of junk in our system if it's not being
 * used." A program with no start date, or an archived one, is left alone.
 * Returns the cleared sessions (for telling the people who had them) and
 * the counts.
 */
export async function clearOffScheduleCoverage(programSlug: string): Promise<{
  sessions: { userId: string | null; hubSlug: string; sessionDate: Date }[];
  rotations: number;
}> {
  const program = await db.program.findUnique({
    where: { slug: programSlug },
    select: {
      id: true, name: true, slug: true, programFormat: true, archivedAt: true,
      startDatetime: true, endDatetime: true,
      recurrenceFreq: true, recurrenceInterval: true, recurrenceDays: true, recurrenceCount: true,
    },
  });
  if (!program || program.archivedAt || !program.startDatetime) return { sessions: [], rotations: 0 };
  const schedule = program as ScheduleProgram;
  const now = new Date();

  const future = await db.hostAssignment.findMany({
    where: { programSlug, sessionDate: { gte: now } },
    select: { id: true, userId: true, hubSlug: true, sessionDate: true },
  });
  const offDay = future.filter((a) => !isOccurrenceOnDate(schedule, ctDateStr(a.sessionDate!.toISOString())));

  // What a rotation could still match in the coming year (Central dates),
  // by the engine's own test: the weekday, its nth time in the month, and
  // whether it is the month's last (lib/applyStandingAssignments.ts). A
  // "2nd Tuesday" rotation dies when the program moves to the last Tuesday.
  const NTH = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH"];
  const canMatch = new Set<string>(); // "TU", "TU:SECOND", "TU:LAST"
  const meetingDays: string[] = []; // every meeting date, for every-other-week rules
  const start = new Date(`${ctDateStr(now.toISOString())}T12:00:00Z`);
  for (let i = 0; i < 366; i++) {
    const dateStr = new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    if (!isOccurrenceOnDate(schedule, dateStr)) continue;
    meetingDays.push(dateStr);
    const day = dateToDayCode(dateStr);
    const nth = getDayOfWeekOccurrenceInMonth(dateStr);
    canMatch.add(day);
    if (NTH[nth - 1]) canMatch.add(`${day}:${NTH[nth - 1]}`);
    if (nth === getTotalDayOfWeekOccurrencesInMonth(dateStr)) canMatch.add(`${day}:LAST`);
  }
  const deadRules = (await db.standingAssignment.findMany({
    where: { programSlug, dayOfWeek: { not: null } },
    select: { id: true, dayOfWeek: true, occurrence: true, cycleStart: true, hubSlug: true },
  })).filter((r) =>
    r.occurrence === "ALL"
      ? !canMatch.has(r.dayOfWeek!)
      : isCycleOccurrence(r.occurrence)
        // Every other week (2026-10-18): alive while one of its weeks still
        // lands on a meeting day of its weekday, and only while the program
        // meets every week: both rules end together. When a program moved to
        // every other week, one half could lose its dates and the other take
        // every session alone (2026-10-19 audit). Sessions already filled on
        // days it still meets stay with their person.
        ? !meetsEveryWeek(schedule) ||
          !meetingDays.some((d) => dateToDayCode(d) === r.dayOfWeek && isCycleWeek(r.occurrence, r.cycleStart, d))
        : !canMatch.has(`${r.dayOfWeek}:${r.occurrence}`),
  );

  if (offDay.length === 0 && deadRules.length === 0) return { sessions: [], rotations: 0 };
  const ids = offDay.map((a) => a.id);
  await db.$transaction(async (tx) => {
    if (ids.length) {
      await tx.subClaim.deleteMany({ where: { request: { assignmentId: { in: ids } } } });
      await tx.subRequest.deleteMany({ where: { assignmentId: { in: ids } } });
      await tx.hostAssignment.deleteMany({ where: { id: { in: ids } } });
    }
    if (deadRules.length) {
      await tx.standingAssignment.deleteMany({ where: { id: { in: deadRules.map((r) => r.id) } } });
    }
    // The team's record, for each team's leads: the new schedule took sessions off.
    const teams = [...new Set([...offDay.map((a) => a.hubSlug), ...deadRules.map((r) => r.hubSlug)])];
    await recordHubEvents(tx, teams.map((hubSlug) => ({
      hubSlug, kind: "sessions-released" as const, actorId: null, subjectUserId: null, programSlug,
      count: offDay.filter((a) => a.hubSlug === hubSlug && a.userId).length,
      detail: { reason: "schedule-changed", rotationsEnded: deadRules.filter((r) => r.hubSlug === hubSlug).length },
    })));
  });
  return {
    sessions: offDay.map((a) => ({ userId: a.userId, hubSlug: a.hubSlug, sessionDate: a.sessionDate! })),
    rotations: deadRules.length,
  };
}

/**
 * A team's name as it reads after "the": "Greeter team", but "Hosting Team"
 * as is (2026-10-16: "the Hosting Team team"). For sentences like "You're on
 * the …" and "The … no longer covers …".
 */
export function teamPhrase(name: string): string {
  return /\bteam$/i.test(name.trim()) ? name.trim() : `${name.trim()} team`;
}
