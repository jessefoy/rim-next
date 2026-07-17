/** Shared conversation marker for the Space rail. */

import { db } from "./db";
import { activeHubThreadWhere } from "./hubQueries";

export interface HubContext {
  /** Non-archived conversation threads updated since the viewer's last visit. */
  conversationsUnread: number;
}

export async function getHubContext(
  _hubSlug: string,
  hubId: string,
  userId: string,
  lastVisitedAt: Date | null,
  conversationsEnabled: boolean,
): Promise<HubContext> {
  const conversationsUnread = conversationsEnabled
    ? await countUnreadConversations(hubId, userId, lastVisitedAt)
    : 0;

  return { conversationsUnread };
}

async function countUnreadConversations(
  hubId: string,
  _userId: string,
  lastVisitedAt: Date | null,
): Promise<number> {
  // Lightweight per-Space tracking rather than per-thread read state.
  if (!lastVisitedAt) return 0;
  return db.hubConversationThread.count({
    where: {
      ...activeHubThreadWhere(hubId),
      updatedAt: { gt: lastVisitedAt },
    },
  });
}
