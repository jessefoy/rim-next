/**
 * /tools/schedule/session — Live session view for hosts.
 * Role gate: HOST, HOST_MANAGER, or ADMIN (handled by layout).
 *
 * Six states, computed server-side and refreshed every 60s by SessionLiveClient:
 *   1 — No session today
 *   2 — Session later today (>90 min out)
 *   3 — Getting ready (≤90 min to start)
 *   4 — Session is live
 *   5 — Session ended, report not yet filed
 *   6 — Report submitted (done)
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import SessionLiveClient, {
  type SessionProgram,
  type NextSession,
} from "@/components/SessionLiveClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live Session — Host Schedule" };

// ── Date helpers ──────────────────────────────────────────────────────────────

const ICAL_DAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function ctDateStr(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");
}

function todayCTStr(): string {
  return ctDateStr(new Date().toISOString());
}

function dateToDayCode(dateStr: string): string {
  return ICAL_DAY[new Date(dateStr + "T12:00:00").getDay()];
}

function ctDayBounds(dateStr: string): { startOfDay: Date; endOfDay: Date } {
  for (const offset of ["-05:00", "-06:00"]) {
    const noon = new Date(`${dateStr}T12:00:00${offset}`);
    const check = ctDateStr(noon.toISOString());
    if (check === dateStr) {
      return {
        startOfDay: new Date(`${dateStr}T00:00:00${offset}`),
        endOfDay:   new Date(`${dateStr}T23:59:59${offset}`),
      };
    }
  }
  return {
    startOfDay: new Date(`${dateStr}T00:00:00-06:00`),
    endOfDay:   new Date(`${dateStr}T23:59:59-06:00`),
  };
}

function shiftToDate(anchorISO: string, targetDate: string): Date {
  const anchor = new Date(anchorISO);
  const anchorCTDate = ctDateStr(anchorISO);
  if (anchorCTDate === targetDate) return anchor;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round(
    (new Date(targetDate + "T12:00:00").getTime() - new Date(anchorCTDate + "T12:00:00").getTime())
    / msPerDay
  );
  return new Date(anchor.getTime() + daysDiff * msPerDay);
}

function fmtTimeCT(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtTodayFull(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

// ── Postgres program type ────────────────────────────────────────────────────

interface PgProgram {
  id: string;
  name: string;
  slug: string;
  startDatetime: Date | null;
  endDatetime: Date | null;
  recurrenceFreq: string | null;
  recurrenceInterval: number | null;
  recurrenceDays: string[];
  recurrenceCount: number | null;
  zoomLink: string | null;
  meetHostAccount: string | null;
  registrationEnabled: boolean;
}

function isOccurrenceOnDate(p: PgProgram, dateStr: string): boolean {
  if (!p.startDatetime) return false;
  const anchor = ctDateStr(p.startDatetime.toISOString());
  if (anchor > dateStr) return false;
  if (!p.recurrenceFreq) return anchor === dateStr;

  if (p.recurrenceFreq === "weekly" || p.recurrenceFreq === "WEEKLY") {
    const days = p.recurrenceDays ?? [];
    if (days.length > 0 && !days.includes(dateToDayCode(dateStr))) return false;
    const n = p.recurrenceInterval ?? 1;
    if (n > 1) {
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksDiff = Math.round(
        (new Date(dateStr + "T12:00:00").getTime() - new Date(anchor + "T12:00:00").getTime())
        / msPerWeek
      );
      if (weeksDiff % n !== 0) return false;
    }
    if (p.recurrenceCount && p.recurrenceCount >= 2) {
      const daysPerCycle = p.recurrenceDays?.length ?? 1;
      const cyclesNeeded = Math.ceil((p.recurrenceCount - 1) / daysPerCycle);
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const lastMs = new Date(anchor + "T12:00:00").getTime()
        + cyclesNeeded * (p.recurrenceInterval ?? 1) * msPerWeek;
      if (new Date(dateStr + "T12:00:00").getTime() > lastMs) return false;
    }
    return true;
  }

  return anchor === dateStr;
}

/** Find the next occurrence of any program within the next 21 days. */
function findNextSession(programs: PgProgram[], afterDate: string): NextSession | null {
  for (let i = 1; i <= 21; i++) {
    const d = new Date(afterDate + "T12:00:00");
    d.setDate(d.getDate() + i);
    const dateStr = ctDateStr(d.toISOString());

    for (const p of programs) {
      if (isOccurrenceOnDate(p, dateStr)) {
        const startIso = p.startDatetime?.toISOString() ?? null;
        const start = startIso ? shiftToDate(startIso, dateStr) : null;
        const dayLabel = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
        const dateLabel = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
          month: "long", day: "numeric",
        });
        return {
          name: p.name,
          dayLabel,
          dateLabel,
          timeCT: start ? fmtTimeCT(start) : null,
        };
      }
    }
  }
  return null;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SessionToolPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const canView = roles.some((r) =>
    ["HOST", "HOST_MANAGER", "REGISTRAR", "ADMIN"].includes(r)
  );
  if (!canView) {
    return (
      <div className="hub-empty" style={{ padding: "40px 0" }}>
        You don&rsquo;t have access to this view.
      </div>
    );
  }

  const today = todayCTStr();
  const now = new Date();
  const { startOfDay, endOfDay } = ctDayBounds(today);

  const allPrograms = await db.program.findMany({
    where: {
      programFormat: { in: ["virtual", "hybrid"] },
      removeFromProgramList: false,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      startDatetime: true,
      endDatetime: true,
      recurrenceFreq: true,
      recurrenceInterval: true,
      recurrenceDays: true,
      recurrenceCount: true,
      zoomLink: true,
      meetHostAccount: true,
      registrationEnabled: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  const todayPrograms = allPrograms.filter((p) => isOccurrenceOnDate(p, today));
  const todaySlugs = todayPrograms.map((p) => p.slug);

  const [
    todayAttendance,
    todayReports,
    todayAssignments,
    todayCoHosts,
    mySubmittedReports,
    myCoHostReports,
  ] = await Promise.all([
    db.sessionAttendance.findMany({
      where: { joinedAt: { gte: startOfDay, lte: endOfDay } },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, preferredName: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    }),
    db.sessionReport.findMany({
      where: {
        sessionDate: startOfDay,
        sessionEndedAt: { not: null },
      },
      select: { programSlug: true, sessionEndedAt: true },
    }),
    todaySlugs.length > 0
      ? db.hostAssignment.findMany({
          where: {
            programSlug: { in: todaySlugs },
            sessionDate: startOfDay,
            userId: { not: null },
          },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
          },
        })
      : Promise.resolve([]),
    todaySlugs.length > 0
      ? db.sessionCoHost.findMany({
          where: { programSlug: { in: todaySlugs }, sessionDate: startOfDay },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
          },
        })
      : Promise.resolve([]),
    db.sessionReport.findMany({
      where: { sessionDate: startOfDay, hostId: userId },
      select: { programSlug: true },
    }),
    db.sessionCoHostReport.findMany({
      where: { sessionDate: startOfDay, userId },
      select: { programSlug: true },
    }),
  ]);

  const assignmentBySlug = new Map<string, { userId: string; name: string }>();
  for (const a of todayAssignments) {
    if (a.userId && a.user) {
      const name = a.user.preferredName || a.user.firstName || "Host";
      assignmentBySlug.set(a.programSlug, { userId: a.userId, name });
    }
  }

  const coHostsBySlug = new Map<string, Array<{ id: string; name: string }>>();
  for (const ch of todayCoHosts) {
    const name = ch.user.preferredName || ch.user.firstName || "Host";
    const list = coHostsBySlug.get(ch.programSlug) ?? [];
    list.push({ id: ch.userId, name });
    coHostsBySlug.set(ch.programSlug, list);
  }

  const sessionEndedBySlug = new Map<string, string>();
  for (const r of todayReports) {
    if (r.sessionEndedAt) sessionEndedBySlug.set(r.programSlug, r.sessionEndedAt.toISOString());
  }

  const myReportSlugs = new Set(mySubmittedReports.map((r) => r.programSlug));
  const myCoHostReportSlugs = new Set(myCoHostReports.map((r) => r.programSlug));

  const attendanceBySlug = new Map<string, typeof todayAttendance>();
  for (const record of todayAttendance) {
    const list = attendanceBySlug.get(record.programSlug) ?? [];
    list.push(record);
    attendanceBySlug.set(record.programSlug, list);
  }

  const registeredSlugs = todayPrograms.filter((p) => p.registrationEnabled).map((p) => p.slug);
  const registrationMap = new Map<
    string,
    Array<{ userId: string | null; firstName: string; lastName: string; email: string }>
  >();

  if (registeredSlugs.length > 0) {
    const regs = await db.registration.findMany({
      where: { programSlug: { in: registeredSlugs }, status: { not: "CANCELLED" } },
      select: { userId: true, firstName: true, lastName: true, email: true, programSlug: true },
    });
    for (const r of regs) {
      const list = registrationMap.get(r.programSlug) ?? [];
      list.push({ userId: r.userId ?? null, firstName: r.firstName, lastName: r.lastName, email: r.email });
      registrationMap.set(r.programSlug, list);
    }
  }

  const programs: SessionProgram[] = todayPrograms.map((p) => {
    const attendees = attendanceBySlug.get(p.slug) ?? [];
    const attendeeUserIds = new Set(attendees.map((a) => a.userId));

    const startIso = p.startDatetime?.toISOString() ?? null;
    const endIso = p.endDatetime?.toISOString() ?? null;
    const start = startIso ? shiftToDate(startIso, today) : null;
    const end   = endIso   ? shiftToDate(endIso,   today) : null;

    const sessionEnd = end ?? (start ? new Date(start.getTime() + 90 * 60_000) : null);
    const sessionEnded = sessionEnd ? now > sessionEnd : false;

    const programRegs = registrationMap.get(p.slug) ?? [];
    const notYetJoined = programRegs
      .filter((r) => !r.userId || !attendeeUserIds.has(r.userId))
      .map((r) => ({
        userId: r.userId,
        displayName: `${r.firstName} ${r.lastName.slice(0, 1)}.`,
        email: r.email,
      }));

    const assignment = assignmentBySlug.get(p.slug) ?? null;
    const coHosts = coHostsBySlug.get(p.slug) ?? [];
    const sessionEndedAt = sessionEndedBySlug.get(p.slug) ?? null;

    return {
      _id: p.id,
      slug: p.slug,
      name: p.name,
      startTimeCT: start ? fmtTimeCT(start) : null,
      endTimeCT:   end   ? fmtTimeCT(end)   : null,
      startDatetimeISO: start ? start.toISOString() : null,
      endDatetimeISO:   end   ? end.toISOString()   : null,
      sessionDateISO: startOfDay.toISOString(),
      zoomLink: p.zoomLink ?? null,
      meetHostAccount: p.meetHostAccount ?? null,
      isRegistered: !!p.registrationEnabled,
      sessionEnded,
      sessionEndedAt,
      assignedHost: assignment ? { id: assignment.userId, name: assignment.name } : null,
      coHosts,
      currentUserIsAssignedHost: assignment ? assignment.userId === userId : false,
      currentUserIsCoHost: coHosts.some((ch) => ch.id === userId),
      reportSubmitted: myReportSlugs.has(p.slug),
      coHostReportSubmitted: myCoHostReportSlugs.has(p.slug),
      postSessionPath: `/tools/schedule/session/${p.slug}/post`,
      attendees: attendees.map((a) => {
        const u = a.user;
        const first = u?.preferredName || u?.firstName || "";
        const last  = u?.lastName ? u.lastName.slice(0, 1) + "." : "";
        return {
          recordId: a.id,
          userId: a.userId,
          displayName: [first, last].filter(Boolean).join(" ") || "Unknown",
          isNewMember: a.isNewMember,
          returningAfterAbsence: a.returningAfterAbsence,
          flaggedByHost: a.flaggedByHost,
        };
      }),
      notYetJoined,
    };
  });

  const isCoordinator = roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
  const canEndSession = roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
  const programsWithReportsToday = todayReports.map((r) => r.programSlug);

  const nextSession = todayPrograms.length === 0
    ? findNextSession(allPrograms, today)
    : null;

  return (
    <>
      <SessionLiveClient
        programs={programs}
        todayCT={fmtTodayFull(today)}
        canEndSession={canEndSession}
        basePath="/tools/schedule/session"
        nextSession={nextSession}
        isCoordinator={isCoordinator}
        programsWithReportsToday={programsWithReportsToday}
      />
      <div className="sv-history-nav">
        <a
          href="/tools/schedule/session/history/team"
          className="sv-history-nav__link"
        >
          Session journal →
        </a>
      </div>
    </>
  );
}
