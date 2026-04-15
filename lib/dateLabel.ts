/**
 * Auto-generate a human-readable date/time label from structured Sanity fields.
 *
 * Used as a fallback when `dateText` is blank in Sanity. Pass the program's
 * datetime + recurrence fields; get back a string like:
 *   "Thursdays · 7–9pm CT"
 *   "Mondays & Wednesdays · 6:30–8pm CT"
 *   "Saturday, June 14 · 10am–4pm CT"
 *   "Fri, Jun 13 – Sun, Jun 15 CT"
 *   "Monthly · 7–9pm CT"
 *
 * Returns null if startDatetime is not set.
 */

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
}

export function buildDateLabel(p: DateLabelParams): string | null {
  if (!p.startDatetime) return null;

  const start = new Date(p.startDatetime);
  const end   = p.endDatetime ? new Date(p.endDatetime) : null;
  const timeRange = formatTimeRange(start, end);
  const n = p.recurrenceInterval ?? 1;

  // ── Weekly ──────────────────────────────────────────────────────────────────
  if (p.recurrenceFreq === "weekly") {
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

    return `${prefix} · ${timeRange}`;
  }

  // ── Daily ───────────────────────────────────────────────────────────────────
  if (p.recurrenceFreq === "daily") {
    const prefix =
      n === 1 ? "Daily" :
      n === 2 ? "Every other day" :
      `Every ${n} days`;
    return `${prefix} · ${timeRange}`;
  }

  // ── Monthly ─────────────────────────────────────────────────────────────────
  if (p.recurrenceFreq === "monthly") {
    const prefix = n === 1 ? "Monthly" : `Every ${n} months`;
    return `${prefix} · ${timeRange}`;
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
