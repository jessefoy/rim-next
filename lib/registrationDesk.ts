/**
 * The Registration app's reading of a program (2026-10-23): what state its
 * registration is in, and what needs a person. One source for the desk
 * (/tools/registration) and each program's page, so the two never disagree.
 *
 * Counts follow the roster's long-standing rules: a held place
 * (PENDING_PAYMENT) is not a registration, APPROVED counts as registered,
 * and dana "not finished" is PENDING on a real registration.
 */

import { buildDateLabel } from "@/lib/dateLabel";
import { hasConcludedOneTime } from "@/lib/programUtils";
import { registrationWindow } from "@/lib/registrationWindow";
import { nextReminderRun, reachesLateRegistrants, reminderSendsAt as scheduledSend } from "@/lib/reminderSchedule";

const CT = "America/Chicago";

export function fmtDay(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", { timeZone: CT, month: "short", day: "numeric", year: "numeric" });
}

export function fmtWhen(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", {
    timeZone: CT, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export interface DeskProgram {
  slug: string;
  name: string;
  dateText: string | null;
  startDatetime: Date | null;
  endDatetime: Date | null;
  recurrenceFreq: string | null;
  recurrenceInterval: number | null;
  recurrenceDays: string[];
  registrationEnabled: boolean;
  registrationClosed: boolean;
  registrationCapacity: number | null;
  registrationDeadline: Date | null;
  registrationOpensAt: Date | null;
  reminderDate: Date | null;
  reminderDaysBefore?: number | null;
  archivedAt?: Date | null;
}

export interface DeskCounts {
  registered: number;
  waiting: number;
  danaNotFinished: number;
  /** Registered people the reminder hasn't reached. */
  reminderUnsent: number;
}

export interface DeskNeed {
  kind: "place" | "dana" | "reminder";
  text: string;
}

/** "Nov 13 to 15", "Wednesdays", or null: the program's own date words. */
export function programWhen(
  p: Pick<DeskProgram, "dateText" | "startDatetime" | "endDatetime" | "recurrenceFreq" | "recurrenceInterval" | "recurrenceDays">,
): string | null {
  return p.dateText || buildDateLabel({
    startDatetime: p.startDatetime?.toISOString() ?? null,
    endDatetime: p.endDatetime?.toISOString() ?? null,
    recurrenceFreq: p.recurrenceFreq,
    recurrenceInterval: p.recurrenceInterval,
    recurrenceDays: p.recurrenceDays,
  });
}

/** "Open until Nov 6", "Opens Nov 1", "Closed", "Off": where registration
 *  stands, by the one rule (lib/registrationWindow.ts). */
export function registrationState(p: DeskProgram, now = new Date()): string {
  switch (registrationWindow(p, now)) {
    case "off":
      return "Registration off";
    case "closed":
      return !p.registrationClosed && p.registrationDeadline ? `Closed on ${fmtDay(p.registrationDeadline)}` : "Closed";
    case "notYet":
      return `Opens ${fmtWhen(p.registrationOpensAt!)}`;
    default:
      return p.registrationDeadline ? `Open until ${fmtDay(p.registrationDeadline)}` : "Open";
  }
}

/** "12 of 14 places taken · 2 waiting", or "14 registered". */
export function placesLine(p: DeskProgram, c: DeskCounts): string {
  const parts = [
    p.registrationCapacity
      ? `${c.registered} of ${p.registrationCapacity} places taken`
      : `${c.registered} registered`,
  ];
  if (c.waiting > 0) parts.push(`${c.waiting} waiting`);
  return parts.join(" · ");
}

export function isOver(p: DeskProgram): boolean {
  return hasConcludedOneTime(p);
}

/** True once the daily run has first sent this program's reminder
 *  (lib/reminderSchedule.ts). */
export function reminderHasGone(p: DeskProgram, now = new Date()): boolean {
  const sendAt = reminderSendsAt(p);
  return !!sendAt && sendAt <= now;
}

/** When the daily run first emails this program's reminder, or null if it
 *  won't: one rule, lib/reminderSchedule.ts. */
export function reminderSendsAt(p: DeskProgram): Date | null {
  return scheduledSend(p);
}

/** When the daily run next sends this program's reminder, or null
 *  (lib/reminderSchedule.ts nextReminderRun). */
export function reminderNextSend(p: DeskProgram, now = new Date()): Date | null {
  return nextReminderRun(p, now);
}

/** "Thursday, Nov 12, at 8 AM": when something goes out, in Central time. */
export function fmtSendTime(d: Date): string {
  const day = d.toLocaleDateString("en-US", { timeZone: CT, weekday: "long", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { timeZone: CT, hour: "numeric", minute: "2-digit" }).replace(":00", "");
  return `${day}, at ${time}`;
}

const people = (n: number) => (n === 1 ? "1 person" : `${n} people`);

/**
 * What needs a person in this program, in the order to act on it. Nothing
 * for a program that is over.
 */
export function programNeeds(p: DeskProgram, c: DeskCounts, now = new Date()): DeskNeed[] {
  if (isOver(p)) return [];
  const needs: DeskNeed[] = [];
  if (p.registrationCapacity && c.registered < p.registrationCapacity && c.waiting > 0) {
    const open = p.registrationCapacity - c.registered;
    needs.push({
      kind: "place",
      text: `${open === 1 ? "A place is" : `${open} places are`} open, and ${people(c.waiting)} ${c.waiting === 1 ? "is" : "are"} waiting.`,
    });
  }
  if (c.danaNotFinished > 0) {
    needs.push({
      kind: "dana",
      text: `${people(c.danaNotFinished)} ${c.danaNotFinished === 1 ? "hasn't" : "haven't"} finished their dana.`,
    });
  }
  // Days before reaches late registrants on its own each morning; only a set
  // date leaves them to be sent by hand.
  if (reminderHasGone(p, now) && c.reminderUnsent > 0 && !reachesLateRegistrants(p, now)) {
    needs.push({
      kind: "reminder",
      // Said as it is: someone may have joined after it went, or after its
      // day passed with no one to send to (a trial, 2026-10-25).
      text: `${people(c.reminderUnsent)} ${c.reminderUnsent === 1 ? "hasn't" : "haven't"} had the reminder.`,
    });
  }
  return needs;
}
