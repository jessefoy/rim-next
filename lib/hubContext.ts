/** Shared unread markers for the Space rail. */

import { db } from "./db";
import { activeHubThreadWhere } from "./hubQueries";
import { countHubActivitySince } from "./hubActivity";

export interface HubContext {
  /** Non-archived conversation threads updated since the viewer's last visit. */
  conversationsUnread: number;
  /** Meaningful Space events since Updates was last opened. */
  activityUnread: number;
}

export async function getHubContext(
  _hubSlug: string,
  hubId: string,
  userId: string,
  lastVisitedAt: Date | null,
  activitySeenAt: Date | null,
  conversationsEnabled: boolean,
): Promise<HubContext> {
  const [conversationsUnread, activityUnread] = await Promise.all([
    conversationsEnabled
      ? countUnreadConversations(hubId, userId, lastVisitedAt)
      : Promise.resolve(0),
    countHubActivitySince(hubId, activitySeenAt),
  ]);

  return { conversationsUnread, activityUnread };
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
