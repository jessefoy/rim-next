/**
 * /tools/schedule/session/[programSlug]/post — Post-session report form.
 * Role gate: HOST, HOST_MANAGER, or ADMIN (handled by layout).
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import PostSessionClient from "@/components/PostSessionClient";
import type { AssignedHost } from "@/components/PostSessionClient";

export const dynamic = "force-dynamic";

// ── Date helpers ──────────────────────────────────────────────────────────────

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

export default async function PostSessionToolPage({
  params,
  searchParams,
}: {
  params: Promise<{ programSlug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { programSlug } = await params;
  const { date: dateParam } = await searchParams;

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
  const dateStr = (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam <= today)
    ? dateParam
    : today;

  const { startOfDay, endOfDay } = ctDayBounds(dateStr);
  const sessionDateKey = startOfDay;

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

  const programRecord = await db.program.findUnique({
    where: { slug: programSlug },
    select: { name: true },
  });
  const programName = programRecord?.name ?? programSlug.replace(/-/g, " ");

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
        note:   (a.postSessionNote as object | null) ?? null,
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

  const coHostReportExists = isCoHost
    ? await db.sessionCoHostReport.findUnique({
        where: { programSlug_sessionDate_userId: { programSlug, sessionDate: sessionDateKey, userId } },
        select: { id: true, reflection: true },
      })
    : null;

  return (
    <PostSessionClient
      programSlug={programSlug}
      programName={programName}
      sessionDate={sessionDateKey.toISOString()}
      sessionDateDisplay={fmtDate(sessionDateKey)}
      flaggedAttendees={flaggedAttendees}
      allAttendees={allAttendees}
      existingReflection={(existingReport?.reflection as object | null) ?? null}
      existingResourceUrl={existingReport?.resourceUrl ?? null}
      existingResourceNote={existingReport?.resourceNote ?? null}
      alreadySubmitted={!!existingReport}
      assignedHost={assignedHost}
      backPath="/tools/schedule/session"
      apiPath={`/api/attendance/session/${programSlug}/post`}
    />
  );
}
