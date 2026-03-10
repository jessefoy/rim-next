/**
 * /account/host/conversations — Host Hub: Conversations space
 *
 * Two rooms:
 *   - Peer Support (OPERATIONAL threads)
 *   - Contemplation (CONTEMPLATION threads)
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";
import HubTabNav from "@/components/HubTabNav";
import HubConversationsClient from "@/components/HubConversationsClient";

export const metadata = { title: "Conversations — Host Hub" };
export const dynamic = "force-dynamic";

export default async function HubConversationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const hasHubAccess = roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
  if (!hasHubAccess) redirect("/account/dashboard");

  const isManager = roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));

  // Fetch all non-archived threads ordered by most recently updated
  const threads = await db.hostThread.findMany({
    where: { status: { in: ["OPEN", "CLOSED"] } },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
      _count: { select: { replies: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const serializedThreads = threads.map((t) => ({
    id: t.id,
    title: t.title,
    body: t.body,
    category: t.category as "OPERATIONAL" | "CONTEMPLATION" | "GENERAL",
    status: t.status as "OPEN" | "CLOSED" | "ARCHIVED",
    authorId: t.authorId,
    authorName:
      t.author.preferredName ||
      [t.author.firstName, t.author.lastName].filter(Boolean).join(" ") ||
      "Unknown",
    replyCount: t._count.replies,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <AccountLayout>
      <div className="hub-page">
        <HubTabNav />
        <div className="hub-content">
          <HubConversationsClient
            initialThreads={serializedThreads}
            currentUserId={session.user.id}
            isManager={isManager}
          />
        </div>
      </div>
    </AccountLayout>
  );
}
