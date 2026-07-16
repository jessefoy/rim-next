/**
 * /account/hub/[slug]/activity — hub activity stream
 *
 * New conversation threads and replies, newest first. (Native Documents were
 * retired in session 165, so the stream is conversation activity.)
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import HubActivityClient from "@/components/HubActivityClient";

export const dynamic = "force-dynamic";

type ActivityItem =
  | { type: "hub_thread"; id: string; threadId: string; threadTitle: string; authorId: string; authorName: string; ts: string }
  | { type: "hub_reply";  id: string; threadId: string; threadTitle: string; authorId: string; authorName: string; ts: string };

function personName(u: { firstName: string | null; lastName: string | null; preferredName: string | null }) {
  const first = u.preferredName || u.firstName;
  return [first, u.lastName].filter(Boolean).join(" ") || "Someone";
}

export default async function HubActivityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || !canAccessHub(member, session.user.roles ?? [])) redirect("/account/dashboard");

  const LIMIT = 30;

  const [hubThreads, hubReplies] = await Promise.all([
    db.hubConversationThread.findMany({
      where: { hubId: hub.id, deletedAt: null },
      select: {
        id: true, title: true, authorId: true, createdAt: true,
        author: { select: { firstName: true, lastName: true, preferredName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
    db.hubConversationReply.findMany({
      where: { thread: { hubId: hub.id, deletedAt: null } },
      select: {
        id: true, authorId: true, createdAt: true,
        author: { select: { firstName: true, lastName: true, preferredName: true } },
        thread: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
  ]);

  const items: ActivityItem[] = [];

  for (const t of hubThreads) {
    items.push({
      type: "hub_thread", id: `hub-thread-${t.id}`,
      threadId: t.id, threadTitle: t.title,
      authorId: t.authorId, authorName: personName(t.author),
      ts: t.createdAt.toISOString(),
    });
  }

  for (const r of hubReplies) {
    items.push({
      type: "hub_reply", id: `hub-reply-${r.id}`,
      threadId: r.thread.id, threadTitle: r.thread.title,
      authorId: r.authorId, authorName: personName(r.author),
      ts: r.createdAt.toISOString(),
    });
  }

  items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const initialItems = items.slice(0, LIMIT);

  return (
    <HubActivityClient
      hubSlug={slug}
      currentUserId={session.user.id}
      initialItems={initialItems}
    />
  );
}
