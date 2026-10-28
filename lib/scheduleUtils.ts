/**
 * Shared schedule utilities.
 *
 * Used by:
 *   - /tools/schedule (host schedule calendar)
 *   - /this-week (public weekly schedule)
 *
 * Core function: isOccurrenceOnDate() — determines whether a program
 * has a session on a given calendar date, accounting for weekly, daily,
 * monthly, bi-weekly, and single-event recurrence patterns.
 */

import { centralToUtc, toCentralDatetime } from "./timezone";

const TZ = "America/Chicago";

/**
 * Every-other-week rotations (2026-10-18): is this date one of this person's
 * weeks? Two people take turns week by week from `cycleStart` (the first
 * week-A session's Central day): week A is the start week and every second
 * week after it, week B the weeks between, whatever the calendar month does
 * (the week-of-month patterns drift after a month with a fifth weekday).
 * Dates before the start belong to neither. The one rule the rotation
 * engine, the schedule-change cleanup and the editor's preview all use.
 */
export function isCycleWeek(
  occurrence: string,
  cycleStart: string | null | undefined,
  dateStr: string,
): boolean {
  if ((occurrence !== "ALT_WEEK_A" && occurrence !== "ALT_WEEK_B") || !cycleStart) return false;
  const day = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const days = Math.round((day(dateStr) - day(cycleStart)) / 86_400_000);
  if (days < 0) return false;
  const week = Math.floor(days / 7);
  return occurrence === "ALT_WEEK_A" ? week % 2 === 0 : week % 2 === 1;
}

/**
 * Whether a program meets every week, the condition for an every-other-week
 * rotation: turns are counted in weeks, so on a program that already meets
 * every other week (or monthly) the second person would never get a turn.
 */
export function meetsEveryWeek(p: { recurrenceFreq?: string | null; recurrenceInterval?: number | null }): boolean {
  return p.recurrenceFreq === "WEEKLY" && (p.recurrenceInterval ?? 1) === 1;
}

/** True for the every-other-week pattern values. */
export function isCycleOccurrence(occurrence: string): boolean {
  return occurrence === "ALT_WEEK_A" || occurrence === "ALT_WEEK_B";
}

/** Format an ISO string to a CT date string: "YYYY-MM-DD" */
export function ctDateStr(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");
}

/**
 * The program's Update, if it is still current. The editor's "Show until" is a
 * CT day: the notice shows through that day and clears itself the next
 * morning. No date (the old behaviour, and every program before 2026-10-09)
 * means it stays until someone clears the text. Every renderer of the Update
 * goes through here, so a stale notice can never outlive its day.
 */
export function activeAnnouncement(p: {
  specialAnnouncement?: string | null;
  announcementUntil?: Date | string | null;
}, now: Date = new Date()): string | null {
  const text = p.specialAnnouncement?.trim();
  if (!text) return null;
  if (!p.announcementUntil) return text;
  const until = typeof p.announcementUntil === "string" ? new Date(p.announcementUntil) : p.announcementUntil;
  if (isNaN(until.getTime())) return text;
  const untilYmd = until.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const todayYmd = now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  return todayYmd <= untilYmd ? text : null;
}

/** "YYYY-MM-DD" from the editor → the stored day (noon UTC, so its CT date is
    that day whatever the offset); anything else → null; a bad string → undefined. */
export function parseAnnouncementUntil(input: unknown): Date | null | undefined {
  if (input == null || input === "") return null;
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return undefined;
  const d = new Date(input + "T12:00:00Z");
  return isNaN(d.getTime()) ? undefined : d;
}

/** iCal day codes indexed by JS getDay() (0=Sunday) */
export const ICAL_DAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Return the iCal day code for a "YYYY-MM-DD" date string */
export function dateToDayCode(dateStr: string): string {
  return ICAL_DAY[new Date(dateStr + "T12:00:00").getDay()];
}

/**
 * Shift a program's anchor datetime to a target calendar date.
 * Preserves the time-of-day while moving to the target date.
 */
export function shiftToDate(anchorISO: string, targetDate: string): Date {
  const anchor = new Date(anchorISO);
  if (ctDateStr(anchorISO) === targetDate) return anchor;
  // The anchor's Central wall-clock time, on the target day (2026-10-16:
  // adding whole 24-hour days kept the UTC time instead, so a program that
  // began in daylight time was placed an hour early all winter, and one
  // that began in standard time an hour late all summer).
  const wall = toCentralDatetime(anchor).slice(11, 16);
  const shifted = centralToUtc(`${targetDate}T${wall}`);
  if (shifted) return new Date(shifted.getTime() + (anchor.getTime() % 60_000));
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round(
    (new Date(targetDate + "T12:00:00").getTime() - new Date(ctDateStr(anchorISO) + "T12:00:00").getTime())
    / msPerDay
  );
  return new Date(anchor.getTime() + daysDiff * msPerDay);
}

/** Minimum program fields needed for schedule evaluation */
export interface ScheduleProgram {
  id: string;
  name: string;
  slug: string;
  programFormat: string | null;
  startDatetime: Date | null;
  endDatetime: Date | null;
  recurrenceFreq: string | null;
  recurrenceInterval: number | null;
  recurrenceDays: string[];
  recurrenceCount: number | null;
  /** A series that ends on a date (2026-10-28); null = by count, or ongoing. */
  recurrenceUntil: Date | null;
}

/**
 * Returns the 1-based occurrence number of this program session within its
 * calendar month. Counts how many times the program runs in that month up to
 * and including dateStr.
 *
 * e.g. if a program runs every Tuesday and dateStr is the 3rd Tuesday of the
 * month, this returns 3.
 *
 * Used by standing-assignment logic to match occurrence patterns (FIRST–FIFTH).
 */
export function getOccurrenceInMonth(dateStr: string, program: ScheduleProgram): number {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year  = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day   = parseInt(dayStr, 10);
  let count = 0;
  for (let d = 1; d <= day; d++) {
    const check = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (isOccurrenceOnDate(program, check)) count++;
  }
  return count;
}

/**
 * Returns the 1-based occurrence number of this date's WEEKDAY within its
 * calendar month. e.g. April 14, 2026 is a Tuesday, and the 2nd Tuesday of
 * April → returns 2.
 *
 * Used for multi-day programs where "1st of the month" is ambiguous —
 * coordinators think in terms of "1st Tuesday" not "1st program session."
 * The standing-assignment apply logic uses this when a rotation has a
 * dayOfWeek scope set.
 */
export function getDayOfWeekOccurrenceInMonth(dateStr: string): number {
  const [yStr, mStr, dStr] = dateStr.split("-");
  const year  = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const day   = parseInt(dStr, 10);
  const target = new Date(year, month - 1, day);
  const targetDow = target.getDay();
  let count = 0;
  for (let i = 1; i <= day; i++) {
    if (new Date(year, month - 1, i).getDay() === targetDow) count++;
  }
  return count;
}

/**
 * Returns the total number of times this date's WEEKDAY occurs in its month.
 * Used to resolve LAST occurrence semantics for weekday-scoped rotations
 * (varies by month — sometimes 4 Tuesdays, sometimes 5).
 */
export function getTotalDayOfWeekOccurrencesInMonth(dateStr: string): number {
  const [yStr, mStr] = dateStr.split("-");
  const year  = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const target = new Date(`${dateStr}T12:00:00`);
  const targetDow = target.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    if (new Date(year, month - 1, i).getDay() === targetDow) count++;
  }
  return count;
}

const WEEKDAY_NAME: Record<string, string> = {
  SU: "Sunday", MO: "Monday", TU: "Tuesday", WE: "Wednesday",
  TH: "Thursday", FR: "Friday", SA: "Saturday",
};
const MONTH_ORDINAL = ["", "1st", "2nd", "3rd", "4th", "5th"];

/**
 * Human phrase for a monthly recurrence anchored on a date: "last Sunday",
 * "2nd Wednesday". The weekday + position-in-month are derived from the date
 * itself; when it's the LAST occurrence of its weekday that month the phrase is
 * "last <weekday>" (stays "last" even in 5-occurrence months), otherwise the Nth.
 * Returns "" for a non-YYYY-MM-DD input. Shared by the MONTHLY occurrence branch
 * and every schedule-label builder (programUtils, dateLabel, the ProgramEditor
 * preview, and the migrate.mjs recache copy — keep those in lockstep).
 */
export function monthlyPatternPhrase(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return "";
  const weekday = WEEKDAY_NAME[dateToDayCode(dateStr)];
  if (!weekday) return "";
  const occ = getDayOfWeekOccurrenceInMonth(dateStr);
  const isLast = occ === getTotalDayOfWeekOccurrencesInMonth(dateStr);
  const ord = isLast ? "last" : (MONTH_ORDINAL[occ] ?? "");
  return ord ? `${ord} ${weekday}` : "";
}

/**
 * Returns the total number of times this program runs in the given calendar
 * month. Used by standing-assignment logic to resolve the LAST occurrence
 * (varies by month — sometimes 4, sometimes 5).
 */
export function getTotalOccurrencesInMonth(
  program: ScheduleProgram,
  year: number,
  month: number  // 1-based
): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const check = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (isOccurrenceOnDate(program, check)) count++;
  }
  return count;
}

/**
 * Find the next date on or after fromDateStr when this program has a session.
 * Returns "YYYY-MM-DD" in Central Time, or null if no occurrence falls within
 * the next maxDays.
 */
export function nextOccurrenceOnOrAfter(
  p: ScheduleProgram,
  fromDateStr: string,
  maxDays = 90
): string | null {
  if (!p.startDatetime) return null;
  // For non-recurring programs whose anchor is already in the past, no future
  // occurrence exists — skip the day-walk loop.
  if (!p.recurrenceFreq) {
    const anchor = ctDateStr(p.startDatetime.toISOString());
    return anchor >= fromDateStr ? anchor : null;
  }
  const startMs = new Date(fromDateStr + "T12:00:00").getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  for (let i = 0; i < maxDays; i++) {
    const d = new Date(startMs + i * msPerDay);
    const dateStr = ctDateStr(d.toISOString());
    if (isOccurrenceOnDate(p, dateStr)) return dateStr;
  }
  return null;
}

/**
 * The last session of a series with an end, "YYYY-MM-DD" in Central: a
 * one-time program's last day, or a weekly series' last class by its count
 * (the bound isOccurrenceOnDate uses). Null for a series that goes on.
 */
export function lastOccurrenceDate(p: ScheduleProgram): string | null {
  if (!p.startDatetime) return null;
  const anchor = ctDateStr(p.startDatetime.toISOString());
  if (!p.recurrenceFreq) return p.endDatetime ? ctDateStr(p.endDatetime.toISOString()) : anchor;
  return seriesEnd(p, anchor);
}

/** The end of a series' last class day in Central (23:59), or null while it
 *  goes on: when its teacher's and teams' 30 days begin (lib/contactWindow.ts). */
export function lastOccurrenceEnd(p: ScheduleProgram): Date | null {
  const day = lastOccurrenceDate(p);
  return day ? centralToUtc(`${day}T23:59`) : null;
}

/**
 * Does this program have a session on the given date?
 * dateStr must be "YYYY-MM-DD" format.
 */
export function isOccurrenceOnDate(p: ScheduleProgram, dateStr: string): boolean {
  if (!p.startDatetime) return false;
  const anchor = ctDateStr(p.startDatetime.toISOString());
  if (anchor > dateStr) return false;
  // endDatetime is a forward cutoff ONLY for non-recurring programs, where it
  // is the program's genuine end (a single or multi-day offering past its end
  // date no longer occurs). For a RECURRING program, endDatetime is the end
  // TIME of a single occurrence — same calendar day as the anchor — NOT a
  // series-end date; the series ends by its count or recurrenceUntil (seriesEnd,
  // below). Treating it as a forward cutoff for recurring programs collapses
  // every one of them to its first session, which silently erased recurring
  // offerings from the dashboard "Coming up for you", /this-week, the
  // Scheduler, standing host rotations, and the session-room join gate.
  // (Regression introduced session 131, found via LoriLee's testing session 137.)
  if (!p.recurrenceFreq) {
    if (p.endDatetime && dateStr > ctDateStr(p.endDatetime.toISOString())) return false;
    return anchor === dateStr;
  }

  if (!onPattern(p, anchor, dateStr)) return false;
  // The series' end: its last real session, by count or by date (2026-10-28).
  const end = seriesEnd(p, anchor);
  return end === null || dateStr <= end;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNum = (d: string) => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY_MS);
const fromDayNum = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);

/**
 * Does the repeating pattern fall on this day, on or after the start (the
 * series' end aside)? The one test behind every session date (2026-10-28):
 * - Weekly: a ticked day, in a meeting week. Weeks run Monday to Sunday, as
 *   on This Week, and are counted from the start's week, so "every other
 *   week" with several days keeps each week's days together. No day ticked
 *   means the start's own weekday (it used to mean every day).
 * - Monthly: the start's weekday and its place in the month ("the 2nd
 *   Wednesday", "the last Sunday", which stays last in a 5-week month).
 * - Daily: every day, or every Nth.
 */
function onPattern(p: ScheduleProgram, anchor: string, dateStr: string): boolean {
  if (dateStr < anchor) return false;
  const freq = (p.recurrenceFreq ?? "").toUpperCase();
  const n = Math.max(1, p.recurrenceInterval ?? 1);
  if (freq === "WEEKLY") {
    const days = p.recurrenceDays?.length ? p.recurrenceDays : [dateToDayCode(anchor)];
    if (!days.includes(dateToDayCode(dateStr))) return false;
    if (n === 1) return true;
    const monday = (d: string) => dayNum(d) - ((new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7);
    return ((monday(dateStr) - monday(anchor)) / 7) % n === 0;
  }
  if (freq === "MONTHLY") {
    if (dateToDayCode(dateStr) !== dateToDayCode(anchor)) return false;
    const anchorOcc = getDayOfWeekOccurrenceInMonth(anchor);
    const anchorIsLast = anchorOcc === getTotalDayOfWeekOccurrencesInMonth(anchor);
    const dateOcc = getDayOfWeekOccurrenceInMonth(dateStr);
    const dateIsLast = dateOcc === getTotalDayOfWeekOccurrencesInMonth(dateStr);
    if (anchorIsLast ? !dateIsLast : dateOcc !== anchorOcc) return false;
    const [ay, am] = anchor.split("-").map(Number);
    const [dy, dm] = dateStr.split("-").map(Number);
    return ((dy - ay) * 12 + (dm - am)) % n === 0;
  }
  if (freq === "DAILY") return (dayNum(dateStr) - dayNum(anchor)) % n === 0;
  return dateStr === anchor;
}

/** Series ends already worked out, by everything that decides them. */
const endCache = new Map<string, string | null>();

/**
 * The last session of a repeating series, "YYYY-MM-DD" in Central, or null
 * while it goes on (2026-10-28). By count: the Nth real session from the
 * start, counted by walking the pattern, so an off-day start or several
 * ticked days count right (before, the count was turned into weeks, and
 * "4" with two days ticked gave 5). By date: the last real session on or
 * before it. Both set: whichever comes first. A count under 2 reads as
 * ongoing, as it always has.
 */
function seriesEnd(p: ScheduleProgram, anchor: string): string | null {
  const count = p.recurrenceCount && p.recurrenceCount >= 2 ? p.recurrenceCount : null;
  const until = p.recurrenceUntil ? ctDateStr(new Date(p.recurrenceUntil).toISOString()) : null;
  if (!count && !until) return null;
  const key = [anchor, p.recurrenceFreq, p.recurrenceInterval, (p.recurrenceDays ?? []).join(","), count, until].join("|");
  if (endCache.has(key)) return endCache.get(key)!;
  let last: string | null = null;
  let seen = 0;
  const start = dayNum(anchor);
  // Ten years is the furthest any series is walked.
  for (let i = 0; i < 3660; i++) {
    const d = fromDayNum(start + i);
    if (until && d > until) break;
    if (!onPattern(p, anchor, d)) continue;
    last = d;
    seen++;
    if (count && seen >= count) break;
  }
  // An end date before the first session leaves nothing: the start's day
  // stands in, so the series reads as over rather than as going on.
  const end = last ?? anchor;
  if (endCache.size > 2000) endCache.clear();
  endCache.set(key, end);
  return end;
}
