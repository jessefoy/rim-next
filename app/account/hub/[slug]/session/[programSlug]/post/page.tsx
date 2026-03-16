/**
 * /account/hub/[slug]/session/[programSlug]/post
 * Post-session form for the Host Team hub.
 * Access: HOST, HOST_MANAGER, REGISTRAR, ADMIN only.
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import PostSessionClient from "@/components/PostSessionClient";
import type { AssignedHost } from "@/components/PostSessionClient";

export const dynamic = "force-dynamic";

// ── Date helpers (same midnight-CT approach as session/page.tsx) ──────────────

function ctDateStr(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");
}

function todayCTStr(): string {
  return ctDateStr(new Date().toISOString());
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

function fmtDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long", month: "long", day: "numeric",
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PostSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; programSlug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { slug, programSlug } = await params;
  const { date: dateParam } = await searchParams;

  if (slug !== "host-team") notFound();

  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const canSubmit = roles.some((r) =>
    ["HOST", "HOST_MANAGER", "REGISTRAR", "ADMIN"].includes(r)
  );
  if (!canSubmit) {
    return (
      <div className="hub-empty" style={{ padding: "40px 0" }}>
        You don&rsquo;t have access to this view.
      </div>
    );
  }

  const today = todayCTStr();

  // Use ?date=YYYY-MM-DD param if provided and valid (past or today only — no future dates)
  const dateStr = (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam <= today)
    ? dateParam
    : today;

  const { startOfDay, endOfDay } = ctDayBounds(dateStr);

  // Midnight CT for the target date — used as the SessionReport sessionDate key
  const sessionDateKey = startOfDay;

  // Fetch today's attendance records for this program, including flagged ones
  const attendanceRecords = await db.sessionAttendance.findMany({
    where: {
      programSlug,
      joinedAt: { gte: startOfDay, lte: endOfDay },
    },
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
  });

  const userId = session.user.id;

  // Check if a report already exists for today (so we can pre-fill)
  // Also fetch the host assignment and co-host status for this program + today
  const [existingReport, todayAssignment, coHostRecord] = await Promise.all([
    db.sessionReport.findUnique({
      where: { programSlug_sessionDate: { programSlug, sessionDate: sessionDateKey } },
    }),
    db.hostAssignment.findFirst({
      where: {
        programSlug,
        sessionDate: sessionDateKey,
        userId: { not: null },
      },
      include: {
        user: { select: { firstName: true, lastName: true, preferredName: true } },
      },
    }),
    db.sessionCoHost.findUnique({
      where: { programSlug_sessionDate_userId: { programSlug, sessionDate: sessionDateKey, userId } },
      select: { id: true },
    }),
  ]);

  const assignedHost: AssignedHost | null = todayAssignment?.userId && todayAssignment.user
    ? {
        id: todayAssignment.userId,
        name: todayAssignment.user.preferredName || todayAssignment.user.firstName || "Host",
      }
    : null;

  // isCoHost = user has a co-host record AND is not the assigned host
  const isCoHost = !!coHostRecord && assignedHost?.id !== userId;

  const flaggedAttendees = attendanceRecords
    .filter((a) => a.flaggedByHost)
    .map((a) => {
      const u = a.user;
      const first = u?.preferredName || u?.firstName || "";
      const last  = u?.lastName ? u.lastName.slice(0, 1) + "." : "";
      return {
        attendanceId: a.id,
        displayName: [first, last].filter(Boolean).join(" ") || "Unknown",
        note:   a.postSessionNote ?? null,
        action: a.postSessionAction,
      };
    });

  const allAttendees = attendanceRecords.map((a) => {
    const u = a.user;
    const first = u?.preferredName || u?.firstName || "";
    const last  = u?.lastName ? u.lastName.slice(0, 1) + "." : "";
    return {
      attendanceId: a.id,
      displayName: [first, last].filter(Boolean).join(" ") || "Unknown",
      flaggedByHost: a.flaggedByHost,
    };
  });

  // For co-host: check if they already submitted their reflection
  const coHostReportExists = isCoHost
    ? await db.sessionCoHostReport.findUnique({
        where: { programSlug_sessionDate_userId: { programSlug, sessionDate: sessionDateKey, userId } },
        select: { id: true, reflection: true },
      })
    : null;

  return (
    <PostSessionClient
      programSlug={programSlug}
      sessionDate={sessionDateKey.toISOString()}
      sessionDateDisplay={fmtDate(sessionDateKey)}
      flaggedAttendees={flaggedAttendees}
      allAttendees={allAttendees}
      existingReflection={
        isCoHost
          ? (coHostReportExists?.reflection ?? null)
          : (existingReport?.reflection ?? null)
      }
      existingResourceUrl={isCoHost ? null : (existingReport?.resourceUrl ?? null)}
      existingResourceNote={isCoHost ? null : (existingReport?.resourceNote ?? null)}
      alreadySubmitted={isCoHost ? !!coHostReportExists : !!existingReport}
      assignedHost={assignedHost}
      backPath={`/account/hub/${slug}/session`}
      apiPath={
        isCoHost
          ? `/api/attendance/session/${programSlug}/cohost-report`
          : `/api/attendance/session/${programSlug}/post`
      }
      isCoHost={isCoHost}
    />
  );
}
