/**
 * Central Time (America/Chicago) timezone utilities.
 *
 * RIM is a community center in Brookfield, WI — all program times are Central.
 * Postgres stores UTC; the editor displays/accepts Central Time.
 */

const TZ = "America/Chicago";

/**
 * Convert a UTC Date to a "YYYY-MM-DDTHH:mm" string in Central Time.
 * Used to populate datetime-local inputs with the correct CT value.
 */
export function toCentralDatetime(d: Date | null | undefined): string {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // hour12: false with en-US can return "24" for midnight — normalize to "00"
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/**
 * Parse a "YYYY-MM-DDTHH:mm" string (assumed Central Time) into a UTC Date.
 * Used when saving editor datetime-local values to Postgres.
 */
export function centralToUtc(dtLocal: string | null | undefined): Date | null {
  if (!dtLocal) return null;

  // Treat the input as UTC to get a reference timestamp
  const asUtc = new Date(dtLocal + ":00.000Z");
  if (isNaN(asUtc.getTime())) return null;

  // Find the CT→UTC offset at this approximate moment
  const utcStr = asUtc.toLocaleString("en-US", { timeZone: "UTC" });
  const ctStr = asUtc.toLocaleString("en-US", { timeZone: TZ });
  const offsetMs = new Date(utcStr).getTime() - new Date(ctStr).getTime();

  // Input represents CT, so add offset to get UTC
  return new Date(asUtc.getTime() + offsetMs);
}

/**
 * A session's day as people read it, in Central Time: "Thu, Oct 16".
 * Every coverage email uses this (2026-10-15: the routes formatted in the
 * server's UTC, so a session at 7 PM or later read as the next day).
 */
export function fmtSessionDay(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });
}

/** "YYYY-MM" of a moment in Central Time: the Scheduler's ?month= deep link. */
export function ctMonthKey(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

/** The start of today in Central Time, as a UTC instant. */
export function ctStartOfToday(now: Date = new Date()): Date {
  return centralToUtc(`${toCentralDatetime(now).slice(0, 10)}T00:00`) ?? now;
}

/**
 * The Central calendar day a moment falls on, as UTC instants: from its
 * midnight to just before the next. A program meets at most once a Central
 * day, so "this session" is matched by day, not by exact start: an exact
 * match broke when a stored time drifted from the program's (a start-time
 * edit before re-timing existed, or daylight saving), and the Zoom door then
 * didn't know the assigned host (2026-10-16).
 */
export function ctDayBounds(d: Date): { start: Date; end: Date } {
  const day = toCentralDatetime(d).slice(0, 10);
  const next = new Date(`${day}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const start = centralToUtc(`${day}T00:00`) ?? d;
  const end = new Date((centralToUtc(`${next.toISOString().slice(0, 10)}T00:00`) ?? d).getTime() - 1);
  return { start, end };
}

/**
 * A calendar month in Central Time as UTC instants: from its first midnight to
 * just before the next month's (month0 is 0-based). The Scheduler's month query
 * uses this (2026-10-15: it used UTC, so an evening session on the last day of
 * a month fell outside it and showed "needed" while covered).
 */
export function ctMonthBounds(year: number, month0: number): { start: Date; end: Date } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const next = month0 === 11 ? { y: year + 1, m: 0 } : { y: year, m: month0 + 1 };
  const start = centralToUtc(`${year}-${pad(month0 + 1)}-01T00:00`)!;
  const nextStart = centralToUtc(`${next.y}-${pad(next.m + 1)}-01T00:00`)!;
  return { start, end: new Date(nextStart.getTime() - 1) };
}
