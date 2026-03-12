/**
 * /account/hub/[slug]/session — Live session view for Host Team hub.
 * Access: HOST, HOST_MANAGER, REGISTRAR, ADMIN only.
 * Shows today's virtual/hybrid programs with real-time attendance.
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { sanityClient } from "@/lib/sanity";
import { sessionViewProgramsQuery } from "@/lib/queries";
import SessionLiveClient, { type SessionProgram } from "@/components/SessionLiveClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live Session — Host Team Hub" };

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

/**
 * Returns UTC Date boundaries for a CT calendar date "YYYY-MM-DD".
 * Handles both CDT (-05:00) and CST (-06:00) automatically.
 */
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
  // Fallback: CST
  return {
    startOfDay: new Date(`${dateStr}T00:00:00-06:00`),
    endOfDay:   new Date(`${dateStr}T23:59:59-06:00`),
  };
}

function shiftToToday(anchorISO: string, today: string): Date {
  const anchor = new Date(anchorISO);
  const anchorCTDate = ctDateStr(anchorISO);
  if (anchorCTDate === today) return anchor;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round(
    (new Date(today + "T12:00:00").getTime() - new Date(anchorCTDate + "T12:00:00").getTime())
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

// ── Sanity type ───────────────────────────────────────────────────────────────

interface SanityProgram {
  _id: string;
  name: string;
  slug: string;
  startDatetime: string | null;
  endDatetime: string | null;
  recurrenceFreq: string | null;
  recurrenceInterval: number | null;
  recurrenceDays: string[] | null;
  recurrenceCount: number | null;
  zoomLink: string | null;
  registrationEnabled: boolean | null;
}

function isOccurrenceToday(p: SanityProgram, today: string): boolean {
  if (!p.startDatetime) return false;
  const anchor = ctDateStr(p.startDatetime);
  if (anchor > today) return false;
  if (!p.recurrenceFreq) return anchor === today;

  if (p.recurrenceFreq === "weekly") {
    const days = p.recurrenceDays ?? [];
    if (days.length > 0 && !days.includes(dateToDayCode(today))) return false;
    const n = p.recurrenceInterval ?? 1;
    if (n > 1) {
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksDiff = Math.round(
        (new Date(today + "T12:00:00").getTime() - new Date(anchor + "T12:00:00").getTime())
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
      if (new Date(today + "T12:00:00").getTime() > lastMs) return false;
    }
    return true;
  }

  return anchor === today;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SessionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // This tab only exists on host-team hub
  if (slug !== "host-team") notFound();

  const session = await auth();
  if (!session) redirect("/login");

  // Role check — HOST, HOST_MANAGER, REGISTRAR, ADMIN only
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

  // Fetch programs + today's attendance + today's session reports in parallel
  const [allPrograms, todayAttendance, todayReports] = await Promise.all([
    sanityClient.fetch<SanityProgram[]>(sessionViewProgramsQuery),
    db.sessionAttendance.findMany({
      where: { joinedAt: { gte: startOfDay, lte: endOfDay } },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            preferredName: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    }),
    db.sessionReport.findMany({
      where: {
        sessionDate: startOfDay, // CT midnight = today's date key
        sessionEndedAt: { not: null },
      },
      select: { programSlug: true, sessionEndedAt: true },
    }),
  ]);

  // Filter to today's occurrences early so we can scope the assignment query
  const todayPrograms = allPrograms.filter((p) => isOccurrenceToday(p, today));

  // Fetch today's host assignments for programs running today
  const todaySlugs = todayPrograms.map((p) => p.slug);
  const todayAssignments = todaySlugs.length > 0
    ? await db.hostAssignment.findMany({
        where: {
          programSlug: { in: todaySlugs },
          sessionDate: startOfDay, // CT midnight = today's assignment date key
          userId: { not: null },
        },
        include: {
          user: { select: { firstName: true, lastName: true, preferredName: true } },
        },
      })
    : [];

  const assignmentBySlug = new Map<string, { userId: string; name: string }>();
  for (const a of todayAssignments) {
    if (a.userId && a.user) {
      const name = a.user.preferredName || a.user.firstName || "Host";
      assignmentBySlug.set(a.programSlug, { userId: a.userId, name });
    }
  }

  // Index session-ended reports by programSlug
  const sessionEndedBySlug = new Map<string, string>(); // slug → ISO timestamp
  for (const r of todayReports) {
    if (r.sessionEndedAt) sessionEndedBySlug.set(r.programSlug, r.sessionEndedAt.toISOString());
  }

  // Group attendance by programSlug
  const attendanceBySlug = new Map<string, typeof todayAttendance>();
  for (const record of todayAttendance) {
    const list = attendanceBySlug.get(record.programSlug) ?? [];
    list.push(record);
    attendanceBySlug.set(record.programSlug, list);
  }

  // Fetch registrations for registered programs
  const registeredSlugs = todayPrograms
    .filter((p) => p.registrationEnabled)
    .map((p) => p.slug);

  const registrationMap = new Map<
    string,
    Array<{ userId: string | null; firstName: string; lastName: string; email: string }>
  >();

  if (registeredSlugs.length > 0) {
    const regs = await db.registration.findMany({
      where: {
        programSlug: { in: registeredSlugs },
        status: { not: "CANCELLED" },
      },
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        email: true,
        programSlug: true,
      },
    });
    for (const r of regs) {
      const list = registrationMap.get(r.programSlug) ?? [];
      list.push({ userId: r.userId ?? null, firstName: r.firstName, lastName: r.lastName, email: r.email });
      registrationMap.set(r.programSlug, list);
    }
  }

  // Build serialized data for client component
  const programs: SessionProgram[] = todayPrograms.map((p) => {
    const attendees = attendanceBySlug.get(p.slug) ?? [];
    const attendeeUserIds = new Set(attendees.map((a) => a.userId));

    const start = p.startDatetime ? shiftToToday(p.startDatetime, today) : null;
    const end   = p.endDatetime   ? shiftToToday(p.endDatetime,   today) : null;

    // Session ended if end time (or start + 90min) has passed
    const sessionEnd = end ?? (start ? new Date(start.getTime() + 90 * 60_000) : null);
    const sessionEnded = sessionEnd ? now > sessionEnd : false;

    // Registered but not yet joined (by userId; fall back to always shown if no userId)
    const programRegs = registrationMap.get(p.slug) ?? [];
    const notYetJoined = programRegs
      .filter((r) => !r.userId || !attendeeUserIds.has(r.userId))
      .map((r) => ({
        userId: r.userId,
        displayName: `${r.firstName} ${r.lastName.slice(0, 1)}.`,
        email: r.email,
      }));

    const assignment = assignmentBySlug.get(p.slug) ?? null;
    const sessionEndedAt = sessionEndedBySlug.get(p.slug) ?? null;

    return {
      _id: p._id,
      slug: p.slug,
      name: p.name,
      startTimeCT: start ? fmtTimeCT(start) : null,
      endTimeCT:   end   ? fmtTimeCT(end)   : null,
      isRegistered: !!p.registrationEnabled,
      sessionEnded,
      sessionEndedAt, // null or ISO string when host manually ended the session
      assignedHost: assignment ? { id: assignment.userId, name: assignment.name } : null,
      postSessionPath: `/account/hub/${slug}/session/${p.slug}/post`,
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

  const isManager = roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
  // HOST, HOST_MANAGER, and ADMIN can close a session early
  const canEndSession = roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));

  return (
    <>
      <SessionLiveClient
        programs={programs}
        todayCT={fmtTodayFull(today)}
        canEndSession={canEndSession}
      />
      <div className="sv-history-nav">
        <a
          href={`/account/hub/${slug}/session/history/team`}
          className="sv-history-nav__link"
        >
          Session journal →
        </a>
        {isManager && (
          <a
            href={`/account/hub/${slug}/session/history`}
            className="sv-history-nav__link sv-history-nav__link--coord"
          >
            Coordinator history →
          </a>
        )}
      </div>
    </>
  );
}
