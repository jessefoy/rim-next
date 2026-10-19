/**
 * One team's Scheduler month: every occurrence of the programs the team
 * staffs, joined with that team's assignments.
 *
 * The one builder for the Scheduler's rows (2026-10-15 integrity audit). The
 * page (/tools/schedule) and the month navigation (GET /api/host/assignments)
 * each kept their own copy, and the copies drifted: the month GET was missing
 * `opensRoom` and the NEW badge's date until step 1 of the audit. Both now
 * call this, so a rule changed here reaches both.
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ctMonthBounds } from "@/lib/timezone";
import { ctDateStr, isOccurrenceOnDate, shiftToDate } from "@/lib/scheduleUtils";
import {
  getHubCoverageConfig,
  getProgramSlugsForHub,
  resolveHostingHubSlug,
} from "@/lib/programHub";

/** One signed-up volunteer on an open sign-up session (greeter). */
export interface ScheduleClaimant {
  assignmentId: string;
  userId: string | null;
  userName: string | null;
  /** Coordinator-facing badge for this volunteer, if not fully active. */
  badge: "paused" | "inactive" | null;
}

export interface ScheduleSessionRow {
  /** The assignment's id; `unassigned::slug::date` when the team has no row
   *  for the session; `multi::slug::date` for an open sign-up card. */
  id: string;
  programId: string | null;
  programSlug: string;
  programName: string;
  sessionDate: string | null;
  /** Occurrence end (ISO), or null when the program has no endDatetime. With
   *  sessionDate this lets the row offer "Enter room" only while the session
   *  is enterable (mirrors lib/sessionWindow.ts). */
  sessionEnd: string | null;
  status: "unclaimed" | "claimed" | "sub_needed";
  hostUserId: string | null;
  hostName: string | null;
  /** Open sign-up teams only: everyone signed up. Empty on single-seat teams,
   *  which use hostUserId/hostName. */
  claimants: ScheduleClaimant[];
  subRequestId: string | null;
  /** The cover request's note (rich-text JSON), if any. */
  subMessage: Prisma.JsonValue | null;
  programFormat: string | null;
  /** True only on the hosting team's rows: the one team that enters the
   *  online room. Greeter and AV rows never do: AV uses the hall's own
   *  computer and greeters serve in person (Jesse, 2026-10-15). */
  opensRoom: boolean;
  /** When the program was created. Drives the NEW badge. */
  programCreatedAt: string | null;
  /** Non-null when a standing rotation created this assignment. */
  standingAssignmentId: string | null;
  /** Coordinator-facing status for the assigned person:
   *  "paused" (membership PAUSED, or ACTIVE without hosting capability),
   *  "inactive" (left the team with the assignment still held), or null. */
  hostBadge: "paused" | "inactive" | null;
}

export interface ScheduleProgramSummary {
  id: string;
  slug: string;
  name: string;
  programFormat: string | null;
  /** Days of week the program runs (e.g. ["MO","TH"]). Drives rotation rows. */
  recurrenceDays: string[];
  /** The program's schedule (ISO dates), so the rotation preview can ask
   *  isOccurrenceOnDate the same question the rotation engine does. */
  startDatetime: string | null;
  endDatetime: string | null;
  recurrenceFreq: string | null;
  recurrenceInterval: number | null;
  recurrenceCount: number | null;
}

function nameOf(u: { firstName: string | null; lastName: string | null; preferredName: string | null } | null): string | null {
  if (!u) return null;
  return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
}

/**
 * Build one team's month. `month0` is 0-indexed. Programs: the team's own
 * (hosting) plus those it covers, in the team's formats, not archived.
 * Assignments: only this team's, within the month's Central midnights.
 */
export async function buildHubMonthSessions(hubSlug: string, year: number, month0: number): Promise<{
  sessions: ScheduleSessionRow[];
  programs: ScheduleProgramSummary[];
  allowsMultipleAssignments: boolean;
}> {
  const { start, end } = ctMonthBounds(year, month0);
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();

  // Unknown or unconfigured teams fall back to the online formats so the
  // page still renders.
  const hubConfig = await getHubCoverageConfig(hubSlug);
  const appliesToFormats = hubConfig?.appliesToFormats ?? ["virtual", "hybrid"];
  const allowsMultipleAssignments = hubConfig?.allowsMultipleAssignments ?? false;
  const eligibleSlugs = await getProgramSlugsForHub(hubSlug);

  const [pgPrograms, assignments, hub] = await Promise.all([
    db.program.findMany({
      where: {
        programFormat: { in: appliesToFormats },
        archivedAt: null,
        slug: { in: eligibleSlugs },
      },
      select: {
        id: true, name: true, slug: true,
        programFormat: true, startDatetime: true, endDatetime: true,
        recurrenceFreq: true, recurrenceInterval: true, recurrenceDays: true, recurrenceCount: true,
        createdAt: true, hostingHubSlug: true,
      },
      orderBy: { sortOrder: "asc" },
    }),
    // An AV row and a hosting row on the same session are separate rows;
    // each team sees only its own.
    db.hostAssignment.findMany({
      where: { sessionDate: { gte: start, lte: end }, hubSlug },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        subRequests: { where: { status: "OPEN" }, select: { id: true, message: true }, take: 1 },
      },
      orderBy: { sessionDate: "asc" },
    }),
    db.hub.findUnique({ where: { slug: hubSlug }, select: { id: true } }),
  ]);

  // Pause badges come from this team's membership, not another team's.
  const assignedUserIds = [...new Set(assignments.map((a) => a.userId).filter(Boolean))] as string[];
  const pauseMap = new Map<string, "paused" | "inactive">();
  if (assignedUserIds.length > 0 && hub) {
    const members = await db.hubMember.findMany({
      where: { hubId: hub.id, userId: { in: assignedUserIds } },
      select: { userId: true, status: true, hostingCapability: true },
    });
    for (const m of members) {
      if (m.status === "INACTIVE") pauseMap.set(m.userId, "inactive");
      else if (m.status === "PAUSED" || !m.hostingCapability) pauseMap.set(m.userId, "paused");
    }
  }

  // Group by session (program + Central date): open sign-up teams stack
  // everyone on one card; single-seat teams use the one row.
  const byKey = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const key = `${a.programSlug}::${a.sessionDate ? ctDateStr(a.sessionDate.toISOString()) : ""}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(a);
    else byKey.set(key, [a]);
  }

  const sessions: ScheduleSessionRow[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    for (const p of pgPrograms) {
      if (!isOccurrenceOnDate(p, dateStr)) continue;

      const base = {
        programId: p.id,
        programSlug: p.slug,
        programName: p.name,
        sessionDate: p.startDatetime ? shiftToDate(p.startDatetime.toISOString(), dateStr).toISOString() : null,
        sessionEnd: p.endDatetime ? shiftToDate(p.endDatetime.toISOString(), dateStr).toISOString() : null,
        programFormat: p.programFormat ?? null,
        // Only the team that runs the session online enters its room.
        opensRoom: resolveHostingHubSlug(p) === hubSlug,
        programCreatedAt: p.createdAt?.toISOString() ?? null,
      };
      const bucket = byKey.get(`${p.slug}::${dateStr}`);

      if (!bucket || bucket.length === 0) {
        sessions.push({
          ...base,
          id: `unassigned::${p.slug}::${dateStr}`,
          status: "unclaimed", hostUserId: null, hostName: null, claimants: [],
          subRequestId: null, subMessage: null,
          standingAssignmentId: null, hostBadge: null,
        });
        continue;
      }

      if (allowsMultipleAssignments) {
        // Open sign-up: no cover requests; leaving is the only way out.
        sessions.push({
          ...base,
          id: `multi::${p.slug}::${dateStr}`,
          status: "claimed", hostUserId: null, hostName: null,
          claimants: bucket.map((a) => ({
            assignmentId: a.id,
            userId: a.userId ?? null,
            userName: nameOf(a.user),
            badge: a.userId ? (pauseMap.get(a.userId) ?? null) : null,
          })),
          subRequestId: null, subMessage: null,
          // Several people, each signed up their own way: the card names no
          // single source (it showed "via rotation" from whichever sorted
          // first; 2026-10-16 audit).
          standingAssignmentId: null,
          hostBadge: null,
        });
        continue;
      }

      const a = bucket[0];
      const openSub = a.subRequests[0] ?? null;
      sessions.push({
        ...base,
        id: a.id,
        status: !a.userId ? "unclaimed" : openSub ? "sub_needed" : "claimed",
        hostUserId: a.userId ?? null,
        hostName: nameOf(a.user),
        claimants: [],
        subRequestId: openSub?.id ?? null,
        subMessage: openSub?.message ?? null,
        standingAssignmentId: a.standingAssignmentId ?? null,
        hostBadge: a.userId ? (pauseMap.get(a.userId) ?? null) : null,
      });
    }
  }

  return {
    sessions,
    programs: pgPrograms.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      programFormat: p.programFormat ?? null,
      recurrenceDays: p.recurrenceDays ?? [],
      startDatetime: p.startDatetime?.toISOString() ?? null,
      endDatetime: p.endDatetime?.toISOString() ?? null,
      recurrenceFreq: p.recurrenceFreq ?? null,
      recurrenceInterval: p.recurrenceInterval ?? null,
      recurrenceCount: p.recurrenceCount ?? null,
    })),
    allowsMultipleAssignments,
  };
}
