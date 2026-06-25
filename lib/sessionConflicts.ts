/**
 * Predictive Zoom seat-conflict detection (Layer 2).
 *
 * The runtime seat pick (lib/sessionMeeting.ts) only learns about a conflict at
 * JOIN time, against meetings that already exist — too late, and blind to the
 * schedule. This computes, from the schedules alone, where more virtual/hybrid
 * occurrences overlap than there are Zoom seats, so a coordinator is warned at
 * save time instead of a host hitting "all seats busy" at the start of a session.
 *
 * The overlap window per occurrence is [start, end] — exactly the
 * [sessionDate, endTime] window the seat pick compares (lib/sessionMeeting.ts,
 * fed by getActiveSessionWindow) — so a warning predicts what the seat pick will
 * actually do at runtime, no more, no less.
 */

import { db } from "@/lib/db";
import {
  ctDateStr,
  isOccurrenceOnDate,
  shiftToDate,
  type ScheduleProgram,
} from "@/lib/scheduleUtils";
import { FALLBACK_DURATION_MIN } from "@/lib/sessionWindowConstants";
import { zoomSeatCount } from "@/lib/sessionMeeting";

const DEFAULT_WEEKS = 8;

interface ProgramRow extends ScheduleProgram {
  slug: string;
  name: string;
}

interface Interval {
  start: Date;
  end: Date;
}

export interface SeatConflict {
  /** ISO start of the earliest conflicting occurrence in the window. */
  when: string;
  /** Zoom seat capacity at the time of the check. */
  capacity: number;
  /** All programs whose occurrences overlap at that moment (incl. the subject). */
  programs: { slug: string; name: string }[];
  /** True if the same conflict recurs within the look-ahead window. */
  recurring: boolean;
  /** A ready-to-show plain-English line for the editor. */
  message: string;
}

const whenFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const todFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hour: "numeric",
  minute: "2-digit",
});

/** Occurrence windows [start, end] for a program over the next `weeks`. */
function enumerateOccurrences(p: ProgramRow, weeks: number): Interval[] {
  if (!p.startDatetime) return [];
  const anchorIso = p.startDatetime.toISOString();
  const endIso = p.endDatetime ? p.endDatetime.toISOString() : null;
  // Anchor on noon UTC so +24h always lands on the next CT calendar day (no DST
  // skip/dup) — the same day-walk getActiveSessionWindow uses.
  const baseMs = new Date(ctDateStr(new Date().toISOString()) + "T12:00:00Z").getTime();
  const out: Interval[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const dateCT = ctDateStr(new Date(baseMs + i * 86_400_000).toISOString());
    if (!isOccurrenceOnDate(p, dateCT)) continue;
    const start = shiftToDate(anchorIso, dateCT);
    const end = endIso
      ? shiftToDate(endIso, dateCT)
      : new Date(start.getTime() + FALLBACK_DURATION_MIN * 60_000);
    out.push({ start, end });
  }
  return out;
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * Seat conflicts that INVOLVE the given program, over the look-ahead window.
 * Empty when the program isn't virtual/hybrid, has no schedule, no seats are
 * configured, or nothing overlaps beyond capacity.
 */
export async function conflictsForProgram(
  slug: string,
  opts: { weeks?: number } = {},
): Promise<SeatConflict[]> {
  const weeks = opts.weeks ?? DEFAULT_WEEKS;
  const capacity = zoomSeatCount();
  if (capacity === 0) return [];

  const programs = (await db.program.findMany({
    where: {
      programFormat: { in: ["virtual", "hybrid"] },
      startDatetime: { not: null },
    },
    select: {
      slug: true,
      name: true,
      startDatetime: true,
      endDatetime: true,
      recurrenceFreq: true,
      recurrenceInterval: true,
      recurrenceDays: true,
      recurrenceCount: true,
    },
  })) as ProgramRow[];

  const target = programs.find((p) => p.slug === slug);
  if (!target) return [];
  const targetOccs = enumerateOccurrences(target, weeks);
  if (targetOccs.length === 0) return [];

  const others = programs
    .filter((p) => p.slug !== slug)
    .map((p) => ({ p, occs: enumerateOccurrences(p, weeks) }));

  // Group by (program-set + time-of-day) so a weekly overlap reports once, with
  // the earliest date and a "recurring" flag.
  const byKey = new Map<
    string,
    { when: Date; programs: { slug: string; name: string }[]; count: number }
  >();

  for (const t of targetOccs) {
    const overlapping = others.filter((o) => o.occs.some((occ) => overlaps(occ, t)));
    if (overlapping.length + 1 <= capacity) continue;
    const progs = [
      { slug: target.slug, name: target.name },
      ...overlapping.map((o) => ({ slug: o.p.slug, name: o.p.name })),
    ];
    const key = progs.map((x) => x.slug).sort().join("|") + "@" + todFmt.format(t.start);
    const cur = byKey.get(key);
    if (!cur) byKey.set(key, { when: t.start, programs: progs, count: 1 });
    else cur.count += 1; // keep the earliest `when`
  }

  return [...byKey.values()].map((c) => {
    const otherNames = c.programs.filter((p) => p.slug !== slug).map((p) => p.name);
    const recurring = c.count > 1;
    return {
      when: c.when.toISOString(),
      capacity,
      programs: c.programs,
      recurring,
      message:
        `Around ${whenFmt.format(c.when)} CT this overlaps ${joinNames(otherNames)} — ` +
        `that's ${c.programs.length} sessions needing a Zoom seat, but there are only ${capacity}.` +
        (recurring ? " (repeats in the next several weeks)" : ""),
    };
  });
}
