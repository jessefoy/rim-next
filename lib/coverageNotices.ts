/**
 * Telling a team which sessions need someone (2026-10-16).
 *
 * Jesse, after signing up as a greeter and cancelling: "Shouldn't it send a
 * notification … that it needs a greeter? … this is one of the main features
 * to support teams and to make sure roles are all accounted for." Before this,
 * a team heard only when someone asked for cover; a session emptied any other
 * way (a greeter cancelling, a coordinator taking someone off, a pause) went
 * quiet, and a session no one ever took was never mentioned.
 *
 * Jesse's rulings (2026-10-16):
 *   - A session within two weeks that loses its last person: the team members
 *     who can take sessions are told at once (prepareGapNotices, then
 *     deliverGapNotices after the response).
 *   - Every Monday, each team hears about the next two weeks' sessions that
 *     still need someone; two days before, the team's coordinators hear about
 *     anything still open, open cover requests included.
 *   - Two days before, the person serving gets a reminder that shows who else
 *     is serving the session. A host is never emailed about a supporting
 *     team's gap; their reminder shows it ("Greeters: none yet").
 *
 * Sessions come from the Scheduler's own row builder (buildHubMonthSessions),
 * so "needs someone" here is exactly what the Scheduler shows. Each notice is
 * recorded in coverage_notices, so nothing goes out twice and Updates can show
 * a gap opening after its assignment is gone.
 */

import { db } from "@/lib/db";
import { buildHubMonthSessions, type ScheduleSessionRow } from "@/lib/scheduleSessions";
import { ctDateStr } from "@/lib/scheduleUtils";
import { ctDayBounds } from "@/lib/timezone";
import { getHubCoverageCopy, resolveHostingHubSlug, teamCannotStaff } from "@/lib/programHub";
import { getHubNotificationRecipients } from "@/lib/toolAuth";
import { releasePersonCoverage } from "@/lib/applyStandingAssignments";
import {
  sendCoverageClearedEmails,
  sendCoverageGapEmail,
  sendCoverageLookaheadEmail,
  sendCoverageReminderEmail,
  sendCoverageStillNeededEmail,
  type CoverageSessionLine,
} from "@/lib/email";
import { COVERAGE_LOOKAHEAD_DAYS, EARLY_OPEN_MIN } from "@/lib/sessionWindowConstants";

/** How far ahead a team hears about open sessions. */
export const LOOKAHEAD_DAYS = COVERAGE_LOOKAHEAD_DAYS;
/** Days before a session that its people and the coordinator hear. */
export const REMINDER_DAYS_BEFORE = 2;

const DAY_MS = 86_400_000;

/** A short pause between the daily pass's emails, so a Monday burst stays
 *  under the mail service's rate limit (a refused send is only logged). */
const pause = () => new Promise((r) => setTimeout(r, 600));

type Person = { firstName: string | null; lastName: string | null; preferredName: string | null } | null;

function fullName(u: Person): string | null {
  if (!u) return null;
  return [u.preferredName || u.firstName, u.lastName].filter(Boolean).join(" ") || null;
}

/** A Central day ("YYYY-MM-DD") plus n days. */
function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function centralDay(d: Date | string): string {
  return ctDateStr(typeof d === "string" ? d : d.toISOString());
}

/** True when the Scheduler shows this session as needing someone. */
export function needsSomeone(r: ScheduleSessionRow): boolean {
  return r.status === "unclaimed" || r.status === "sub_needed";
}

/**
 * One team's sessions from `fromDay` through `toDay` (Central, inclusive)
 * that haven't started yet, as the Scheduler builds them.
 */
export async function teamSessionsBetween(
  hubSlug: string,
  fromDay: string,
  toDay: string,
  now: Date = new Date(),
): Promise<ScheduleSessionRow[]> {
  const months = new Set<string>();
  for (let d = fromDay; d <= toDay; d = addDays(d, 1)) months.add(d.slice(0, 7));
  const rows: ScheduleSessionRow[] = [];
  for (const m of months) {
    const [y, mo] = m.split("-").map(Number);
    rows.push(...(await buildHubMonthSessions(hubSlug, y, mo - 1)).sessions);
  }
  return rows.filter((r) => {
    if (!r.sessionDate) return false;
    const day = centralDay(r.sessionDate);
    return day >= fromDay && day <= toDay && new Date(r.sessionDate).getTime() > now.getTime();
  });
}

/**
 * How many of a team's sessions in the next two weeks need someone: team
 * Home's summary line. The count the Scheduler itself would show (backlog
 * 2026-10-13-005: a row count said a team was covered when it wasn't).
 */
export async function countSessionsNeedingSomeone(
  hubSlug: string,
  now: Date = new Date(),
): Promise<{ open: number; total: number }> {
  const today = centralDay(now);
  const rows = await teamSessionsBetween(hubSlug, today, addDays(today, LOOKAHEAD_DAYS - 1), now);
  return { open: rows.filter(needsSomeone).length, total: rows.length };
}

/** Whether anyone from this team is on this session's Central day now. */
export async function sessionHasSomeone(hubSlug: string, programSlug: string, sessionDate: Date): Promise<boolean> {
  const { start, end } = ctDayBounds(sessionDate);
  return (await db.hostAssignment.count({
    where: { hubSlug, programSlug, sessionDate: { gte: start, lte: end }, userId: { not: null } },
  })) > 0;
}

// ─── A session losing its last person ──────────────────────────────────────

export interface PreparedGapNotice {
  hubSlug: string;
  sessions: { programSlug: string; programName: string; sessionDate: Date; sessionDay: string }[];
  recipients: { email: string; firstName: string | null }[];
}

/**
 * After a write took people off sessions (cancel, remove, pause, leaving a
 * team), decide which sessions the team should hear about now: within the
 * next two weeks, still staffed by that team, with nobody left on that team,
 * and not already announced in the last day (a sign-up and cancel repeated).
 * Run after the write has committed; send with deliverGapNotices in after().
 * `excludeUserIds`: the person who made the change and anyone it took off
 * (they've been told, or did it themselves).
 */
export async function prepareGapNotices(
  rows: { hubSlug: string; programSlug: string; sessionDate: Date | null }[],
  excludeUserIds: (string | null | undefined)[],
  now: Date = new Date(),
): Promise<PreparedGapNotice[]> {
  // The write it follows has committed: a failure here must never turn that
  // into an error for the person (reviewer, 2026-10-16). Log and tell no one.
  try {
    return await findGaps(rows, excludeUserIds, now);
  } catch (e) {
    console.error("[coverage-notices] gap check failed", e);
    return [];
  }
}

async function findGaps(
  rows: { hubSlug: string; programSlug: string; sessionDate: Date | null }[],
  excludeUserIds: (string | null | undefined)[],
  now: Date,
): Promise<PreparedGapNotice[]> {
  const horizon = now.getTime() + LOOKAHEAD_DAYS * DAY_MS;
  const seen = new Set<string>();
  const byHub = new Map<string, { programSlug: string; sessionDate: Date; sessionDay: string }[]>();
  for (const r of rows) {
    if (!r.sessionDate) continue;
    const t = r.sessionDate.getTime();
    if (t <= now.getTime() || t > horizon) continue;
    const day = centralDay(r.sessionDate);
    const key = `${r.hubSlug}::${r.programSlug}::${day}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (await teamCannotStaff(r.hubSlug, r.programSlug)) continue;
    if (await sessionHasSomeone(r.hubSlug, r.programSlug, r.sessionDate)) continue;
    const announced = await db.coverageNotice.findFirst({
      where: {
        kind: "gap-opened", hubSlug: r.hubSlug, programSlug: r.programSlug, sessionDay: day,
        createdAt: { gte: new Date(now.getTime() - DAY_MS) },
      },
      select: { id: true },
    });
    if (announced) continue;
    const list = byHub.get(r.hubSlug) ?? [];
    list.push({ programSlug: r.programSlug, sessionDate: r.sessionDate, sessionDay: day });
    byHub.set(r.hubSlug, list);
  }
  if (byHub.size === 0) return [];

  const slugs = [...new Set([...byHub.values()].flat().map((s) => s.programSlug))];
  const programs = await db.program.findMany({ where: { slug: { in: slugs } }, select: { slug: true, name: true } });
  const nameOf = new Map(programs.map((p) => [p.slug, p.name]));
  const exclude = new Set(excludeUserIds.filter((x): x is string => !!x));

  const prepared: PreparedGapNotice[] = [];
  for (const [hubSlug, sessions] of byHub) {
    const recipients = (await getHubNotificationRecipients(hubSlug, { canCover: true }))
      .filter((u) => !exclude.has(u.id) && !!u.email)
      .map((u) => ({ email: u.email as string, firstName: u.firstName }));
    prepared.push({
      hubSlug,
      sessions: sessions
        .sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime())
        .map((s) => ({ ...s, programName: nameOf.get(s.programSlug) ?? s.programSlug })),
      recipients,
    });
  }
  return prepared;
}

/** Whether a prepared notice will reach anyone (for the answer beside the button). */
export function gapNoticeReachesTeam(prepared: PreparedGapNotice[]): boolean {
  return prepared.some((p) => p.sessions.length > 0 && p.recipients.length > 0);
}

/**
 * Record each gap (Updates shows it, and it won't be announced twice) and
 * email the team. Call inside after(); failures are logged per person.
 */
export async function deliverGapNotices(prepared: PreparedGapNotice[]): Promise<void> {
  for (const p of prepared) {
    try {
      await db.coverageNotice.createMany({
        data: p.sessions.map((s) => ({
          kind: "gap-opened", hubSlug: p.hubSlug, programSlug: s.programSlug,
          sessionDay: s.sessionDay, sessionDate: s.sessionDate,
        })),
      });
    } catch (e) {
      console.error("[coverage-notices] recording a gap failed", e);
    }
    const lines: CoverageSessionLine[] = p.sessions.map((s) => ({ programName: s.programName, sessionAt: s.sessionDate }));
    for (const r of p.recipients) {
      try {
        await sendCoverageGapEmail({ to: r.email, firstName: r.firstName, hubSlug: p.hubSlug, sessions: lines });
      } catch (e) {
        console.error("[coverage-notices] gap email failed", e);
      }
    }
  }
}

// ─── Who is serving a session ──────────────────────────────────────────────

function pluralNoun(noun: string): string {
  return /^[A-Z0-9/&]+$/.test(noun) || /s$/i.test(noun) ? noun : `${noun}s`;
}

/**
 * Every team serving one session and its people, hosting team first, as a
 * markdown list: "- Host: Jesse Foy", "- Greeters: none yet". Only teams that
 * staff the program now (teamCannotStaff), so a team that left it isn't shown.
 */
export async function sessionTeamPicture(programSlug: string, sessionDate: Date): Promise<string> {
  const [program, coverage] = await Promise.all([
    db.program.findUnique({ where: { slug: programSlug }, select: { hostingHubSlug: true } }),
    db.programCoverageHub.findMany({ where: { programSlug }, select: { hubSlug: true } }),
  ]);
  const hosting = resolveHostingHubSlug(program);
  const candidates = [hosting, ...coverage.map((c) => c.hubSlug).filter((s) => s !== hosting)];
  const teams: string[] = [];
  for (const slug of candidates) if (!(await teamCannotStaff(slug, programSlug))) teams.push(slug);
  if (teams.length === 0) return "";

  const { start, end } = ctDayBounds(sessionDate);
  const [assignments, hubs] = await Promise.all([
    db.hostAssignment.findMany({
      where: { programSlug, hubSlug: { in: teams }, sessionDate: { gte: start, lte: end }, userId: { not: null } },
      select: { hubSlug: true, user: { select: { firstName: true, lastName: true, preferredName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.hub.findMany({ where: { slug: { in: teams } }, select: { slug: true, allowsMultipleAssignments: true } }),
  ]);
  const openSignUp = new Set(hubs.filter((h) => h.allowsMultipleAssignments).map((h) => h.slug));

  const lines: string[] = [];
  for (const slug of teams) {
    const copy = await getHubCoverageCopy(slug);
    const names = assignments.filter((a) => a.hubSlug === slug).map((a) => fullName(a.user)).filter(Boolean);
    const label = openSignUp.has(slug) ? pluralNoun(copy.noun) : copy.noun;
    lines.push(`- ${label}: ${names.length ? names.join(", ") : "none yet"}`);
  }
  return lines.join("\n");
}

// ─── The daily pass (app/api/cron/coverage-notices) ────────────────────────

async function alreadySent(where: {
  kind: string; hubSlug: string; programSlug?: string | null; sessionDay?: string | null; assignmentId?: string | null;
}): Promise<boolean> {
  return !!(await db.coverageNotice.findFirst({ where, select: { id: true } }));
}

/**
 * Run once a day (morning, Central). For every team that schedules: the
 * reminders and the coordinator's note for sessions two days out, and on
 * Mondays the team's two-week look-ahead. Returns counts for the log.
 */
/**
 * Inactive is off a team's schedule (Jesse, 2026-10-19). Marking someone
 * inactive in the team's Members tab releases their sessions there and ends
 * their rotations; this catches anyone already inactive who still holds a
 * session or a rotation on that team (marked before the rule, or another
 * way). Each is released the same way, told, and the team hears about any
 * session in the next two weeks now left with no one. Runs first in the
 * daily pass, so the notices after it see those sessions as open.
 */
export async function releaseInactiveCoverage(): Promise<number> {
  let released = 0;
  // The same teams the daily pass and the Members tab act on: active, with
  // the Scheduler installed.
  const inactive = await db.hubMember.findMany({
    where: { status: "INACTIVE", hub: { status: "ACTIVE", appLinks: { some: { toolSlug: "schedule", isEnabled: true } } } },
    select: { userId: true, hub: { select: { slug: true } } },
  }).catch((err) => {
    console.error("[coverage-notices] finding inactive members failed", err);
    return [];
  });
  for (const m of inactive) {
    const hubSlug = m.hub.slug;
    try {
      const [sessions, rotations] = await Promise.all([
        db.hostAssignment.count({ where: { userId: m.userId, hubSlug, OR: [{ sessionDate: null }, { sessionDate: { gte: new Date() } }] } }),
        db.standingAssignment.count({ where: { userId: m.userId, hubSlug } }),
      ]);
      if (sessions === 0 && rotations === 0) continue;
      const result = await db.$transaction((tx) =>
        releasePersonCoverage(tx, m.userId, m.userId, { hubSlug, endRotations: true }),
      );
      released += result.rows.length;
      await sendCoverageClearedEmails({
        rows: result.rows,
        reason: (team) => `You're inactive on the ${team}, so your sessions there are open to the team.`,
      });
      const gaps = await prepareGapNotices(result.rows, [m.userId]);
      if (gaps.length) await deliverGapNotices(gaps);
      console.log(`[coverage-notices] released ${result.rows.length} session(s) and ${result.rotations} rotation(s) held by an inactive member on ${hubSlug}`);
    } catch (err) {
      console.error(`[coverage-notices] releasing an inactive member's sessions on ${hubSlug} failed`, err);
    }
  }
  return released;
}

export async function runDailyCoverageNotices(now: Date = new Date()): Promise<{
  releasedInactive: number; reminders: number; stillNeeded: number; lookaheads: number;
}> {
  const releasedInactive = await releaseInactiveCoverage();
  const today = centralDay(now);
  const reminderDay = addDays(today, REMINDER_DAYS_BEFORE);
  const isMonday = new Date(`${today}T12:00:00Z`).getUTCDay() === 1;
  const counts = { releasedInactive, reminders: 0, stillNeeded: 0, lookaheads: 0 };

  const teams = await db.hub.findMany({
    where: { status: "ACTIVE", appLinks: { some: { toolSlug: "schedule", isEnabled: true } } },
    select: { id: true, slug: true, allowsMultipleAssignments: true },
  });

  for (const team of teams) {
    try {
      const rows = await teamSessionsBetween(team.slug, today, addDays(today, LOOKAHEAD_DAYS - 1), now);
      const lineFor = (r: ScheduleSessionRow): CoverageSessionLine => ({
        programName: r.programName,
        sessionAt: r.sessionDate ? new Date(r.sessionDate) : null,
        note: r.status === "sub_needed" && r.hostName ? `${r.hostName} asked for cover` : null,
      });
      const twoDaysOut = rows.filter((r) => r.sessionDate && centralDay(r.sessionDate) === reminderDay);

      // 1. The people serving, two days before.
      const people = twoDaysOut.flatMap((r) =>
        team.allowsMultipleAssignments
          ? r.claimants.filter((c) => c.userId).map((c) => ({ row: r, assignmentId: c.assignmentId, userId: c.userId as string }))
          : r.hostUserId ? [{ row: r, assignmentId: r.id, userId: r.hostUserId }] : [],
      );
      if (people.length) {
        const members = await db.hubMember.findMany({
          where: { hubId: team.id, userId: { in: [...new Set(people.map((p) => p.userId))] } },
          select: { userId: true, status: true, communicationsEnabled: true, user: { select: { email: true, firstName: true, archivedAt: true } } },
        });
        const memberOf = new Map(members.map((m) => [m.userId, m]));
        for (const p of people) {
          const m = memberOf.get(p.userId);
          // A paused person who kept their sessions is still serving them, so
          // they are reminded too (Jesse, 2026-10-19). Inactive is not.
          if (!m || (m.status !== "ACTIVE" && m.status !== "PAUSED") || !m.communicationsEnabled || !m.user.email || m.user.archivedAt) continue;
          if (await alreadySent({ kind: "reminder", hubSlug: team.slug, assignmentId: p.assignmentId })) continue;
          const sessionAt = new Date(p.row.sessionDate as string);
          const program = await db.program.findUnique({
            where: { slug: p.row.programSlug },
            select: { outsideMeetingUrl: true },
          });
          const online = p.row.opensRoom && p.row.programFormat !== "in-person" && !program?.outsideMeetingUrl;
          try {
            await pause();
            await sendCoverageReminderEmail({
              to: m.user.email,
              firstName: m.user.firstName,
              hubSlug: team.slug,
              programName: p.row.programName,
              sessionAt,
              teamPicture: await sessionTeamPicture(p.row.programSlug, sessionAt),
              coverNote: p.row.status === "sub_needed"
                ? "You asked the team to cover this session, and no one has taken it yet, so it's still yours for now."
                : null,
              roomNote: online ? `You can open the room from My Home ${EARLY_OPEN_MIN} minutes before it starts.` : null,
            });
            await db.coverageNotice.create({
              data: {
                kind: "reminder", hubSlug: team.slug, programSlug: p.row.programSlug,
                sessionDay: reminderDay, sessionDate: sessionAt, assignmentId: p.assignmentId,
              },
            });
            counts.reminders++;
          } catch (e) {
            console.error("[coverage-notices] reminder failed", team.slug, p.assignmentId, e);
          }
        }
      }

      // 2. The coordinators: what's still open two days out.
      const open2: ScheduleSessionRow[] = [];
      for (const r of twoDaysOut.filter(needsSomeone)) {
        if (!(await alreadySent({ kind: "still-needed", hubSlug: team.slug, programSlug: r.programSlug, sessionDay: reminderDay }))) open2.push(r);
      }
      if (open2.length) {
        const coordinators = await getHubNotificationRecipients(team.slug, { coordinatorsOnly: true });
        if (coordinators.length === 0) console.log(`[coverage-notices] ${team.slug}: ${open2.length} open in two days, no coordinator to tell`);
        for (const c of coordinators) {
          if (!c.email) continue;
          try {
            await pause();
            await sendCoverageStillNeededEmail({ to: c.email, firstName: c.firstName, hubSlug: team.slug, sessions: open2.map(lineFor) });
          } catch (e) {
            console.error("[coverage-notices] still-needed email failed", team.slug, e);
          }
        }
        await db.coverageNotice.createMany({
          data: open2.map((r) => ({
            kind: "still-needed", hubSlug: team.slug, programSlug: r.programSlug,
            sessionDay: reminderDay, sessionDate: r.sessionDate ? new Date(r.sessionDate) : null,
          })),
        });
        counts.stillNeeded += open2.length;
      }

      // 3. Mondays: the team's next two weeks.
      if (isMonday) {
        const open = rows.filter(needsSomeone);
        if (open.length && !(await alreadySent({ kind: "lookahead", hubSlug: team.slug, sessionDay: today }))) {
          const recipients = await getHubNotificationRecipients(team.slug, { canCover: true });
          for (const u of recipients) {
            if (!u.email) continue;
            try {
              await pause();
              await sendCoverageLookaheadEmail({ to: u.email, firstName: u.firstName, hubSlug: team.slug, sessions: open.map(lineFor) });
            } catch (e) {
              console.error("[coverage-notices] look-ahead email failed", team.slug, e);
            }
          }
          await db.coverageNotice.create({ data: { kind: "lookahead", hubSlug: team.slug, sessionDay: today } });
          counts.lookaheads++;
        }
      }
    } catch (e) {
      console.error("[coverage-notices] team failed", team.slug, e);
    }
  }
  return counts;
}
