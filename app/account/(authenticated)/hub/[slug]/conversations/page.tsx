/**
 * /account/hub/[slug]/conversations — Conversations tab
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import { activeHubThreadWhere } from "@/lib/hubQueries";
import HubConvClient from "@/components/HubConvClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = await db.hub.findUnique({ where: { slug }, select: { name: true } });
  return { title: `${hub?.name ?? "Hub"} — Conversations` };
}

export default async function HubConversationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!member && !isAdmin)) redirect("/account/dashboard");

  const priorLastVisitedAt = member?.lastVisitedAt?.toISOString() ?? null;

  if (member) {
    await db.hubMember.update({
      where: { id: member.id },
      data:  { lastVisitedAt: new Date() },
    });
  }

  const [threads, hubMemberRows, coordinatorRows] = await Promise.all([
    db.hubConversationThread.findMany({
      where:   activeHubThreadWhere(hub.id),
      include: {
        author: { select: { firstName: true, lastName: true, preferredName: true } },
        _count:  { select: { replies: true } },
      },
      orderBy: [
        { isPinned: "desc" },
        { pinnedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
    }),
    db.hubMember.findMany({
      where: {
        hubId:                 hub.id,
        status:                "ACTIVE",
        communicationsEnabled: true,
        userId:                { not: session.user.id },
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    }),
    db.hubMember.findMany({
      where:  { hubId: hub.id, isCoordinator: true, status: "ACTIVE" },
      select: { userId: true },
    }),
  ]);

  const isCoordinator =
    member?.isCoordinator || (session.user.roles ?? []).includes("ADMIN");

  const categories = hub.conversationCategories ?? ["General"];

  const serialized = threads.map((t) => ({
    id:         t.id,
    title:      t.title,
    body:       t.body,
    category:   t.category,
    status:     t.status,
    isPinned:   t.isPinned,
    authorId:   t.authorId,
    author: {
      firstName:     t.author.firstName,
      lastName:      t.author.lastName,
      preferredName: t.author.preferredName,
    },
    replyCount: t._count.replies,
    createdAt:  t.createdAt.toISOString(),
    updatedAt:  t.updatedAt.toISOString(),
  }));

  const serializedMembers = hubMemberRows.map((m) => ({
    id:            m.userId,
    firstName:     m.user.firstName,
    lastName:      m.user.lastName,
    preferredName: m.user.preferredName,
  }));

  const coordinatorIds = coordinatorRows.map((c) => c.userId);

  const userName =
    session.user.name ||
    session.user.email?.split("@")[0] ||
    "";

  return (
    <HubConvClient
      hubSlug={slug}
      initialThreads={serialized}
      categories={categories}
      isCoordinator={isCoordinator}
      currentUserId={session.user.id}
      currentUserName={userName}
      lastVisitedAt={priorLastVisitedAt}
      hubMembers={serializedMembers}
      coordinatorIds={coordinatorIds}
    />
  );
}
