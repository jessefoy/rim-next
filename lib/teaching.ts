/**
 * The teacher's page (2026-10-24, Phase 3 slice 3, "Who's helping, who's
 * asking"): who may open it, and which programs a person teaches.
 *
 * Open to the program's own teachers (ProgramTeacher) and to the Guiding
 * Teacher. ADMIN alone does not open it (the rule that Admin doesn't pass a
 * team's or a helper's door); Admin works in Registration. The page shows
 * names, contact details, the answers to the teacher's own questions and the
 * registration team's notes "for the teacher too" — never dana.
 */

import { db } from "@/lib/db";
import { hasConcludedOneTime } from "@/lib/programUtils";
import { contactsClosed, hasEnded } from "@/lib/contactWindow";
import { lastOccurrenceEnd } from "@/lib/scheduleUtils";

const PROGRAM_SELECT = {
  id: true,
  slug: true,
  name: true,
  dateText: true,
  startDatetime: true,
  endDatetime: true,
  recurrenceFreq: true,
  recurrenceInterval: true,
  recurrenceDays: true,
  recurrenceCount: true,
  programFormat: true,
  outsideMeetingUrl: true,
  archivedAt: true,
} as const;

export function isGuidingTeacher(roles: string[] | undefined): boolean {
  return (roles ?? []).includes("GUIDING_TEACHER");
}

/** May this person open the teacher's page for this program? */
export async function canOpenTeachingPage(userId: string, roles: string[] | undefined, programId: string): Promise<boolean> {
  if (isGuidingTeacher(roles)) return true;
  return !!(await db.programTeacher.findFirst({ where: { userId, programId }, select: { id: true } }));
}

type ListedProgram = {
  id: string; name: string; slug: string; programFormat: string | null;
  archivedAt: Date | null; startDatetime: Date | null; endDatetime: Date | null;
  recurrenceFreq: string | null; recurrenceInterval: number | null; recurrenceDays: string[]; recurrenceCount: number | null;
};

/** Current programs: not archived, not a one-time program that is over, and
 *  not a series past its last class. */
function current<T extends ListedProgram>(rows: T[]): T[] {
  const now = new Date();
  return rows.filter((p) => !p.archivedAt && !hasConcludedOneTime(p) && !hasEnded(p, now, lastOccurrenceEnd(p)));
}

/** Ended programs still within their 30 days (lib/contactWindow.ts), newest
 *  first: listed apart so a thank-you or follow-up is one click away (Jesse,
 *  2026-10-26). */
function endedRecently<T extends ListedProgram>(rows: T[]): T[] {
  const now = new Date();
  return rows
    .filter((p) => {
      const last = lastOccurrenceEnd(p);
      return (p.archivedAt || hasConcludedOneTime(p) || hasEnded(p, now, last)) && !contactsClosed(p, now, last);
    })
    .reverse();
}

/** The programs this person taught that ended in the last 30 days. */
export async function endedTaughtBy(userId: string) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const rows = await db.program.findMany({
    where: {
      programTeachers: { some: { userId } },
      OR: [{ archivedAt: null }, { archivedAt: { gte: since } }],
    },
    select: PROGRAM_SELECT,
    orderBy: [{ startDatetime: "asc" }, { name: "asc" }],
  });
  return endedRecently(rows);
}

/** The current programs this person teaches, soonest first. */
export async function programsTaughtBy(userId: string) {
  const rows = await db.program.findMany({
    where: { programTeachers: { some: { userId } }, archivedAt: null },
    select: PROGRAM_SELECT,
    orderBy: [{ startDatetime: "asc" }, { name: "asc" }],
  });
  return current(rows);
}

/** For the Guiding Teacher: every current program with a teacher. */
export async function programsWithTeachers() {
  const rows = await db.program.findMany({
    where: { programTeachers: { some: {} }, archivedAt: null },
    select: PROGRAM_SELECT,
    orderBy: [{ startDatetime: "asc" }, { name: "asc" }],
  });
  return current(rows);
}

/** Whether "Teaching" belongs in this person's menu: they teach a current
 *  program, or they are the Guiding Teacher (as with My Teams). */
export async function showsTeaching(userId: string, roles: string[] | undefined): Promise<boolean> {
  if (isGuidingTeacher(roles)) return true;
  return (await programsTaughtBy(userId)).length > 0 || (await endedTaughtBy(userId)).length > 0;
}
