/**
 * /account/host/conversations/[id] — Thread detail
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";
import HubTabNav from "@/components/HubTabNav";
import HubThreadDetailClient from "@/components/HubThreadDetailClient";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const thread = await db.hostThread.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: thread ? `${thread.title} — Host Hub` : "Thread — Host Hub" };
}

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const hasHubAccess = roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
  if (!hasHubAccess) redirect("/account/dashboard");

  const isManager = roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
  const { id } = await params;

  const thread = await db.hostThread.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
      replies: {
        include: {
          author: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!thread) notFound();

  // Mark NEW_REPLY alerts for this thread as read (fire-and-forget)
  void db.alert.updateMany({
    where: {
      userId: session.user.id,
      linkUrl: `/account/host/conversations/${id}`,
      read: false,
    },
    data: { read: true },
  }).catch(() => {});

  const serialized = {
    id: thread.id,
    title: thread.title,
    body: thread.body,
    category: thread.category as "OPERATIONAL" | "CONTEMPLATION",
    status: thread.status as "OPEN" | "CLOSED" | "ARCHIVED",
    authorId: thread.authorId,
    authorName:
      thread.author.preferredName ||
      [thread.author.firstName, thread.author.lastName].filter(Boolean).join(" ") ||
      "Unknown",
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    replies: thread.replies.map((r) => ({
      id: r.id,
      body: r.body,
      authorId: r.authorId,
      authorName:
        r.author.preferredName ||
        [r.author.firstName, r.author.lastName].filter(Boolean).join(" ") ||
        "Unknown",
      edited: r.edited,
      editedAt: r.editedAt?.toISOString() ?? null,
      reactions: (r.reactions as Record<string, number>) ?? {},
      createdAt: r.createdAt.toISOString(),
    })),
  };

  return (
    <AccountLayout>
      <div className="hub-page">
        <HubTabNav isManager={isManager} />
        <div className="hub-content">
          <Link href="/account/host/conversations" className="hub-back-link">
            ← Conversations
          </Link>
          <HubThreadDetailClient
            thread={serialized}
            currentUserId={session.user.id}
            isManager={isManager}
          />
        </div>
      </div>
    </AccountLayout>
  );
}
