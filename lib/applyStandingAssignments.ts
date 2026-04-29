/**
 * Core standing-assignment application logic.
 *
 * Shared between:
 *   - POST /api/host/standing-assignments/apply  (coordinator-triggered)
 *   - GET  /api/cron/apply-standing-assignments   (daily cron)
 *
 * Idempotent — skips sessions that already have a HostAssignment.
 */

import { db } from "@/lib/db";
import {
  ctDateStr,
  shiftToDate,
  isOccurrenceOnDate,
  getOccurrenceInMonth,
  type ScheduleProgram,
} from "@/lib/scheduleUtils";
import type { StandingOccurrence } from "@prisma/client";

const TZ = "America/Chicago";

const OCC_NUMBER: Record<StandingOccurrence, number | null> = {
  FIRST: 1, SECOND: 2, THIRD: 3, FOURTH: 4, FIFTH: 5, ALL: null,
};

export interface ApplyResult {
  created: number;
  /** Map of userId → sessions created — used to send notification emails */
  byUser: Map<
    string,
    Array<{
      programName: string;
      dateLabel:   string;
      userEmail:   string;
      firstName:   string | null;
    }>
  >;
}

export async function applyStandingAssignments(
  programSlugFilter: string | null,
  year: number,
  month: number
): Promise<ApplyResult> {
  const today = new Date();

  // 1. Load active standing assignments (not expired)
  const standingAssignments = await db.standingAssignment.findMany({
    where: {
      ...(programSlugFilter ? { programSlug: programSlugFilter } : {}),
      OR: [{ endsOn: null }, { endsOn: { gte: today } }],
    },
    include: {
      user: { select: { id: true, firstName: true, preferredName: true, email: true } },
    },
  });

  if (standingAssignments.length === 0) return { created: 0, byUser: new Map() };

  // 2. Load programs covered by these assignments
  const slugs = [...new Set(standingAssignments.map((sa) => sa.programSlug))];
  const programs = await db.program.findMany({
    where: { slug: { in: slugs }, archivedAt: null },
    select: {
      id: true, name: true, slug: true, programFormat: true,
      startDatetime: true, endDatetime: true,
      recurrenceFreq: true, recurrenceInterval: true,
      recurrenceDays: true, recurrenceCount: true,
    },
  });
  const programMap = new Map<string, ScheduleProgram>(
    programs.map((p) => [p.slug, p as ScheduleProgram])
  );

  // 3. Load existing HostAssignments for the month (skip already-assigned sessions)
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth   = new Date(year, month,     0, 23, 59, 59, 999);
  const existing = await db.hostAssignment.findMany({
    where: {
      programSlug: { in: slugs },
      sessionDate: { gte: startOfMonth, lte: endOfMonth },
    },
    select: { programSlug: true, sessionDate: true },
  });
  const existingKeys = new Set(
    existing.map((a) => {
      const d = a.sessionDate ? ctDateStr(a.sessionDate.toISOString()) : "";
      return `${a.programSlug}::${d}`;
    })
  );

  // 4. Walk every day of the month
  const daysInMonth = new Date(year, month, 0).getDate();

  interface Candidate {
    programSlug: string;
    userId:      string;
    sessionDate: Date;
    assignedBy:  string;
    programName: string;
    dateLabel:   string;
    userEmail:   string;
    firstName:   string | null;
  }

  const toCreate: Candidate[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    for (const sa of standingAssignments) {
      const program = programMap.get(sa.programSlug);
      if (!program) continue;

      // Respect startsOn and endsOn windows
      if (dateStr < ctDateStr(sa.startsOn.toISOString())) continue;
      if (sa.endsOn && new Date(dateStr + "T12:00:00") > sa.endsOn) continue;

      // Skip if program doesn't run on this date
      if (!isOccurrenceOnDate(program, dateStr)) continue;

      // Skip if already assigned (manual or previously standing)
      const key = `${sa.programSlug}::${dateStr}`;
      if (existingKeys.has(key)) continue;

      // Check occurrence number matches the pattern
      if (sa.occurrence !== "ALL") {
        const targetOcc = OCC_NUMBER[sa.occurrence];
        const actualOcc = getOccurrenceInMonth(dateStr, program);
        if (actualOcc !== targetOcc) continue;
      }

      const sessionDate = shiftToDate(program.startDatetime!.toISOString(), dateStr);
      const dateLabel   = sessionDate.toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", timeZone: TZ,
      });

      toCreate.push({
        programSlug: sa.programSlug,
        userId:      sa.userId,
        sessionDate,
        assignedBy:  sa.createdById,
        programName: program.name,
        dateLabel,
        userEmail:   sa.user.email,
        firstName:   sa.user.preferredName || sa.user.firstName || null,
      });

      // Prevent double-create within this run
      existingKeys.add(key);
    }
  }

  if (toCreate.length === 0) return { created: 0, byUser: new Map() };

  // 5. Batch-create — skipDuplicates as a safety net
  await db.hostAssignment.createMany({
    data: toCreate.map((t) => ({
      programSlug: t.programSlug,
      userId:      t.userId,
      sessionDate: t.sessionDate,
      assignedBy:  t.assignedBy,
    })),
    skipDuplicates: true,
  });

  // 6. Group by user so the caller can send one email per person
  const byUser = new Map<string, Candidate[]>();
  for (const t of toCreate) {
    if (!byUser.has(t.userId)) byUser.set(t.userId, []);
    byUser.get(t.userId)!.push(t);
  }

  return { created: toCreate.length, byUser };
}
