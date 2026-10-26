/**
 * Is a program taking sign-ups right now? (2026-10-24, Phase 2 "Opens on".)
 * One rule, read by the program page, the register page, the registration
 * POST, course access, the Programs list, team Home's line, the Registration
 * desk and its settings. Before this, each wrote the rule out again.
 *
 * "Not open yet" is registration ON with a future `registrationOpensAt`: it
 * never changes who can get into a session (the Zoom door, My Home and Open
 * entry read registrationEnabled and openEntry, never the opening date), nor
 * the mailing list's default.
 */

import type { Prisma } from "@prisma/client";

const CT = "America/Chicago";

export type RegistrationWindow = "off" | "notYet" | "open" | "closed";

export interface WindowFields {
  registrationEnabled: boolean;
  registrationClosed: boolean;
  registrationDeadline: Date | string | null;
  registrationOpensAt?: Date | string | null;
  /** When given: a one-time program closes once it has ended (Jesse,
   *  2026-10-26: it took sign-ups until the nightly archive). */
  startDatetime?: Date | string | null;
  endDatetime?: Date | string | null;
  recurrenceFreq?: string | null;
}

/** Whether a one-time program is over: its end (or start) has passed. */
export function oneTimeHasEnded(p: WindowFields, now: Date = new Date()): boolean {
  if (p.recurrenceFreq !== null || p.startDatetime === undefined) return false;
  const last = p.endDatetime ?? p.startDatetime;
  return !!last && new Date(last) <= now;
}

/** Off; closed (by hand, its closing date passed, or a one-time program
 *  over); not open yet; or open. */
export function registrationWindow(p: WindowFields, now: Date = new Date()): RegistrationWindow {
  if (!p.registrationEnabled) return "off";
  if (p.registrationClosed) return "closed";
  if (p.registrationDeadline && new Date(p.registrationDeadline) < now) return "closed";
  if (oneTimeHasEnded(p, now)) return "closed";
  if (p.registrationOpensAt && new Date(p.registrationOpensAt) > now) return "notYet";
  return "open";
}

/** The same rule, as a Prisma filter: programs taking sign-ups at `now`. */
export function takingRegistrationsWhere(now: Date = new Date()): Prisma.ProgramWhereInput {
  return {
    registrationEnabled: true,
    registrationClosed: false,
    AND: [
      { OR: [{ registrationDeadline: null }, { registrationDeadline: { gt: now } }] },
      { OR: [{ registrationOpensAt: null }, { registrationOpensAt: { lte: now } }] },
      // A one-time program that has ended takes no more sign-ups.
      {
        OR: [
          { recurrenceFreq: { not: null } },
          { endDatetime: { gt: now } },
          { endDatetime: null, OR: [{ startDatetime: null }, { startDatetime: { gt: now } }] },
        ],
      },
    ],
  };
}

/** "Sunday, November 1 at 9:00 AM", in Central time; the year only when it isn't this year's. */
export function fmtOpensAt(d: Date | string, now: Date = new Date()): string {
  const date = new Date(d);
  const sameYear =
    date.toLocaleDateString("en-US", { timeZone: CT, year: "numeric" }) ===
    now.toLocaleDateString("en-US", { timeZone: CT, year: "numeric" });
  const day = date.toLocaleDateString("en-US", {
    timeZone: CT, weekday: "long", month: "long", day: "numeric", ...(sameYear ? {} : { year: "numeric" }),
  });
  const time = date.toLocaleTimeString("en-US", { timeZone: CT, hour: "numeric", minute: "2-digit" });
  return `${day} at ${time}`;
}
