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
import { getHubMembership, effectiveCoordinator } from "@/lib/hubAuth";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";
import { getHubContext } from "@/lib/hubContext";
import { activeHubThreadWhere } from "@/lib/hubQueries";
import HubHomeClient from "@/components/HubHomeClient";
import HostHubHomeClient from "@/components/HostHubHomeClient";
import { ctDateStr, isOccurrenceOnDate, type ScheduleProgram } from "@/lib/scheduleUtils";

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

  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!member && !isAdmin)) redirect("/account/dashboard");

  // Snapshot lastVisitedAt BEFORE we update it, so unread counts use the previous visit
  const priorLastVisitedAt = member?.lastVisitedAt ?? null;

  // Update lastVisitedAt
  if (member) {
    await db.hubMember.update({
      where: { id: member.id },
      data: { lastVisitedAt: new Date() },
    });
  }

  // Hosting hub: single unified home (one view for everyone). Coordinators have
  // an inline edit affordance on the welcome message; nothing else differs.
  // Below the welcome is the "Our offerings this month" panel — team
  // contribution + open coverage at a glance. Gated on hub.hasSchedule (a
  // schema field) rather than a slug literal so a future hosting hub works
  // without code changes.
  if (hub.hasSchedule) {
    const isCoordinator = effectiveCoordinator(member, session.user.roles ?? []);

    const [welcomeHtml, thisMonth] = await Promise.all([
      renderFormattedTextAsync(hub.welcomeBody),
      loadHostHubThisMonth(hub.id),
    ]);

    return (
      <HostHubHomeClient
        slug={slug}
        hubName={hub.name}
        canEditContent={isCoordinator}
        welcomeHtml={welcomeHtml}
        welcomeBody={isCoordinator ? (typeof hub.welcomeBody === "string" ? hub.welcomeBody : "") : ""}
        thisMonth={thisMonth}
      />
    );
  }

  const ctx = await getHubContext(hub.slug, hub.id, session.user.id, priorLastVisitedAt);

  // Pinned threads (always surfaced)
  const pinnedThreads = await db.hubConversationThread.findMany({
    where: { ...activeHubThreadWhere(hub.id), isPinned: true },
    select: { id: true, title: true },
    orderBy: { pinnedAt: "desc" },
    take: 3,
  });

  // Recent conversations
  const recentThreads = await db.hubConversationThread.findMany({
    where: { ...activeHubThreadWhere(hub.id), isPinned: false },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      author: { select: { firstName: true, preferredName: true } },
      _count: { select: { replies: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 4,
  });

  // Recent documents
  const recentDocs = await db.hubDocument.findMany({
    where: { hubId: hub.id },
    select: { id: true, label: true, updatedAt: true, isNative: true },
    orderBy: { updatedAt: "desc" },
    take: 3,
  });

  const homeContentHtml = await renderFormattedTextAsync(hub.homeContent);
  const welcomeBodyHtml = await renderFormattedTextAsync(hub.welcomeBody);

  const isNewcomer = member ? !member.firstVisitedAt : false;
  const hasWelcomeContent = !!hub.welcomeBody;

  return (
    <HubHomeClient
      slug={slug}
      hubName={hub.name}
      stateSentence={ctx.stateSentence}
      primaryTool={
        ctx.primaryTool
          ? {
              label: ctx.primaryTool.label,
              path: ctx.primaryTool.path,
              count: ctx.primaryCount,
              label_short: ctx.primaryLabel,
            }
          : null
      }
      welcomeHeadline={hub.welcomeHeadline}
      welcomeBodyHtml={welcomeBodyHtml}
      isNewcomer={isNewcomer}
      hasWelcomeContent={hasWelcomeContent}
      pinnedThreads={pinnedThreads}
      recentThreads={recentThreads.map((t) => ({
        id: t.id,
        title: t.title,
        authorName: t.author.preferredName || t.author.firstName || "Someone",
        replyCount: t._count.replies,
        updatedAt: t.updatedAt.toISOString(),
      }))}
      recentDocs={recentDocs.map((d) => ({
        id: d.id,
        label: d.label,
        isNative: d.isNative,
        updatedAt: d.updatedAt.toISOString(),
      }))}
      homeContentHtml={homeContentHtml}
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
async function loadHostHubThisMonth(hubId: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const [programs, assignments, members] = await Promise.all([
    db.program.findMany({
      where: { programFormat: { in: ["virtual", "hybrid"] }, archivedAt: null },
      select: {
        id: true, slug: true, name: true,
        programFormat: true, startDatetime: true, endDatetime: true,
        recurrenceFreq: true, recurrenceInterval: true,
        recurrenceDays: true, recurrenceCount: true,
      },
    }),
    db.hostAssignment.findMany({
      where: { sessionDate: { gte: startOfMonth, lte: endOfMonth } },
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
    totalSessions,
    openSessions,
    hostingMembers,
    availableMembers,
  };
}

