/**
 * /account/hub/[slug]/conversations — Conversations tab
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
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

  if (member) {
    await db.hubMember.update({
      where: { id: member.id },
      data:  { lastVisitedAt: new Date() },
    });
  }

  const threads = await db.hubConversationThread.findMany({
    where:   { hubId: hub.id, status: "OPEN" },
    include: {
      author: { select: { firstName: true, lastName: true, preferredName: true } },
      _count:  { select: { replies: true } },
    },
    orderBy: [
      { isPinned: "desc" },
      { pinnedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  });

  const isCoordinator =
    member?.isCoordinator || (session.user.roles ?? []).includes("ADMIN");

  const serialized = threads.map((t) => ({
    id:         t.id,
    title:      t.title,
    body:       t.body,
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

  const userName =
    session.user.name ||
    session.user.email?.split("@")[0] ||
    "";

  return (
    <HubConvClient
      hubSlug={slug}
      initialThreads={serialized}
      isCoordinator={isCoordinator}
      currentUserId={session.user.id}
      currentUserName={userName}
    />
  );
}
