/**
 * /tools/schedule — Host Schedule calendar.
 * Role gate: HOST, HOST_MANAGER, or ADMIN (handled by layout).
 *
 * Programs drive the schedule — not HostAssignment records.
 * Every virtual/hybrid program that has an occurrence this month appears
 * on the calendar. HostAssignment records are joined in to show who's
 * covering each session. Sessions with no assignment show as "Needs Coverage."
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getToolHubContext } from "@/lib/toolAuth";
import HubScheduleClient from "@/components/HubScheduleClient";
import {
  ctDateStr, shiftToDate, isOccurrenceOnDate,
  type ScheduleProgram,
} from "@/lib/scheduleUtils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Host Schedule — Tools" };

type PgProgram = ScheduleProgram;

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ScheduleToolPage({
  searchParams,
}: {
  searchParams: Promise<{ hub?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const isHostManager = roles.includes("HOST_MANAGER") || roles.includes("ADMIN");

  // Fetch hub context (members, coordinator) from ?hub= param or fall back to host-team
  const { hub: hubSlug } = await searchParams;
  const hubContext = await getToolHubContext(hubSlug || "host-team");

  const coordinators = (hubContext?.members ?? [])
    .filter((m) => m.isCoordinator)
    .map((m) => m.user.preferredName || [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || null)
    .filter(Boolean) as string[];
  const coordinatorName = coordinators.length > 0 ? coordinators[0] : undefined;

  const now = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth   = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const [pgPrograms, assignments] = await Promise.all([
    db.program.findMany({
      where: {
        programFormat: { in: ["virtual", "hybrid"] },
        archivedAt: null,
      },
      select: {
        id: true, name: true, slug: true,
        programFormat: true, startDatetime: true, endDatetime: true,
        recurrenceFreq: true, recurrenceInterval: true, recurrenceDays: true, recurrenceCount: true,
        livekitRoom: true,
      },
      orderBy: { sortOrder: "asc" },
    }),
    db.hostAssignment.findMany({
      where: { sessionDate: { gte: startOfMonth, lte: endOfMonth } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        subRequests: { where: { status: "OPEN" }, select: { id: true, message: true }, take: 1 },
      },
      orderBy: { sessionDate: "asc" },
    }),
  ]);

  const assignmentMap = new Map(
    assignments.map((a) => {
      const dateStr = a.sessionDate ? ctDateStr(a.sessionDate.toISOString()) : "";
      return [`${a.programSlug}::${dateStr}`, a];
    })
  );

  type SessionStatus = "unclaimed" | "claimed" | "sub_needed";
  interface SessionItem {
    id: string;
    programSlug: string;
    programName: string;
    sessionDate: string | null;
    status: SessionStatus;
    hostUserId: string | null;
    hostName: string | null;
    subRequestId: string | null;
    subMessage: any;
    programFormat: string | null;
    programId: string | null;
    livekitRoom: string | null;
  }

  const sessions: SessionItem[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    for (const p of pgPrograms) {
      if (!isOccurrenceOnDate(p, dateStr)) continue;

      const shiftedDate = p.startDatetime
        ? shiftToDate(p.startDatetime.toISOString(), dateStr)
        : null;
      const key = `${p.slug}::${dateStr}`;
      const a = assignmentMap.get(key);

      if (a) {
        const openSub = a.subRequests[0] ?? null;
        const status: SessionStatus = !a.userId
          ? "unclaimed"
          : openSub
          ? "sub_needed"
          : "claimed";
        sessions.push({
          id: a.id,
          programSlug: p.slug,
          programName: p.name,
          sessionDate: shiftedDate?.toISOString() ?? null,
          status,
          hostUserId: a.userId ?? null,
          hostName: a.user
            ? (a.user.preferredName ||
                [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") ||
                null)
            : null,
          subRequestId: openSub?.id ?? null,
          subMessage: openSub?.message ?? null,
          programFormat: p.programFormat ?? null,
          programId: p.id,
          livekitRoom: p.livekitRoom ?? null,
        });
      } else {
        sessions.push({
          id: `unassigned::${p.slug}::${dateStr}`,
          programSlug: p.slug,
          programName: p.name,
          sessionDate: shiftedDate?.toISOString() ?? null,
          status: "unclaimed",
          hostUserId: null,
          hostName: null,
          subRequestId: null,
          subMessage: null,
          programFormat: p.programFormat ?? null,
          programId: p.id,
          livekitRoom: p.livekitRoom ?? null,
        });
      }
    }
  }

  const serializedPrograms = pgPrograms.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    programFormat: p.programFormat ?? null,
  }));

  return (
    <div className="hub-content hub-content--wide">
      <HubScheduleClient
        initialSessions={sessions}
        programs={serializedPrograms}
        initialYear={year}
        initialMonth={month}
        currentUserId={session.user.id}
        currentUserName={session.user.name || session.user.email?.split("@")[0] || ""}
        coordinatorName={coordinatorName}
        isHostManager={isHostManager}
        apiBase="/api/host"
      />
    </div>
  );
}
