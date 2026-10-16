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
import { ctMonthKey } from "@/lib/timezone";
import { getToolHubContext } from "@/lib/toolAuth";
import HubScheduleClient from "@/components/HubScheduleClient";
import { buildHubMonthSessions } from "@/lib/scheduleSessions";
import { DEFAULT_HOSTING_HUB_SLUG, getHubCoverageCopy } from "@/lib/programHub";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scheduler - Tools" };

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
  // `?month=YYYY-MM` (session 130) deep-links to a specific month so the
  // standing-assignment confirmation email can land hosts on the actual
  // month containing their next session.
  const { hub: hubSlug, month: monthParam } = await searchParams;
  const activeHubSlug = hubSlug || DEFAULT_HOSTING_HUB_SLUG;

  // isManager = HOST_MANAGER/ADMIN OR a coordinator of *this* hub. Routed by
  // active hub so a Silent Meditation coordinator sees rotation controls
  // there without holding HOST_MANAGER globally.
  const coordinatorRecord = await db.hubMember.findFirst({
    where: { userId: session.user.id, hub: { slug: activeHubSlug }, isCoordinator: true, status: "ACTIVE" },
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
  // This month means this month in Central Time, and its bounds are Central
  // midnights (2026-10-15: both were UTC).
  const [ctY, ctM] = ctMonthKey(now).split("-").map(Number);
  const year  = parsedMonth?.year  ?? ctY;
  const month = parsedMonth?.month ?? ctM - 1;

  // The month's rows, from the one builder the month navigation also uses.
  const { sessions, programs: serializedPrograms, allowsMultipleAssignments } =
    await buildHubMonthSessions(activeHubSlug, year, month);
  // Does this team run the session (a hosting team) or staff a supporting
  // role? Picks the empty-state instructions.
  const hostsSessions = !!(await db.hub.findUnique({ where: { slug: activeHubSlug }, select: { hasSchedule: true } }))?.hasSchedule;
  // Role-aware copy for this team ("You're hosting" / "Needs a greeter").
  const coverageCopy = await getHubCoverageCopy(activeHubSlug);

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
        apiBase="/api/host"
        hubSlug={activeHubSlug}
        allowsMultipleAssignments={allowsMultipleAssignments}
        hubName={hubContext?.name ?? activeHubSlug}
        hostsSessions={hostsSessions}
      />
    </div>
  );
}
