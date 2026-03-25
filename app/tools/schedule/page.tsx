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

export const dynamic = "force-dynamic";
export const metadata = { title: "Host Schedule — Tools" };

// ── Date helpers ──────────────────────────────────────────────────────────────

function ctDateStr(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");
}

const ICAL_DAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
function dateToDayCode(dateStr: string): string {
  return ICAL_DAY[new Date(dateStr + "T12:00:00").getDay()];
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

interface PgProgram {
  id: string;
  name: string;
  slug: string;
  programFormat: string | null;
  startDatetime: Date | null;
  endDatetime: Date | null;
  recurrenceFreq: string | null;
  recurrenceInterval: number | null;
  recurrenceDays: string[];
  recurrenceCount: number | null;
}

function isOccurrenceOnDate(p: PgProgram, dateStr: string): boolean {
  if (!p.startDatetime) return false;
  const anchor = ctDateStr(p.startDatetime.toISOString());
  if (anchor > dateStr) return false;
  if (!p.recurrenceFreq) return anchor === dateStr;

  const freq = p.recurrenceFreq.toUpperCase();
  if (freq === "WEEKLY") {
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ScheduleToolPage({
  searchParams,
}: {
  searchParams: Promise<{ hub?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

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
        apiBase="/api/host"
      />
    </div>
  );
}
