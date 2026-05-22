import { buildDateLabel, formatTimeRange } from "@/lib/dateLabel";
import { toCentralDatetime } from "@/lib/timezone";

const DAY_FULL: Record<string, string> = {
  SU: "Sundays", MO: "Mondays", TU: "Tuesdays", WE: "Wednesdays",
  TH: "Thursdays", FR: "Fridays", SA: "Saturdays",
};
const DAY_ORDER = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/**
 * Normalize a date input to a "YYYY-MM-DDTHH:mm" string in Central Time.
 * Accepts a Date, an ISO string, or a datetime-local string. Returns "" if
 * the input is null/empty/invalid.
 */
function toCtLocalString(input: Date | string | null | undefined): string {
  if (!input) return "";
  if (typeof input === "string") {
    // datetime-local format already
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) return input;
    const d = new Date(input);
    return isNaN(d.getTime()) ? "" : toCentralDatetime(d);
  }
  return toCentralDatetime(input);
}

/**
 * Derive the time display string ("8:15 AM CT", "7:00–8:30 PM CT") from
 * the program's start and end datetimes. Always uses Central Time.
 */
export function computeTimeText(
  start: Date | string | null | undefined,
  end:   Date | string | null | undefined,
): string {
  const startStr = toCtLocalString(start);
  if (!startStr) return "";
  const endStr = toCtLocalString(end);

  const parseTime = (dt: string) => {
    const t = dt.split("T")[1];
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    return { h, m };
  };
  const fmt = (h: number, m: number) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    const mStr = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
    return { str: `${h12}${mStr}`, ampm };
  };

  const s = parseTime(startStr);
  if (!s) return "";
  const { str: sStr, ampm: sAmpm } = fmt(s.h, s.m);
  if (endStr) {
    const e = parseTime(endStr);
    if (e) {
      const { str: eStr, ampm: eAmpm } = fmt(e.h, e.m);
      if (sAmpm === eAmpm) return `${sStr}–${eStr} ${eAmpm} CT`;
      return `${sStr} ${sAmpm}–${eStr} ${eAmpm} CT`;
    }
  }
  return `${sStr} ${sAmpm} CT`;
}

/**
 * Derive the schedule display string ("Tuesdays and Thursdays", "Daily",
 * "May 15, 2026") from the program's recurrence settings and start date.
 */
export function computeDateText(
  start:    Date | string | null | undefined,
  freq:     string | null | undefined,
  days:     string[] | null | undefined,
  interval: number | string | null | undefined,
): string {
  const daysList = days ?? [];
  const intervalStr = interval == null ? "" : String(interval);

  if (freq === "WEEKLY") {
    const ordered = [...daysList].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
    const names = ordered.map((d) => DAY_FULL[d] ?? d);
    const prefix = intervalStr && Number(intervalStr) > 1 ? `Every ${intervalStr} weeks: ` : "";
    if (names.length === 0) return `${prefix}Weekly`;
    if (names.length === 1) return `${prefix}${names[0]}`;
    if (names.length === 2) return `${prefix}${names[0]} and ${names[1]}`;
    const last = names[names.length - 1];
    return `${prefix}${names.slice(0, -1).join(", ")}, and ${last}`;
  }
  if (freq === "DAILY") {
    const n = Number(intervalStr);
    return !intervalStr || n <= 1 ? "Daily" : `Every ${n} days`;
  }
  if (freq === "MONTHLY") {
    return "Monthly";
  }
  // One-time — derive from start date
  const startStr = toCtLocalString(start);
  if (startStr) {
    const datePart = startStr.split("T")[0];
    if (datePart) {
      const [y, m, d] = datePart.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      });
    }
  }
  return "";
}

/**
 * Sanitize a coordinator-supplied teacherLabel before persisting. Allows
 * Unicode letters and marks (for accented characters and non-Latin scripts
 * like rōshi, ācārya, etc.), digits, spaces, hyphens, and apostrophes.
 * Trims, collapses whitespace, then caps at 20 chars. Empty → null.
 *
 * Order matters: strip disallowed characters first so the slice doesn't
 * keep a now-too-long string after stripping (e.g. "Co-Leader-12345678901"
 * → "Co-Leader-" after digit strip, well under 20).
 *
 * Defense-in-depth against accidental paste of HTML, a wall of characters
 * that would break the pill layout, or other content that doesn't belong
 * in a role pill. The pill is a UI cue, not a security boundary — but the
 * sanitizer makes the cue trustworthy. The character set is permissive
 * enough for realistic role names ("Teacher's Aide", "Co-Leader 1",
 * "Roshi", "Senpai") while still blocking obvious garbage.
 */
export function sanitizeTeacherLabel(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input
    .replace(/[^\p{L}\p{M}\d\s'\-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20)
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function fmtLabel(fmt: string): string {
  switch (fmt) {
    case "virtual":   return "Zoom Only";
    case "hybrid":    return "In-Person & Zoom";
    case "in-person": return "In-Person";
    default:          return fmt;
  }
}

export function buildSubtitle(program: {
  dateText: string | null;
  timeText: string | null;
  programFormat: string;
  startDatetime: Date | string | null;
  endDatetime: Date | string | null;
  recurrenceFreq: string | null;
  recurrenceInterval: number | null;
  recurrenceDays: string[];
}): string | null {
  const fmt = fmtLabel(program.programFormat);

  const startDatetime = program.startDatetime
    ? typeof program.startDatetime === "string"
      ? program.startDatetime
      : program.startDatetime.toISOString()
    : null;

  const endDatetime = program.endDatetime
    ? typeof program.endDatetime === "string"
      ? program.endDatetime
      : program.endDatetime.toISOString()
    : null;

  if (program.dateText) {
    let label = program.dateText;
    if (startDatetime) {
      const timeStr =
        program.timeText ||
        formatTimeRange(new Date(startDatetime), endDatetime ? new Date(endDatetime) : null);
      label += ` · ${timeStr}`;
    }
    return `${label} | ${fmt}`;
  }

  const autoLabel = buildDateLabel({
    startDatetime,
    endDatetime,
    recurrenceFreq: program.recurrenceFreq,
    recurrenceInterval: program.recurrenceInterval,
    recurrenceDays: program.recurrenceDays,
  });

  if (autoLabel) return `${autoLabel} | ${fmt}`;
  return fmt || null;
}
