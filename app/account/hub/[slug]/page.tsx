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
import { getHubMembership } from "@/lib/hubAuth";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";
import { getHubContext } from "@/lib/hubContext";
import HubHomeClient from "@/components/HubHomeClient";
import HostHubHomeClient from "@/components/HostHubHomeClient";

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

  // Host Hub: role-adaptive home (Phase 5). Coordinators (and admins) see a
  // different shell than hosts, with a session-scoped toggle to preview the
  // host view. Other hubs continue to use the generic HubHomeClient below.
  if (slug === "host-team") {
    const isCoordinator = (member?.isCoordinator ?? false) || isAdmin;

    let coordinatorAttention = null;
    let teamDirectoryHtml = "";
    if (isCoordinator) {
      coordinatorAttention = await loadHostHubAttention(hub.id, priorLastVisitedAt);
      teamDirectoryHtml = await renderFormattedTextAsync(hub.homeContent);
    }

    // Host-view data — always fetched so coordinators can preview the host view
    // via the in-page toggle without a round-trip.
    const hostData = await loadHostHubHostView(hub.id, session.user.id);
    const welcomeHtml = await renderFormattedTextAsync(hub.welcomeBody);

    return (
      <HostHubHomeClient
        slug={slug}
        hubName={hub.name}
        viewerRole={isCoordinator ? "coordinator" : "host"}
        canToggle={isCoordinator}
        canEditContent={isCoordinator}
        coordinatorAttention={coordinatorAttention}
        teamDirectoryHtml={teamDirectoryHtml}
        teamDirectoryJson={isCoordinator ? (hub.homeContent ?? null) : null}
        welcomeHtml={welcomeHtml}
        welcomeJson={isCoordinator ? (hub.welcomeBody ?? null) : null}
        pinnedThreads={hostData.pinnedThreads}
        teamRoster={hostData.teamRoster}
      />
    );
  }

  const ctx = await getHubContext(hub.slug, hub.id, session.user.id, priorLastVisitedAt);

  // Pinned threads (always surfaced)
  const pinnedThreads = await db.hubConversationThread.findMany({
    where: { hubId: hub.id, isPinned: true, status: "OPEN" },
    select: { id: true, title: true },
    orderBy: { pinnedAt: "desc" },
    take: 3,
  });

  // Recent conversations
  const recentThreads = await db.hubConversationThread.findMany({
    where: { hubId: hub.id, status: { not: "ARCHIVED" }, isPinned: false },
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

  // Open tasks assigned to the viewer
  const taskLists = await db.taskList.findMany({
    where: { hubId: hub.id, isArchived: false },
    select: { id: true },
  });
  const listIds = taskLists.map((l) => l.id);
  const openTasks = listIds.length > 0
    ? await db.task.findMany({
        where: {
          listId: { in: listIds },
          status: { not: "DONE" },
          assigneeId: session.user.id,
        },
        select: { id: true, title: true, dueDate: true, status: true },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 4,
      })
    : [];

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
      openTasks={openTasks.map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate?.toISOString() ?? null,
        status: t.status,
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
 * Host Hub — coordinator attention data.
 *
 * Four lists that tell a coordinator what needs follow-up. Hub-specific for
 * now (see UP_NEXT.md / Phase 5 spec). Generalize when a second hub asks for
 * its own attention view.
 */
async function loadHostHubAttention(hubId: string, priorLastVisitedAt: Date | null) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 1. Pending new hosts — HubMember joined in the last 7 days.
  const newHosts = await db.hubMember.findMany({
    where: {
      hubId,
      joinedAt: { gte: sevenDaysAgo },
      status: "ACTIVE",
    },
    select: {
      id: true,
      joinedAt: true,
      user: {
        select: { id: true, firstName: true, lastName: true, preferredName: true },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  // 2. Unassigned virtual/hybrid programs in the next 30 days.
  // Mirrors app/api/cron/check-unassigned-hosts logic — "standing" assignment
  // means sessionDate is null (covers all occurrences of a recurring program).
  const upcomingPrograms = await db.program.findMany({
    where: {
      programFormat: { in: ["virtual", "hybrid"] },
      startDatetime: { gte: now, lte: in30Days },
    },
    select: { id: true, name: true, slug: true, startDatetime: true },
    orderBy: { startDatetime: "asc" },
  });
  const assignedSlugs = upcomingPrograms.length === 0
    ? new Set<string>()
    : await db.hostAssignment
        .findMany({
          where: {
            programSlug: { in: upcomingPrograms.map((p) => p.slug) },
            sessionDate: null,
          },
          select: { programSlug: true },
          distinct: ["programSlug"],
        })
        .then((rows) => new Set(rows.map((r) => r.programSlug)));
  const unassignedPrograms = upcomingPrograms.filter((p) => !assignedSlugs.has(p.slug));

  // 3. Unclaimed sub requests — any OPEN regardless of program.
  const openSubs = await db.subRequest.findMany({
    where: { status: "OPEN" },
    select: {
      id: true,
      programSlug: true,
      sessionDate: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // 4. New conversation threads since the coordinator's last visit.
  const newThreads = priorLastVisitedAt
    ? await db.hubConversationThread.findMany({
        where: {
          hubId,
          status: { not: "ARCHIVED" },
          createdAt: { gt: priorLastVisitedAt },
        },
        select: {
          id: true,
          title: true,
          createdAt: true,
          author: { select: { firstName: true, preferredName: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return {
    newHosts: newHosts.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name:
        m.user.preferredName ||
        [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") ||
        "New member",
      joinedAt: m.joinedAt.toISOString(),
    })),
    unassignedPrograms: unassignedPrograms.map((p) => ({
      slug: p.slug,
      name: p.name,
      startDatetime: p.startDatetime?.toISOString() ?? null,
    })),
    openSubs: openSubs.map((s) => ({
      id: s.id,
      programSlug: s.programSlug,
      sessionDate: s.sessionDate?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    })),
    newThreads: newThreads.map((t) => ({
      id: t.id,
      title: t.title,
      authorName: t.author.preferredName || t.author.firstName || "Someone",
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

/**
 * Host Hub — host-view data (pinned threads + team roster).
 *
 * The roster lists every ACTIVE hub member except the viewer themselves. The
 * host view intentionally does not filter on hostingCapability — someone who
 * is paused is still part of the team and should still be visible on the
 * directory. Paused state is surfaced in the badge instead.
 */
async function loadHostHubHostView(hubId: string, viewerId: string) {
  const [pinned, roster] = await Promise.all([
    db.hubConversationThread.findMany({
      where: { hubId, isPinned: true, status: "OPEN" },
      select: { id: true, title: true },
      orderBy: { pinnedAt: "desc" },
      take: 5,
    }),
    db.hubMember.findMany({
      where: { hubId, status: "ACTIVE", userId: { not: viewerId } },
      select: {
        id: true,
        isCoordinator: true,
        position: true,
        status: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            title: true,
            avatarUrl: true,
            bio: true,
          },
        },
      },
      orderBy: [{ isCoordinator: "desc" }, { joinedAt: "asc" }],
    }),
  ]);

  return {
    pinnedThreads: pinned,
    teamRoster: await Promise.all(
      roster.map(async (m) => ({
        id: m.id,
        userId: m.user.id,
        name:
          m.user.preferredName ||
          [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") ||
          "Team member",
        title: m.position || m.user.title || null,
        avatarUrl: m.user.avatarUrl,
        isCoordinator: m.isCoordinator,
        bioHtml: await renderFormattedTextAsync(m.user.bio),
      })),
    ),
  };
}
