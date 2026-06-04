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

const TZ = "America/Chicago";

/** Format an ISO string to a CT date string: "YYYY-MM-DD" */
export function ctDateStr(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");
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
  const anchorCTDate = ctDateStr(anchorISO);
  if (anchorCTDate === targetDate) return anchor;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round(
    (new Date(targetDate + "T12:00:00").getTime() - new Date(anchorCTDate + "T12:00:00").getTime())
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
  // series-end date; the series bound is recurrenceCount, applied per-frequency
  // below. Treating it as a forward cutoff for recurring programs collapses
  // every one of them to its first session, which silently erased recurring
  // offerings from the dashboard "Coming up for you", /this-week, the
  // Scheduler, standing host rotations, and the session-room join gate.
  // (Regression introduced session 131, found via LoriLee's testing session 137.)
  if (!p.recurrenceFreq) {
    if (p.endDatetime && dateStr > ctDateStr(p.endDatetime.toISOString())) return false;
    return anchor === dateStr;
  }

  const freq = p.recurrenceFreq.toUpperCase();
  if (freq === "WEEKLY") {
    const days = p.recurrenceDays ?? [];
    if (days.length > 0 && !days.includes(dateToDayCode(dateStr))) return false;
    const n = p.recurrenceInterval ?? 1;
    if (n > 1) {
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksDiff = Math.round(
        (new Date(dateStr + "T12:00:00").getTime() - new Date(anchor + "T12:00:00").getTime())
        / msPerWeek
      );
      if (weeksDiff % n !== 0) return false;
    }
    if (p.recurrenceCount && p.recurrenceCount >= 2) {
      const daysPerCycle = p.recurrenceDays?.length ?? 1;
      const cyclesNeeded = Math.ceil((p.recurrenceCount - 1) / daysPerCycle);
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const lastMs = new Date(anchor + "T12:00:00").getTime()
        + cyclesNeeded * (p.recurrenceInterval ?? 1) * msPerWeek;
      if (new Date(dateStr + "T12:00:00").getTime() > lastMs) return false;
    }
    return true;
  }

  if (freq === "DAILY") {
    const n = p.recurrenceInterval ?? 1;
    if (n > 1) {
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysDiff = Math.round(
        (new Date(dateStr + "T12:00:00").getTime() - new Date(anchor + "T12:00:00").getTime())
        / msPerDay
      );
      if (daysDiff % n !== 0) return false;
    }
    return true;
  }

  return anchor === dateStr;
}
