/**
 * The order of programs in a list people browse (2026-10-28, Jesse: the sort
 * number "is confusing when setting it up because you can't see it in
 * relationship to the other programs"). One order, so a section reads the
 * same everywhere it shows: each section of Programs & Events, the Kalyana
 * Mitta groups page, and the Programs list. This Week and My Home are
 * calendars and keep their own time order.
 *
 * - Programs shown first (`listFirst`), in that order.
 * - Then programs that go on, by their first day of the week (Monday first,
 *   as on This Week) and start time; weekly before every other week before
 *   monthly when those match.
 * - Then programs with an end (one-time, several days, or a series with a
 *   count or an end date), by their first session.
 * Name breaks any tie. No numbers to manage: a new program lands in its
 * place, and taking "first" away puts it back where its time belongs.
 */
import { toCentralDatetime } from "./timezone";

export interface OrderableProgram {
  name: string;
  listFirst?: number | null;
  startDatetime: Date | null;
  recurrenceFreq: string | null;
  recurrenceInterval: number | null;
  recurrenceDays: string[];
  recurrenceCount: number | null;
  recurrenceUntil?: Date | null;
}

const WEEK = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const WEEKDAY_OF = (ymd: string) => WEEK[(new Date(ymd + "T12:00:00Z").getUTCDay() + 6) % 7];

/** Does it go on (no end set)? */
export function goesOn(p: OrderableProgram): boolean {
  return !!p.recurrenceFreq && !(p.recurrenceCount && p.recurrenceCount >= 2) && !p.recurrenceUntil;
}

/** The key that places a program in its section, as text that sorts. */
export function orderKey(p: OrderableProgram): string {
  if (p.listFirst != null) return `0|${String(p.listFirst).padStart(6, "0")}`;
  const local = p.startDatetime ? toCentralDatetime(p.startDatetime) : "";
  if (goesOn(p)) {
    const freq = (p.recurrenceFreq ?? "").toUpperCase();
    const anchorDay = local ? WEEKDAY_OF(local.slice(0, 10)) : "SU";
    const days = freq === "WEEKLY" && p.recurrenceDays.length ? p.recurrenceDays : [anchorDay];
    const first = Math.min(...days.map((d) => WEEK.indexOf(d)).filter((i) => i >= 0));
    const rank = freq === "DAILY" ? 0 : freq === "WEEKLY" ? ((p.recurrenceInterval ?? 1) > 1 ? 2 : 1) : 3;
    return `1|${freq === "DAILY" ? 0 : first}|${local.slice(11, 16)}|${rank}`;
  }
  // Undated programs go last.
  return `2|${local || "9999"}`;
}

/** The programs in listing order (a new array). */
export function inListingOrder<T extends OrderableProgram>(programs: T[]): T[] {
  return programs
    .map((p) => ({ p, key: orderKey(p) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.p.name.localeCompare(b.p.name)))
    .map((x) => x.p);
}
