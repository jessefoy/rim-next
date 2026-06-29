import { db } from "@/lib/db";
import { canAccessMindMap } from "@/lib/mindMapAuth";

/**
 * Shared plumbing for mind-map TOPIC conversations (Slice 3). One thread per
 * node (anchored via HubConversationThread.mindMapNodeId). Reuses the
 * conversation tables but is MAP-scoped, not hub-scoped: access follows
 * canAccessMindMap, and notifications fan out over the union of every hub the
 * map lives in (origin + placements) — not a single hub.
 */

export const ALLOWED_EMOJIS = ["👍", "❤️", "🙏", "💡", "😊"];

/** Normalize the reactions JSON to the per-user-array shape (mirrors the hub react route). */
export function readReactions(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, number | string[]>;
  const out: Record<string, string[]> = {};
  for (const [emoji, val] of Object.entries(raw)) {
    if (Array.isArray(val)) out[emoji] = val.filter((v): v is string => typeof v === "string");
    else if (typeof val === "number" && val > 0) out[emoji] = [];
  }
  return out;
}

export interface ConversationContext {
  map: { id: string; title: string; addedById: string; hubId: string | null; deletedAt: Date | null };
  /** Every hub the map lives in: origin + placements. The conversation's audience. */
  mapHubIds: string[];
  /** A nominal hub home for the thread row (origin, else first placement, else null). */
  hubHome: string | null;
  viewer: { userId: string; roles: string[]; memberships: { hubId: string; isCoordinator: boolean }[] };
  canAccess: boolean;
}

/** Load the map + the viewer's ACTIVE memberships and resolve map-view access. */
export async function loadConversationContext(mapId: string, userId: string, roles: string[]): Promise<ConversationContext | null> {
  const [map, memberships] = await Promise.all([
    db.mindMap.findUnique({
      where: { id: mapId },
      select: {
        id: true,
        title: true,
        addedById: true,
        hubId: true,
        visibility: true,
        editPolicy: true,
        deletedAt: true,
        placements: { select: { hubId: true } },
      },
    }),
    db.hubMember.findMany({ where: { userId, status: "ACTIVE" }, select: { hubId: true, isCoordinator: true } }),
  ]);
  if (!map || map.deletedAt) return null;

  const viewer = { userId, roles, memberships };
  const canAccess = canAccessMindMap(
    { addedById: map.addedById, hubId: map.hubId, visibility: map.visibility, editPolicy: map.editPolicy, placements: map.placements },
    viewer,
  );
  const mapHubIds = [...new Set([map.hubId, ...map.placements.map((p) => p.hubId)].filter((x): x is string => Boolean(x)))];

  return {
    map: { id: map.id, title: map.title, addedById: map.addedById, hubId: map.hubId, deletedAt: map.deletedAt },
    mapHubIds,
    hubHome: map.hubId ?? mapHubIds[0] ?? null,
    viewer,
    canAccess,
  };
}

/** ACTIVE coordinator user-ids across every hub the map lives in (auto-followers). */
export async function coordinatorRecipientIds(mapHubIds: string[]): Promise<string[]> {
  if (mapHubIds.length === 0) return [];
  const rows = await db.hubMember.findMany({
    where: { hubId: { in: mapHubIds }, isCoordinator: true, status: "ACTIVE" },
    select: { userId: true },
  });
  return [...new Set(rows.map((r) => r.userId))];
}

/**
 * Followers of the thread to email on a new comment (except the commenter).
 * The map's audience spans hubs AND, for COMMUNITY-visibility maps, members who
 * belong to none of its hubs. So a follower is notified when they are either:
 *   - an ACTIVE, comms-enabled member of one of the map's hubs, OR
 *   - not a member of any of the map's hubs at all (a COMMUNITY follower, or the
 *     map author / a guiding teacher who opted in by following).
 * A hub member who has turned hub comms OFF is excluded — they opted out.
 */
export async function commentRecipients(
  threadId: string,
  mapHubIds: string[],
  exceptUserId: string,
): Promise<{ email: string; firstName: string | null }[]> {
  const subs = await db.hubThreadSubscription.findMany({
    where: { threadId, userId: { not: exceptUserId } },
    select: { userId: true },
  });
  if (subs.length === 0) return [];
  const subIds = subs.map((s) => s.userId);

  const memberRows = mapHubIds.length
    ? await db.hubMember.findMany({
        where: { hubId: { in: mapHubIds }, userId: { in: subIds }, status: "ACTIVE" },
        select: { userId: true, communicationsEnabled: true },
      })
    : [];
  const commsOn = new Set(memberRows.filter((m) => m.communicationsEnabled).map((m) => m.userId));
  const anyMember = new Set(memberRows.map((m) => m.userId));

  const recipientIds = subIds.filter((id) => commsOn.has(id) || !anyMember.has(id));
  if (recipientIds.length === 0) return [];

  const users = await db.user.findMany({
    where: { id: { in: recipientIds } },
    select: { email: true, firstName: true },
  });
  return users.filter((u): u is { email: string; firstName: string | null } => !!u.email);
}
