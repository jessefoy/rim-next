/**
 * /account/host/threads/[id] — Host Hub: Thread Detail
 *
 * Shows thread body + replies. Any hub member can reply (to OPEN threads).
 * HOST_MANAGER / ADMIN can close or archive.
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";
import HubTabNav from "@/components/HubTabNav";
import ThreadDetail from "@/components/ThreadDetail";
import Link from "next/link";

export const dynamic = "force-dynamic";

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

  const serialized = {
    id: thread.id,
    title: thread.title,
    body: thread.body,
    category: thread.category as "OPERATIONAL" | "CONTEMPLATION",
    status: thread.status as "OPEN" | "CLOSED" | "ARCHIVED",
    author: thread.author,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    replies: thread.replies.map((r) => ({
      id: r.id,
      body: r.body,
      author: r.author,
      createdAt: r.createdAt.toISOString(),
    })),
  };

  return (
    <AccountLayout>
      <div className="hub-page">
        <HubTabNav isManager={isManager} />
        <div className="hub-content">
          <Link href="/account/host/threads" className="hub-back-link">
            ← All Threads
          </Link>
          <ThreadDetail
            thread={serialized}
            currentUserId={session.user.id}
            isManager={isManager}
          />
        </div>
      </div>
    </AccountLayout>
  );
}
