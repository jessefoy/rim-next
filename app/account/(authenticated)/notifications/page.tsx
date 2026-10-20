import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";
import NotificationsClient from "@/components/NotificationsClient";
import { countUnreadNotices, listNotices, listNoticeSources } from "@/lib/notifications";
import { listHubNeeds, readPointOf, type HubActivityItem } from "@/lib/hubActivity";
import { hubLeadAllowed } from "@/lib/googleFiles";

export const metadata = { title: "Notifications - Rooted In Mindfulness" };
export const dynamic = "force-dynamic";

/**
 * A person's Notifications (2026-10-20): every notice about them, their
 * teams, their programs and their account (lib/notifications.ts), with what
 * their teams need them for now gathered from each team they're on.
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; from?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const query = await searchParams;
  const show = query.show === "unread" ? "unread" : "all";
  const source = typeof query.from === "string" && query.from ? query.from : "all";

  // Needs you, from every active team they're on that runs the Scheduler.
  const memberships = await db.hubMember.findMany({
    where: {
      userId,
      status: "ACTIVE",
      hub: { status: "ACTIVE", appLinks: { some: { toolSlug: "schedule", isEnabled: true } } },
    },
    select: {
      status: true, isCoordinator: true, activitySeenAt: true, joinedAt: true,
      hub: { select: { id: true, slug: true, name: true } },
    },
    orderBy: { hub: { name: "asc" } },
  });
  const needsByTeam = await Promise.all(
    memberships.map(async (m) => {
      const items = await listHubNeeds({
        hubId: m.hub.id,
        hubSlug: m.hub.slug,
        viewer: { userId, roles, isLead: hubLeadAllowed(roles, m), readPoint: readPointOf(m) },
      });
      // Across teams, the team is the source people need to see.
      return items.map((i): HubActivityItem => ({ ...i, sourceLabel: m.hub.name }));
    }),
  );
  const needs = needsByTeam
    .flat()
    .sort((a, b) => new Date(a.action?.sessionDate ?? a.ts).getTime() - new Date(b.action?.sessionDate ?? b.ts).getTime());

  const loadedAt = new Date().toISOString();
  const [page, sources, unreadCount] = await Promise.all([
    listNotices({ userId, source, unreadOnly: show === "unread", limit: 40 }),
    listNoticeSources(userId),
    countUnreadNotices(userId),
  ]);

  return (
    <AccountLayout>
      <NotificationsClient
        initialRows={page.rows}
        initialNextCursor={page.nextCursor}
        initialShow={show}
        initialSource={source}
        sources={sources}
        unreadCount={unreadCount}
        needs={needs}
        loadedAt={loadedAt}
      />
    </AccountLayout>
  );
}
