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
import { DEFAULT_HOSTING_HUB_SLUG } from "@/lib/programHub";

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

  // Resolve which hosting hub this schedule view is scoped to. Defaults to
  // host-team when ?hub= is absent. After Slice 1, peer-led hubs (Silent
  // Meditation, etc.) can reach this page via `?hub=peer-led-silent-meditation`
  // and see only their hub's programs and rotations.
  const { hub: hubSlug } = await searchParams;
  const activeHubSlug = hubSlug || DEFAULT_HOSTING_HUB_SLUG;

  // isManager = HOST_MANAGER/ADMIN OR a coordinator of *this* hub. Routed by
  // active hub so a Silent Meditation coordinator sees rotation controls
  // there without holding HOST_MANAGER globally.
  const coordinatorRecord = await db.hubMember.findFirst({
    where: { userId: session.user.id, hub: { slug: activeHubSlug }, isCoordinator: true },
    select: { id: true },
  });
  const isManager = isHostManager || !!coordinatorRecord;

  // Fetch hub context (members, coordinator) for the active hub
  const hubContext = await getToolHubContext(activeHubSlug);

  const coordinators = (hubContext?.members ?? [])
    .filter((m) => m.isCoordinator)
    .map((m) => m.user.preferredName || [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || null)
    .filter(Boolean) as string[];
  const coordinatorName = coordinators.length > 0 ? coordinators[0] : undefined;

  // Serialize the full member list for the client's member-picker dropdown.
  // Includes everyone in the host-team hub (active members), so volunteers
  // can view any teammate's schedule the same way a coordinator would.
  const teamMembers = (hubContext?.members ?? [])
    .map((m) => ({
      id: m.user.id,
      displayName:
        m.user.preferredName ||
        [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") ||
        "Unnamed",
      isCoordinator: m.isCoordinator,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const now = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth   = new Date(year, month + 1, 0, 23, 59, 59, 999);

  // Program filter for the active hub. host-team includes programs with
  // null `hostingHubSlug` (the default state — every existing program before
  // Slice 1 reads as host-team-hosted). Non-host-team hubs see only programs
  // explicitly transferred to them.
  const programHubFilter =
    activeHubSlug === DEFAULT_HOSTING_HUB_SLUG
      ? {
          OR: [
            { hostingHubSlug: null },
            { hostingHubSlug: DEFAULT_HOSTING_HUB_SLUG },
          ],
        }
      : { hostingHubSlug: activeHubSlug };

  const [pgPrograms, assignments, myRotationsRaw] = await Promise.all([
    db.program.findMany({
      where: {
        programFormat: { in: ["virtual", "hybrid"] },
        archivedAt: null,
        ...programHubFilter,
      },
      select: {
        id: true, name: true, slug: true,
        programFormat: true, startDatetime: true, endDatetime: true,
        recurrenceFreq: true, recurrenceInterval: true, recurrenceDays: true, recurrenceCount: true,
        livekitRoom: true, createdAt: true,
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
    // Standing rotations for the current user — drives "Your standing rotations"
    // summary at the top of the schedule. Coordinators see all rotations via the
    // Rotations tab; hosts see just their own rotations here so they understand
    // the recurring pattern that's putting sessions on their calendar.
    // The hub-scope filter is applied after the Promise.all (we don't yet
    // know the hub's program slugs at query time without sequencing the
    // queries). Filtering in memory is cheap — a user's rotation list is
    // tiny — and keeps the parallel fetch.
    db.standingAssignment.findMany({
      where: {
        userId: session.user.id,
        OR: [{ endsOn: null }, { endsOn: { gte: now } }],
      },
      orderBy: [{ programSlug: "asc" }, { occurrence: "asc" }],
    }),
  ]);

  // Hub-scope the rotations: only keep those whose program belongs to the
  // active hub. Without this, a peer-led-silent-meditation coordinator
  // viewing their hub's Scheduler would see host-team standing rotations
  // leaking into the "Your Rotations" panel (the bug Jesse caught in the
  // first Slice 2 test).
  const hubProgramSlugs = new Set(pgPrograms.map((p) => p.slug));
  const myRotationsRawScoped = myRotationsRaw.filter((r) =>
    hubProgramSlugs.has(r.programSlug),
  );

  // Build pause-state map: userId → "paused" | "inactive"
  // A single HubMember query covers all assigned hosts in the initial month
  // load. Scoped to the active hub: a Silent Meditation peer leader who is
  // also a host-team member shows their pause state from the hub the
  // schedule is currently scoped to, not the other one.
  const assignedUserIds = [...new Set(assignments.map((a) => a.userId).filter(Boolean))] as string[];
  const pauseMap = new Map<string, "paused" | "inactive">();
  if (assignedUserIds.length > 0) {
    const activeHub = await db.hub.findUnique({ where: { slug: activeHubSlug }, select: { id: true } });
    if (activeHub) {
      const hubMembers = await db.hubMember.findMany({
        where: { hubId: activeHub.id, userId: { in: assignedUserIds } },
        select: { userId: true, status: true, hostingCapability: true },
      });
      for (const m of hubMembers) {
        if (m.status === "INACTIVE") {
          pauseMap.set(m.userId, "inactive");
        } else if (m.status === "PAUSED" || !m.hostingCapability) {
          pauseMap.set(m.userId, "paused");
        }
      }
    }
  }

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
    /** ISO string of the program's createdAt — drives the "NEW" badge on cards. */
    programCreatedAt: string | null;
    /** If non-null, this assignment was created by a standing rotation. */
    standingAssignmentId: string | null;
    /** Coordinator-facing status badge for the assigned host, if not fully active. */
    hostBadge: "paused" | "inactive" | null;
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
          programCreatedAt: p.createdAt?.toISOString() ?? null,
          standingAssignmentId: a.standingAssignmentId ?? null,
          hostBadge: a.userId ? (pauseMap.get(a.userId) ?? null) : null,
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
          programCreatedAt: p.createdAt?.toISOString() ?? null,
          standingAssignmentId: null,
          hostBadge: null,
        });
      }
    }
  }

  // Serialize the current user's active rotations for the host-side summary.
  // Uses the hub-scoped list so cross-hub rotations don't leak into the
  // Your Rotations panel.
  const programNameBySlug = new Map(pgPrograms.map((p) => [p.slug, p.name]));
  const myRotations = myRotationsRawScoped.map((r) => ({
    id:          r.id,
    programSlug: r.programSlug,
    programName: programNameBySlug.get(r.programSlug) ?? r.programSlug,
    occurrence:  r.occurrence,
    dayOfWeek:   r.dayOfWeek ?? null,
    endsOn:      r.endsOn?.toISOString() ?? null,
  }));

  // Next upcoming HostAssignment per rotation program for this user.
  // Drives the "Next" column in the Your Rotations panel.  Uses the
  // hub-scoped rotation list so we don't fetch upcoming sessions for
  // programs that belong to other hubs.
  const rotationSlugs = [...new Set(myRotationsRawScoped.map((r) => r.programSlug))];
  const nextSessionBySlug: Record<string, string> = {};
  if (rotationSlugs.length > 0) {
    const upcoming = await db.hostAssignment.findMany({
      where: {
        userId: session.user.id,
        programSlug: { in: rotationSlugs },
        sessionDate: { gte: now },
      },
      orderBy: { sessionDate: "asc" },
      select: { programSlug: true, sessionDate: true },
    });
    for (const a of upcoming) {
      if (a.sessionDate && !nextSessionBySlug[a.programSlug]) {
        nextSessionBySlug[a.programSlug] = a.sessionDate.toISOString();
      }
    }
  }

  const serializedPrograms = pgPrograms.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    programFormat: p.programFormat ?? null,
    recurrenceDays: p.recurrenceDays ?? [],
  }));

  return (
    <div className="hub-content hub-content--wide">
      <HubScheduleClient
        initialSessions={sessions}
        programs={serializedPrograms}
        teamMembers={teamMembers}
        initialYear={year}
        initialMonth={month}
        currentUserId={session.user.id}
        currentUserName={session.user.name || session.user.email?.split("@")[0] || ""}
        coordinatorName={coordinatorName}
        isHostManager={isHostManager}
        isManager={isManager}
        myRotations={myRotations}
        nextSessionBySlug={nextSessionBySlug}
        apiBase="/api/host"
        hubSlug={activeHubSlug}
      />
    </div>
  );
}
