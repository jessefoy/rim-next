/**
 * /account/host/threads — Host Hub: Thread List
 *
 * Shows OPEN + CLOSED threads (archived hidden).
 * Any hub member can create a thread or reply.
 * HOST_MANAGER / ADMIN can close / archive.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";
import HubTabNav from "@/components/HubTabNav";
import ThreadList from "@/components/ThreadList";

export const metadata = { title: "Threads — Host Hub" };
export const dynamic = "force-dynamic";

export default async function ThreadsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const hasHubAccess = roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
  if (!hasHubAccess) redirect("/account/dashboard");

  const isManager = roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));

  const threads = await db.hostThread.findMany({
    where: { status: { in: ["OPEN", "CLOSED"] } },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
      _count: { select: { replies: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const serialized = threads.map((t) => ({
    id: t.id,
    title: t.title,
    category: t.category as "OPERATIONAL" | "CONTEMPLATION",
    status: t.status as "OPEN" | "CLOSED" | "ARCHIVED",
    author: t.author,
    replyCount: t._count.replies,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <AccountLayout>
      <div className="hub-page">
        <HubTabNav isManager={isManager} />
        <div className="hub-content">
          <ThreadList initialThreads={serialized} />
        </div>
      </div>
    </AccountLayout>
  );
}
