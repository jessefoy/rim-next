/**
 * /tools/schedule — Scheduler calendar.
 * Role gate: HOST, HOST_MANAGER, or ADMIN (handled by layout).
 *
 * Programs drive the schedule — not HostAssignment records.
 * Every program with the active hub's `appliesToFormats` that has an
 * occurrence this month appears on the calendar. HostAssignment records
 * are joined in (scoped to the active hub) to show who's covering each
 * session. Sessions with no assignment show as "Needs Coverage" in
 * single-slot hubs or "No one yet — be the first?" in multi-claim hubs.
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
import {
  DEFAULT_HOSTING_HUB_SLUG,
  getHubCoverageConfig,
  getHubCoverageCopy,
  getProgramSlugsForHub,
} from "@/lib/programHub";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scheduler — Tools" };

type PgProgram = ScheduleProgram;

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ScheduleToolPage({
  searchParams,
}: {
  searchParams: Promise<{ hub?: string; month?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const isHostManager = roles.includes("HOST_MANAGER") || roles.includes("ADMIN");

  // Resolve which hosting hub this schedule view is scoped to. Defaults to
  // host-team when ?hub= is absent. After Slice 1, peer-led hubs (Silent
  // Meditation, etc.) can reach this page via `?hub=peer-led-silent-meditation`
  // and see only their hub's programs and rotations.
  // `?month=YYYY-MM` (session 130) deep-links to a specific month — the
  // standing-assignment confirmation email and the Your Rotations panel's
  // "Next" affordance both pass it so hosts land on the actual month
  // containing their next session.
  const { hub: hubSlug, month: monthParam } = await searchParams;
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

  // Per-hub access gate (session 146): the Scheduler is gated per-hub, not just
  // per-tool. You see a hub's coverage board only if you're a member of that
  // hub OR hold an oversight role (HOST_MANAGER / ADMIN — both folded into
  // isHostManager — or GUIDING_TEACHER). This keeps a host-team member from
  // wandering into the greeter board and signing themselves up there, and is
  // the access half of the "covers ⇒ member" invariant.
  const isHubMember = (hubContext?.members ?? []).some(
    (m) => m.userId === session.user.id,
  );
  const canViewHubSchedule =
    isHubMember || isHostManager || roles.includes("GUIDING_TEACHER");
  if (!canViewHubSchedule) {
    const hubName = hubContext?.name ?? activeHubSlug;
    return (
      <div className="tools-unauthorized">
        <p>This is the {hubName} team&rsquo;s scheduler. You&rsquo;re not on that team, so its coverage board isn&rsquo;t shown here.</p>
        <p><a href="/account/dashboard">&larr; Back to your dashboard</a></p>
      </div>
    );
  }

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
  // `?month=YYYY-MM` (session 130) lets emails and in-app links deep-link
  // to a specific month. Validation is permissive — bad input falls back
  // to the current month rather than 404ing.
  const parsedMonth = (() => {
    if (!monthParam) return null;
    const match = /^(\d{4})-(\d{2})$/.exec(monthParam);
    if (!match) return null;
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
    if (m < 1 || m > 12) return null;
    // Sanity clamp — within a decade of "now" in either direction.
    const nowY = now.getFullYear();
    if (y < nowY - 10 || y > nowY + 10) return null;
    return { year: y, month: m - 1 }; // JS month is 0-indexed
  })();
  const year  = parsedMonth?.year  ?? now.getFullYear();
  const month = parsedMonth?.month ?? now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth   = new Date(year, month + 1, 0, 23, 59, 59, 999);

  // Hub config drives the program-format filter + the multi-claim flag.
  // host-team / peer-led: ["virtual","hybrid"]; AV / greeter: ["in-person","hybrid"].
  // Falls back to virtual/hybrid for unknown hubs so the page stays usable
  // even if config is incomplete.
  const hubConfig = await getHubCoverageConfig(activeHubSlug);
  const appliesToFormats = hubConfig?.appliesToFormats ?? ["virtual", "hybrid"];
  const allowsMultipleAssignments = hubConfig?.allowsMultipleAssignments ?? false;
  // Role-aware copy for this hub (session 130 follow-up). Threaded into
  // HubScheduleClient so UI strings ("You're hosting" / "Needs a host" /
  // toasts) speak the active hub's role rather than the host-team default.
  const coverageCopy = await getHubCoverageCopy(activeHubSlug);

  // Program filter for the active hub. Unions:
  //   1. Primary: programs whose `hostingHubSlug` is this hub (or null for
  //      host-team, which is the implicit default).
  //   2. Auxiliary: programs with a ProgramCoverageHub row pointing here
  //      (session 129 — AV / greeter coverage).
  // Format filter applied on top so an in-person-only program doesn't
  // surface in host-team's virtual-session view.
  const eligibleSlugs = await getProgramSlugsForHub(activeHubSlug);

  const [pgPrograms, assignments, myRotationsRaw] = await Promise.all([
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
        livekitRoom: true, createdAt: true,
      },
      orderBy: { sortOrder: "asc" },
    }),
    // HostAssignments are scoped per-hub (session 129) — only this hub's
    // rows surface. An AV claim and a host-team claim on the same session
    // are independent rows; the AV view shows the AV one.
    db.hostAssignment.findMany({
      where: {
        sessionDate: { gte: startOfMonth, lte: endOfMonth },
        hubSlug: activeHubSlug,
      },
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
    // Hub-scoped via the StandingAssignment.hubSlug column (session 129) so
    // a user with both a host-team rotation and an AV rotation sees only
    // the active hub's panel.
    db.standingAssignment.findMany({
      where: {
        userId: session.user.id,
        hubSlug: activeHubSlug,
        OR: [{ endsOn: null }, { endsOn: { gte: now } }],
      },
      orderBy: [{ programSlug: "asc" }, { occurrence: "asc" }],
    }),
  ]);

  // Already hub-scoped via the query; the in-memory filter Slice 2.6
  // needed is no longer required.
  const myRotationsRawScoped = myRotationsRaw;

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

  // Group assignments by (programSlug, dateStr) so multi-claimant hubs
  // (greeter) can render a stack of claimants on one card while single-
  // slot hubs (host-team, AV) get the historical one-host-per-card shape.
  const assignmentsByKey = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const dateStr = a.sessionDate ? ctDateStr(a.sessionDate.toISOString()) : "";
    const key = `${a.programSlug}::${dateStr}`;
    const bucket = assignmentsByKey.get(key);
    if (bucket) bucket.push(a);
    else assignmentsByKey.set(key, [a]);
  }

  type SessionStatus = "unclaimed" | "claimed" | "sub_needed";
  interface ClaimantSummary {
    assignmentId: string;
    userId: string | null;
    userName: string | null;
    /** Coordinator-facing status badge for this claimant, if not fully active. */
    badge: "paused" | "inactive" | null;
  }
  interface SessionItem {
    id: string;
    programSlug: string;
    programName: string;
    sessionDate: string | null;
    /** Occurrence end (program endDatetime shifted to this date), or null.
     *  Lets the client show "Enter room" only while the session is actually
     *  enterable, without a server round-trip. Mirrors lib/sessionWindow.ts. */
    sessionEnd: string | null;
    status: SessionStatus;
    hostUserId: string | null;
    hostName: string | null;
    /** Multi-claim hubs (greeter) populate this with every signed-up
     *  volunteer for the session. Single-slot hubs leave it empty and
     *  use hostUserId/hostName as before. */
    claimants: ClaimantSummary[];
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

  function nameOf(u: { firstName: string | null; lastName: string | null; preferredName: string | null } | null): string | null {
    if (!u) return null;
    return (
      u.preferredName ||
      [u.firstName, u.lastName].filter(Boolean).join(" ") ||
      null
    );
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    for (const p of pgPrograms) {
      if (!isOccurrenceOnDate(p, dateStr)) continue;

      const shiftedDate = p.startDatetime
        ? shiftToDate(p.startDatetime.toISOString(), dateStr)
        : null;
      // Same shift for the occurrence end so the client can tell whether the
      // room is enterable right now (mirrors lib/sessionWindow.ts).
      const shiftedEnd = p.endDatetime
        ? shiftToDate(p.endDatetime.toISOString(), dateStr)
        : null;
      const key = `${p.slug}::${dateStr}`;
      const bucket = assignmentsByKey.get(key);

      if (!bucket || bucket.length === 0) {
        // No rows in this hub for this session — render the empty card.
        // Single-slot hubs (host-team, AV) call this "Needs Coverage"; the
        // multi-claim view labels it "No one yet" via the client.
        sessions.push({
          id: `unassigned::${p.slug}::${dateStr}`,
          programSlug: p.slug,
          programName: p.name,
          sessionDate: shiftedDate?.toISOString() ?? null,
          sessionEnd: shiftedEnd?.toISOString() ?? null,
          status: "unclaimed",
          hostUserId: null,
          hostName: null,
          claimants: [],
          subRequestId: null,
          subMessage: null,
          programFormat: p.programFormat ?? null,
          programId: p.id,
          livekitRoom: p.livekitRoom ?? null,
          programCreatedAt: p.createdAt?.toISOString() ?? null,
          standingAssignmentId: null,
          hostBadge: null,
        });
        continue;
      }

      if (allowsMultipleAssignments) {
        // Multi-claim render: one card per session, listing every signed-up
        // volunteer. Sub-request flow doesn't apply here (open sign-up
        // semantics — release-my-claim is the only exit).
        const claimants: ClaimantSummary[] = bucket.map((a) => ({
          assignmentId: a.id,
          userId: a.userId ?? null,
          userName: nameOf(a.user),
          badge: a.userId ? (pauseMap.get(a.userId) ?? null) : null,
        }));
        const first = bucket[0];
        sessions.push({
          // Card id uses the synthetic key so the client can address it
          // even when many real assignment rows back it.
          id: `multi::${p.slug}::${dateStr}`,
          programSlug: p.slug,
          programName: p.name,
          sessionDate: shiftedDate?.toISOString() ?? null,
          sessionEnd: shiftedEnd?.toISOString() ?? null,
          status: "claimed",
          hostUserId: null,
          hostName: null,
          claimants,
          subRequestId: null,
          subMessage: null,
          programFormat: p.programFormat ?? null,
          programId: p.id,
          livekitRoom: p.livekitRoom ?? null,
          programCreatedAt: p.createdAt?.toISOString() ?? null,
          standingAssignmentId: first?.standingAssignmentId ?? null,
          hostBadge: null,
        });
        continue;
      }

      // Single-slot render (host-team, AV, peer-led) — historical shape.
      const a = bucket[0];
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
        sessionEnd: shiftedEnd?.toISOString() ?? null,
        status,
        hostUserId: a.userId ?? null,
        hostName: nameOf(a.user),
        claimants: [],
        subRequestId: openSub?.id ?? null,
        subMessage: openSub?.message ?? null,
        programFormat: p.programFormat ?? null,
        programId: p.id,
        livekitRoom: p.livekitRoom ?? null,
        programCreatedAt: p.createdAt?.toISOString() ?? null,
        standingAssignmentId: a.standingAssignmentId ?? null,
        hostBadge: a.userId ? (pauseMap.get(a.userId) ?? null) : null,
      });
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
  // Drives the "Next" column in the Your Rotations panel. Hub-scoped
  // (session 129) so an AV volunteer's "Next" reads their AV assignment,
  // not a host-team assignment on the same program.
  const rotationSlugs = [...new Set(myRotationsRawScoped.map((r) => r.programSlug))];
  const nextSessionBySlug: Record<string, string> = {};
  if (rotationSlugs.length > 0) {
    const upcoming = await db.hostAssignment.findMany({
      where: {
        userId: session.user.id,
        hubSlug: activeHubSlug,
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
        coverageCopy={coverageCopy}
        isManager={isManager}
        myRotations={myRotations}
        nextSessionBySlug={nextSessionBySlug}
        apiBase="/api/host"
        hubSlug={activeHubSlug}
        allowsMultipleAssignments={allowsMultipleAssignments}
      />
    </div>
  );
}
