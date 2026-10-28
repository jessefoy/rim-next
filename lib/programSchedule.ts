/**
 * What a program's schedule may be (2026-10-28, "Setting up a program, step
 * by step", Phase 1). The save refuses a schedule that can't mean what the
 * person thinks, for every caller: the editor, the walk-through and the RIM
 * Guide (lib/programSave.ts). Dependency-free, so the member harness loads it.
 *
 * Checked only when a save changes the schedule, so a program saved before
 * these rules (the Dummy Test Program's Daily, say) keeps its schedule until
 * someone changes it.
 */

export interface ScheduleInput {
  /** Central "YYYY-MM-DDTHH:mm", or "" / null for none. */
  start: string | null;
  end: string | null;
  freq: string | null;
  interval: number | null;
  days: string[] | null;
  count: number | null;
  /** Central "YYYY-MM-DD", or null. */
  until: string | null;
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const DAY_NAMES: Record<string, string> = {
  SU: "Sunday", MO: "Monday", TU: "Tuesday", WE: "Wednesday", TH: "Thursday", FR: "Friday", SA: "Saturday",
};

const dayCode = (ymd: string) => DAY_CODES[new Date(ymd + "T12:00:00Z").getUTCDay()];
const plural = (code: string) => DAY_NAMES[code] + "s";

/** A schedule's parts, as the rules name them. */
export type SchedulePart = "start" | "end" | "freq" | "interval" | "days" | "count" | "until";

/**
 * The refusal for this schedule, in the editor's voice, or null when it can be
 * saved. With `changed`, a rule speaks only when one of its own parts is in
 * this save, so a program saved before these rules can still have its other
 * parts changed (the editor sends only what changed). Without it (a new
 * program), every rule speaks.
 */
export function scheduleRefusal(
  s: ScheduleInput,
  before?: { freq: string | null; interval: number | null },
  changed?: Set<SchedulePart>,
): string | null {
  const say = (m: string) => `Under When and where: ${m} Nothing was saved.`;
  const touched = (...parts: SchedulePart[]) => !changed || parts.some((p) => changed.has(p));
  const start = s.start || null;
  const end = s.end || null;
  const startDay = start ? start.slice(0, 10) : null;
  const endDay = end ? end.slice(0, 10) : null;
  const freq = s.freq ? s.freq.toUpperCase() : null;
  const interval = s.interval ?? 1;
  const days = (s.days ?? []).map((d) => d.toUpperCase());

  if (touched("start", "end") && start && end && end <= start && (!freq || endDay === startDay)) {
    return say("it ends before it begins. Check the times, AM and PM too.");
  }
  if (!freq) return null;

  // Daily and "every 3 weeks or more" are no longer offered (Jesse,
  // 2026-10-28). A program already set that way keeps it until changed.
  const unchanged = before && (before.freq ?? "").toUpperCase() === freq && (before.interval ?? 1) === interval;
  if (touched("freq", "interval") && !unchanged) {
    if (freq !== "WEEKLY" && freq !== "MONTHLY") return say("choose every week, every other week, or once a month.");
    if (freq === "WEEKLY" && (interval < 1 || interval > 2)) return say("a program meets every week or every other week.");
    if (freq === "MONTHLY" && interval !== 1) return say("a monthly program meets once each month.");
  }

  if (freq === "WEEKLY" && touched("freq", "days") && !days.length) {
    return say("choose the days it meets.");
  }
  if (freq === "WEEKLY" && startDay && days.length && touched("freq", "days", "start") && !days.includes(dayCode(startDay))) {
    const named = days.filter((d) => DAY_NAMES[d]).map(plural).join(" and ");
    return say(`the first session is a ${DAY_NAMES[dayCode(startDay)]}, but it meets on ${named}. Start it on one of those days.`);
  }
  // For a program that repeats, the end is the time each session ends, on
  // the first session's day; the series ends by its count or its end date.
  if (startDay && endDay && endDay !== startDay && touched("freq", "start", "end")) {
    return say("for a program that repeats, the end is the time each session ends, on the first session's day. Set when the series ends with the number of sessions or an end date.");
  }
  if (s.count != null && s.count < 2 && touched("count")) {
    return say("a series has at least 2 sessions. For one session, choose One-time.");
  }
  if (s.until && startDay && s.until < startDay && touched("until", "start")) {
    return say("the series ends before its first session.");
  }
  return null;
}

/** "YYYY-MM-DD" → the stored day (noon UTC, so its Central day is that day); "" or null → null; anything else → undefined. */
export function parseUntil(input: unknown): Date | null | undefined {
  if (input == null || input === "") return null;
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return undefined;
  const d = new Date(input + "T12:00:00Z");
  return isNaN(d.getTime()) ? undefined : d;
}
