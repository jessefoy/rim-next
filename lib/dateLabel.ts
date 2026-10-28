/**
 * Auto-generate a human-readable date/time label from structured Sanity fields.
 *
 * Used as a fallback when `dateText` is blank in Sanity. Pass the program's
 * datetime + recurrence fields; get back a string like:
 *   "Thursdays · 7–9pm CT"
 *   "Mondays & Wednesdays · 6:30–8pm CT"
 *   "Thursdays, Dec 3 to 17 · 7–8pm CT" (a series with an end)
 *   "Thursdays, from Dec 3 · 7–8pm CT" (an ongoing series not yet begun)
 *   "Saturday, June 14 · 10am–4pm CT"
 *   "Fri, Jun 13 – Sun, Jun 15 CT"
 *   "Monthly · 7–9pm CT"
 *
 * Returns null if startDatetime is not set.
 */

import { ctDateStr, lastOccurrenceDate, monthlyPatternPhrase } from "@/lib/scheduleUtils";

const TZ = "America/Chicago";

/** Map from iCal BYDAY code to full English day name */
const DAY_FULL: Record<string, string> = {
  SU: "Sunday",
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
};

/** Format a Date as a time string in Central Time: "7pm", "7:30am", "10am" */
function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .toLowerCase()
    .replace(/:00\s*(am|pm)/, "$1") // drop ":00" → "7pm" not "7:00pm"
    .replace(/\s+(am|pm)/, "$1");   // drop space → "7pm" not "7 pm"
}

/** "7pm" or "7–9pm CT" */
export function formatTimeRange(start: Date, end: Date | null): string {
  if (!end) return `${formatTime(start)} CT`;
  return `${formatTime(start)}–${formatTime(end)} CT`;
}

/**
 * Plural day names joined naturally.
 * ["TH"] → "Thursdays"
 * ["MO","WE"] → "Mondays & Wednesdays"
 * ["MO","WE","FR"] → "Mondays, Wednesdays & Fridays"
 */
function formatDayList(codes: string[]): string {
  const names = codes.map((c) => (DAY_FULL[c] ?? c) + "s");
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

export interface DateLabelParams {
  startDatetime?: string | null;
  endDatetime?: string | null;
  recurrenceFreq?: string | null;
  recurrenceInterval?: number | null;
  recurrenceDays?: string[] | null;
  /** How a series ends (2026-10-28): after a number of sessions, or on a
   *  date (an ISO string or a Date). Without them a series reads as ongoing. */
  recurrenceCount?: number | null;
  recurrenceUntil?: string | Date | null;
}

/** "Dec 3" from "2026-12-03". */
function shortDay(ymd: string, withYear = false): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC", month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}),
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/**
 * When a series runs (2026-10-28, the Publish trial: a three-week series read
 * only "Thursdays"): "Dec 3 to 17" when it has an end, "from Dec 3" while its
 * first session is still ahead, nothing for one that is already going on.
 */
function seriesSpan(p: DateLabelParams, start: Date): string | null {
  const first = ctDateStr(start.toISOString());
  const last = lastOccurrenceDate({
    id: "", name: "", slug: "", programFormat: null,
    startDatetime: start,
    endDatetime: p.endDatetime ? new Date(p.endDatetime) : null,
    recurrenceFreq: p.recurrenceFreq ?? null,
    recurrenceInterval: p.recurrenceInterval ?? null,
    recurrenceDays: p.recurrenceDays ?? [],
    recurrenceCount: p.recurrenceCount ?? null,
    recurrenceUntil: p.recurrenceUntil ? new Date(p.recurrenceUntil) : null,
  });
  if (last && last > first) {
    const years = first.slice(0, 4) !== last.slice(0, 4);
    const sameMonth = !years && first.slice(0, 7) === last.slice(0, 7);
    const to = sameMonth ? String(Number(last.slice(8))) : shortDay(last, years);
    return `${shortDay(first, years)} to ${to}`;
  }
  if (!last && first > ctDateStr(new Date().toISOString())) return `from ${shortDay(first)}`;
  return null;
}

export function buildDateLabel(p: DateLabelParams): string | null {
  if (!p.startDatetime) return null;

  const start = new Date(p.startDatetime);
  const end   = p.endDatetime ? new Date(p.endDatetime) : null;
  const timeRange = formatTimeRange(start, end);
  const n = p.recurrenceInterval ?? 1;
  // recurrenceFreq is stored UPPERCASE ("WEEKLY"/"DAILY"/"MONTHLY"); normalize so
  // these branches actually fire (compared lowercase, they silently never did).
  const freq = (p.recurrenceFreq ?? "").toUpperCase();

  // ── Weekly ──────────────────────────────────────────────────────────────────
  if (freq === "WEEKLY") {
    const days = p.recurrenceDays?.length ? p.recurrenceDays : null;

    let prefix: string;
    if (n === 1) {
      // "Thursdays" or "Mondays & Wednesdays" — plural implies recurrence
      prefix = days ? formatDayList(days) : "Weekly";
    } else if (n === 2) {
      const dayName = days?.length === 1 ? (DAY_FULL[days[0]] ?? days[0]) : "week";
      prefix = `Every other ${dayName}`;
    } else {
      const dayName = days?.length === 1 ? (DAY_FULL[days[0]] ?? days[0]) : "week";
      prefix = `Every ${n} weeks on ${dayName}`;
    }

    const span = seriesSpan(p, start);
    return `${span ? `${prefix}, ${span}` : prefix} · ${timeRange}`;
  }

  // ── Daily ───────────────────────────────────────────────────────────────────
  if (freq === "DAILY") {
    const prefix =
      n === 1 ? "Daily" :
      n === 2 ? "Every other day" :
      `Every ${n} days`;
    return `${prefix} · ${timeRange}`;
  }

  // ── Monthly ─────────────────────────────────────────────────────────────────
  if (freq === "MONTHLY") {
    const sDate = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(start);
    const phrase = monthlyPatternPhrase(sDate);
    if (phrase) {
      const cap = phrase.charAt(0).toUpperCase() + phrase.slice(1);
      const base = n === 1 ? `${cap} of the month` : `Every ${n} months on the ${phrase}`;
      const span = seriesSpan(p, start);
      return `${span ? `${base}, ${span}` : base} · ${timeRange}`;
    }
    const prefix = n === 1 ? "Monthly" : `Every ${n} months`;
    const span = seriesSpan(p, start);
    return `${span ? `${prefix}, ${span}` : prefix} · ${timeRange}`;
  }

  // ── Single event ────────────────────────────────────────────────────────────
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts }).format(d);

  // Multi-day: start and end fall on different calendar days in CT
  if (end) {
    const startDay = fmt(start, { day: "numeric" });
    const endDay   = fmt(end,   { day: "numeric" });
    if (startDay !== endDay) {
      const sFmt = fmt(start, { weekday: "short", month: "short", day: "numeric" });
      const eFmt = fmt(end,   { weekday: "short", month: "short", day: "numeric" });
      return `${sFmt} – ${eFmt} CT`;
    }
  }

  // Single-day: "Saturday, June 14 · 10am–4pm CT"
  const dateStr = fmt(start, { weekday: "long", month: "long", day: "numeric" });
  return `${dateStr} · ${timeRange}`;
}

/**
 * A program's date words, without the time: "Thursdays, Dec 3 to 17",
 * "Saturday, June 14". A repeating program's are built fresh each time, as
 * "from Dec 3" depends on today; its stored dateText (the save's own
 * "Thursdays", never anyone's wording) is only the fallback. Anything else
 * keeps its stored words, as before.
 */
export function programDateWords(stored: string | null | undefined, p: DateLabelParams): string | null {
  if (p.recurrenceFreq) {
    const full = buildDateLabel(p);
    if (full) return full.split(" · ")[0];
  }
  return stored?.trim() ? stored : buildDateLabel(p);
}
