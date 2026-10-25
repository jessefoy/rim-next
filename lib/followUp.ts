/**
 * The note after a program ends (2026-10-24, Phase 4 slice 2): an optional
 * message ("Thank you for coming…") emailed the day after a one-time program
 * ends, once to each person with a place (`Registration.followUpSentAt`).
 *
 * It goes in the daily run (app/api/cron/send-follow-ups, 15:00 UTC: 9 AM
 * Central in winter, 10 AM in summer) on the Central day after the program's
 * last day, or on either of the two days after if a run was missed; never
 * later. Only one-time programs (a recurring one never "ends"), only with a
 * message, and never for a program archived before it ended (cancelled):
 * the nightly archive job archives a finished program the next morning, so
 * archived after its end still sends. Pure, no imports.
 */

export const FOLLOW_UP_RUN_UTC_HOUR = 15;
const CT = "America/Chicago";
/** The send day and the two after it, in case a run was missed. */
const WINDOW_DAYS = 3;

export interface FollowUpProgram {
  followUpEnabled: boolean;
  followUpMessage: unknown;
  recurrenceFreq: string | null;
  startDatetime: Date | string | null;
  endDatetime: Date | string | null;
  archivedAt?: Date | string | null;
}

function centralDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: CT });
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whether a saved message has words in it (an emptied editor saves "<p></p>"). */
export function hasFollowUpMessage(message: unknown): boolean {
  if (typeof message !== "string") return !!message;
  return message.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, "").trim().length > 0;
}

/** The program's last moment: its end, or its start. */
function endsAt(p: FollowUpProgram): Date | null {
  const e = p.endDatetime ?? p.startDatetime;
  return e ? new Date(e) : null;
}

/** When the note first goes out, or null if it won't. */
export function followUpSendsAt(p: FollowUpProgram): Date | null {
  if (!p.followUpEnabled || p.recurrenceFreq || !hasFollowUpMessage(p.followUpMessage)) return null;
  const end = endsAt(p);
  if (!end) return null;
  // Archived before it ended: cancelled, so no thank-you.
  if (p.archivedAt && new Date(p.archivedAt) < end) return null;
  const day = addDays(centralDay(end), 1);
  return new Date(`${day}T${String(FOLLOW_UP_RUN_UTC_HOUR).padStart(2, "0")}:00:00Z`);
}

/** Whether a daily run at `now` sends the note to those who haven't had it. */
export function followUpDueAt(p: FollowUpProgram, now: Date): boolean {
  const first = followUpSendsAt(p);
  if (!first) return false;
  const last = new Date(first.getTime() + (WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000);
  return now.getTime() >= first.getTime() - 60 * 60 * 1000 && now.getTime() <= last.getTime() + 60 * 60 * 1000;
}
