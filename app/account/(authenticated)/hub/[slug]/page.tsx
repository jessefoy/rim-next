/**
 * /account/hub/[slug] — Hub Home (default landing).
 *
 * New design (session 87):
 *   - Plain-language state sentence at top
 *   - Primary work card (tool hubs) or pinned-thread / task-for-you card (non-tool hubs)
 *   - Compact activity rail: recent conversations, open tasks (assigned to you), recent docs
 *   - Orientation block at bottom (only if coordinator has authored home content)
 *
 * Newcomers see the welcome interstitial once (firstVisitedAt).
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessHub, getHubMembership, effectiveCoordinator } from "@/lib/hubAuth";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";
import { getHubContext } from "@/lib/hubContext";
import { activeHubThreadWhere } from "@/lib/hubQueries";
import HubHomeClient from "@/components/HubHomeClient";
import { ctDateStr, isOccurrenceOnDate, type ScheduleProgram } from "@/lib/scheduleUtils";
import { getHubCoverageConfig, getHubCoverageCopy, getProgramSlugsForHub } from "@/lib/programHub";
import { getHubHomeApps } from "@/lib/hubApps";
import { listHubActivity } from "@/lib/hubActivity";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = await db.hub.findUnique({ where: { slug }, select: { name: true } });
  return { title: `${hub?.name ?? "Hub"} — Home` };
}

export default async function HubHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || !canAccessHub(member, session.user.roles ?? [])) redirect("/account/dashboard");

  // Snapshot lastVisitedAt BEFORE we update it, so unread counts use the previous visit
  const priorLastVisitedAt = member?.lastVisitedAt ?? null;

  // Update lastVisitedAt
  if (member) {
    await db.hubMember.update({
      where: { id: member.id },
      data: { lastVisitedAt: new Date() },
    });
  }

  const ctx = await getHubContext(
    hub.slug,
    hub.id,
    session.user.id,
    priorLastVisitedAt,
    member?.activitySeenAt ?? null,
    hub.conversationsEnabled,
  );

  const appLinks = await db.hubAppLink.findMany({
    where: { hubId: hub.id, isEnabled: true },
    orderBy: { order: "asc" },
  });
  const [pinnedThreads, recentActivity, homeContentHtml, welcomeBodyHtml, apps, thisMonth] = await Promise.all([
    hub.conversationsEnabled
      ? db.hubConversationThread.findMany({
          where: { ...activeHubThreadWhere(hub.id), isPinned: true },
          select: { id: true, title: true },
          orderBy: { pinnedAt: "desc" },
          take: 3,
        })
      : Promise.resolve([]),
    listHubActivity({
      hubId: hub.id,
      hubSlug: hub.slug,
      userId: session.user.id,
      conversationsEnabled: hub.conversationsEnabled,
      limit: 4,
    }),
    renderFormattedTextAsync(hub.homeContent),
    renderFormattedTextAsync(hub.welcomeBody),
    getHubHomeApps(hub.slug, appLinks),
    hub.hasSchedule ? loadHostHubThisMonth(hub.id, hub.slug) : Promise.resolve(null),
  ]);

  // Existing hosting-space members often predate firstVisitedAt. lastVisitedAt
  // prevents a surprise newcomer screen for them while new members still get
  // the universal welcome on their genuine first visit.
  const isNewcomer = member ? !member.firstVisitedAt && !priorLastVisitedAt : false;
  const hasWelcomeContent = !!hub.welcomeBody;
  const canEditContent = effectiveCoordinator(member, session.user.roles ?? []);

  return (
    <HubHomeClient
      slug={slug}
      hubName={hub.name}
      stateSentence={ctx.stateSentence}
      apps={apps}
      welcomeHeadline={hub.welcomeHeadline}
      welcomeBodyHtml={welcomeBodyHtml}
      welcomeBody={canEditContent && typeof hub.welcomeBody === "string" ? hub.welcomeBody : ""}
      isNewcomer={isNewcomer}
      hasWelcomeContent={hasWelcomeContent}
      showWelcomeOnHome={hub.hasSchedule}
      canEditContent={canEditContent}
      pinnedThreads={pinnedThreads}
      recentActivity={recentActivity.items}
      homeContentHtml={homeContentHtml}
      homeContent={canEditContent && typeof hub.homeContent === "string" ? hub.homeContent : ""}
      thisMonth={thisMonth}
    />
  );
}

/**
 * Compute "Our offerings this month" panel data for the host hub home.
 * Replicates the schedule tool's occurrence computation (every virtual/hybrid
 * program × every day in the current month, filtered through recurrence rules)
 * and rolls up into team-level aggregates. Sangha-friendly framing: "available"
 * emphasizes presence/willingness rather than absence; the split list avoids
 * putting "0" next to a member's name.
 */
async function loadHostHubThisMonth(hubId: string, hubSlug: string) {
  const now = new Date();
  const [yearText, monthText] = ctDateStr(now.toISOString()).split("-");
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  // Query a one-day UTC buffer on both sides, then bucket by CT date below.
  // Late-evening CT sessions can be stored on the following UTC date.
  const startOfMonth = new Date(Date.UTC(year, month, 1) - 24 * 60 * 60 * 1000);
  const endOfMonth = new Date(Date.UTC(year, month + 1, 1) + 24 * 60 * 60 * 1000);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(Date.UTC(year, month, 15, 12)).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    year: "numeric",
  });

  const [programSlugs, coverageConfig, coverageCopy] = await Promise.all([
    getProgramSlugsForHub(hubSlug),
    getHubCoverageConfig(hubSlug),
    getHubCoverageCopy(hubSlug),
  ]);

  const [programs, assignments, members] = await Promise.all([
    db.program.findMany({
      where: {
        slug: { in: programSlugs },
        programFormat: { in: coverageConfig?.appliesToFormats ?? ["virtual", "hybrid"] },
        archivedAt: null,
      },
      select: {
        id: true, slug: true, name: true,
        programFormat: true, startDatetime: true, endDatetime: true,
        recurrenceFreq: true, recurrenceInterval: true,
        recurrenceDays: true, recurrenceCount: true,
      },
    }),
    db.hostAssignment.findMany({
      where: {
        hubSlug,
        programSlug: { in: programSlugs },
        sessionDate: { gte: startOfMonth, lte: endOfMonth },
      },
      select: {
        userId: true,
        programSlug: true,
        sessionDate: true,
        subRequests: { where: { status: "OPEN" }, select: { id: true }, take: 1 },
      },
    }),
    db.hubMember.findMany({
      where: { hubId, status: "ACTIVE", hostingCapability: true },
      select: {
        isCoordinator: true,
        user: {
          select: {
            id: true, firstName: true, lastName: true, preferredName: true,
          },
        },
      },
    }),
  ]);

  // Index assignments by programSlug::dateStr for O(1) lookup
  const assignmentByKey = new Map<string, typeof assignments[number]>();
  for (const a of assignments) {
    const dateStr = a.sessionDate ? ctDateStr(a.sessionDate.toISOString()) : "";
    assignmentByKey.set(`${a.programSlug}::${dateStr}`, a);
  }

  // Walk every (day × program) and count occurrences via recurrence rules
  let totalSessions = 0;
  let openSessions = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    for (const p of programs) {
      if (!isOccurrenceOnDate(p as ScheduleProgram, dateStr)) continue;
      totalSessions++;
      const key = `${p.slug}::${dateStr}`;
      const a = assignmentByKey.get(key);
      // Open = no record, no assigned user, OR a pending sub request
      if (!a || !a.userId || a.subRequests.length > 0) {
        openSessions++;
      }
    }
  }

  // Per-member session counts (assignments only — recurrence-derived sessions
  // without a HostAssignment row don't credit anyone)
  const hostingCounts = new Map<string, number>();
  for (const a of assignments) {
    if (!a.userId) continue;
    const assignmentDate = a.sessionDate ? ctDateStr(a.sessionDate.toISOString()) : "";
    if (!assignmentDate.startsWith(`${year}-${String(month + 1).padStart(2, "0")}-`)) continue;
    hostingCounts.set(a.userId, (hostingCounts.get(a.userId) ?? 0) + 1);
  }

  type MemberEntry = { userId: string; name: string; count: number; isCoordinator: boolean };
  const hostingMembers: MemberEntry[] = [];
  const availableMembers: MemberEntry[] = [];

  for (const m of members) {
    const name =
      m.user.preferredName ||
      [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") ||
      "Unnamed";
    const count = hostingCounts.get(m.user.id) ?? 0;
    const entry = { userId: m.user.id, name, count, isCoordinator: m.isCoordinator };
    if (count > 0) hostingMembers.push(entry);
    else availableMembers.push(entry);
  }

  hostingMembers.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  availableMembers.sort((a, b) => a.name.localeCompare(b.name));

  return {
    monthLabel,
    coverageNoun: coverageCopy.noun,
    totalSessions,
    openSessions,
    hostingMembers,
    availableMembers,
  };
}
