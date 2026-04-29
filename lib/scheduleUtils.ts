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
 * Does this program have a session on the given date?
 * dateStr must be "YYYY-MM-DD" format.
 */
export function isOccurrenceOnDate(p: ScheduleProgram, dateStr: string): boolean {
  if (!p.startDatetime) return false;
  const anchor = ctDateStr(p.startDatetime.toISOString());
  if (anchor > dateStr) return false;
  if (!p.recurrenceFreq) return anchor === dateStr;

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
