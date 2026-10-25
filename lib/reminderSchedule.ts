/**
 * When a program's reminder email goes out (2026-10-24, Phase 4).
 *
 * Two ways, one rule:
 *   - **Days before** (`reminderDaysBefore`, new programs default to 2): on the
 *     Central day that many days before the program's first session, in the
 *     daily morning run, and then each morning to anyone who registers after,
 *     until the program begins. Counted in Central calendar days, so a morning
 *     start isn't reminded a day late. A program with several sessions is
 *     reminded once, before the first.
 *   - **A set date** (`reminderDate`, older programs): once, in the morning run
 *     after that date and time, to the people registered then (unchanged).
 * When both are set, days before wins. Archived programs and programs with
 * registration off get no reminder.
 *
 * The daily run is app/api/cron/send-reminders at 14:00 UTC (8 AM Central in
 * winter, 9 AM in summer). Pure, no imports.
 */

export const REMINDER_RUN_UTC_HOUR = 14;

export interface ReminderProgram {
  registrationEnabled: boolean;
  archivedAt?: Date | string | null;
  startDatetime: Date | string | null;
  reminderDate: Date | string | null;
  reminderDaysBefore?: number | null;
}

const CT = "America/Chicago";

/** The Central "YYYY-MM-DD" of an instant. */
function centralDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: CT });
}

/** "YYYY-MM-DD" moved by whole days. */
function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The morning run's instant on a Central day. */
function runOn(day: string): Date {
  return new Date(`${day}T${String(REMINDER_RUN_UTC_HOUR).padStart(2, "0")}:00:00Z`);
}

export function usesDaysBefore(p: ReminderProgram): boolean {
  return typeof p.reminderDaysBefore === "number" && p.reminderDaysBefore >= 0 && !!p.startDatetime;
}

/** When the reminder first goes out, or null if it won't. */
export function reminderSendsAt(p: ReminderProgram): Date | null {
  if (!p.registrationEnabled || p.archivedAt) return null;
  if (usesDaysBefore(p)) {
    return runOn(addDays(centralDay(new Date(p.startDatetime!)), -(p.reminderDaysBefore as number)));
  }
  if (!p.reminderDate) return null;
  const date = new Date(p.reminderDate);
  const sendAt = new Date(date);
  sendAt.setUTCHours(REMINDER_RUN_UTC_HOUR, 0, 0, 0);
  if (sendAt < date) sendAt.setUTCDate(sendAt.getUTCDate() + 1);
  return sendAt;
}

/** Whether a morning run at `now` sends this program's reminder to those who
 *  haven't had it. Days before: from the send day until the program begins.
 *  A set date: only the run in the 24 hours after it (as before). */
export function reminderDueAt(p: ReminderProgram, now: Date): boolean {
  if (!p.registrationEnabled || p.archivedAt) return false;
  if (usesDaysBefore(p)) {
    const first = reminderSendsAt(p)!;
    return now.getTime() >= first.getTime() - 60 * 60 * 1000 && now < new Date(p.startDatetime!);
  }
  if (!p.reminderDate) return false;
  const date = new Date(p.reminderDate);
  return date <= now && date.getTime() > now.getTime() - 24 * 60 * 60 * 1000;
}

/** The next morning run after `now`. */
export function nextRunAfter(now: Date): Date {
  const run = new Date(now);
  run.setUTCHours(REMINDER_RUN_UTC_HOUR, 0, 0, 0);
  if (run <= now) run.setUTCDate(run.getUTCDate() + 1);
  return run;
}

/** Whether someone registering now still gets the reminder automatically:
 *  days before, and a morning run still comes before the program begins (an
 *  evening program on its own day, past the run, has none left). */
export function reachesLateRegistrants(p: ReminderProgram, now: Date = new Date()): boolean {
  return usesDaysBefore(p) && !p.archivedAt && p.registrationEnabled && nextRunAfter(now) < new Date(p.startDatetime!);
}
