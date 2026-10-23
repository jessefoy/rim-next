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
  reminderDate: Date | null;
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
export function programWhen(p: DeskProgram): string | null {
  return p.dateText || buildDateLabel({
    startDatetime: p.startDatetime?.toISOString() ?? null,
    endDatetime: p.endDatetime?.toISOString() ?? null,
    recurrenceFreq: p.recurrenceFreq,
    recurrenceInterval: p.recurrenceInterval,
    recurrenceDays: p.recurrenceDays,
  });
}

/** "Open until Nov 6", "Closed", "Off": where registration stands. */
export function registrationState(p: DeskProgram, now = new Date()): string {
  if (!p.registrationEnabled) return "Registration off";
  if (p.registrationClosed) return "Closed";
  if (p.registrationDeadline && p.registrationDeadline < now) return `Closed on ${fmtDay(p.registrationDeadline)}`;
  return p.registrationDeadline ? `Open until ${fmtDay(p.registrationDeadline)}` : "Open";
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

/**
 * True once the daily reminder send has run for this program: it runs at
 * 14:00 UTC (app/api/cron/send-reminders) for a reminder date in the day
 * before, and only while registration is on.
 */
export function reminderHasGone(p: DeskProgram, now = new Date()): boolean {
  if (!p.reminderDate || !p.registrationEnabled) return false;
  const sendAt = new Date(p.reminderDate);
  sendAt.setUTCHours(14, 0, 0, 0);
  if (sendAt < p.reminderDate) sendAt.setUTCDate(sendAt.getUTCDate() + 1);
  return sendAt <= now;
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
  if (reminderHasGone(p, now) && c.reminderUnsent > 0) {
    needs.push({
      kind: "reminder",
      text: `${people(c.reminderUnsent)} registered after the reminder went out.`,
    });
  }
  return needs;
}
