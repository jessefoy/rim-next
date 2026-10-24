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

/** Current programs: not archived, and not a one-time program that is over. */
function current<T extends { archivedAt: Date | null; startDatetime: Date | null; endDatetime: Date | null; recurrenceFreq: string | null }>(rows: T[]): T[] {
  return rows.filter((p) => !p.archivedAt && !hasConcludedOneTime(p));
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
  return (await programsTaughtBy(userId)).length > 0;
}
