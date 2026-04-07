/**
 * /account/hub/[slug] — Hub Home tab (default landing).
 *
 * Shows: hub description, coordinator, pinned threads, home content,
 * and recent activity summary (conversations, tasks, documents).
 * Newcomers (firstVisitedAt is null) see a welcome interstitial first.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";
import HubHomeClient from "@/components/HubHomeClient";

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

  // Update lastVisitedAt
  if (member) {
    await db.hubMember.update({
      where: { id: member.id },
      data: { lastVisitedAt: new Date() },
    });
  }

  // Pinned threads
  const pinnedThreads = await db.hubConversationThread.findMany({
    where: { hubId: hub.id, isPinned: true, status: "OPEN" },
    select: { id: true, title: true },
    orderBy: { pinnedAt: "desc" },
  });

  // Recent conversations (non-pinned, for activity summary)
  const recentThreads = await db.hubConversationThread.findMany({
    where: { hubId: hub.id, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      author: { select: { firstName: true, preferredName: true } },
      _count: { select: { replies: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  // Open tasks (assigned to user or unassigned)
  const userId = session.user.id;
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
          OR: [{ assigneeId: userId }, { assigneeId: null }],
        },
        select: { id: true, title: true, dueDate: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
    : [];

  // Recent documents
  const recentDocs = await db.hubDocument.findMany({
    where: { hubId: hub.id },
    select: { id: true, label: true, updatedAt: true, isNative: true },
    orderBy: { updatedAt: "desc" },
    take: 3,
  });

  // Coordinator names
  const coordinators = hub.members
    .filter((m) => m.isCoordinator)
    .map((m) => {
      const u = m.user;
      return (u as any).preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
    });

  // Render home content + welcome body as HTML (server-side)
  const homeContentHtml = await renderFormattedTextAsync(hub.homeContent);
  const welcomeBodyHtml = await renderFormattedTextAsync(hub.welcomeBody);

  // Determine if newcomer welcome should show
  const isNewcomer = member ? !member.firstVisitedAt : false;
  const hasWelcomeContent = !!(hub.welcomeBody);
  const isCoordinator = (member?.isCoordinator ?? false) || isAdmin;

  return (
    <HubHomeClient
      slug={slug}
      hubName={hub.name}
      description={hub.description}
      coordinatorNames={coordinators}
      pinnedThreads={pinnedThreads}
      homeContentHtml={homeContentHtml}
      homeContentJson={hub.homeContent}
      welcomeHeadline={hub.welcomeHeadline}
      welcomeBodyHtml={welcomeBodyHtml}
      isNewcomer={isNewcomer}
      hasWelcomeContent={hasWelcomeContent}
      isCoordinator={isCoordinator}
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
    />
  );
}
