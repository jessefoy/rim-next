import { Prisma } from "@prisma/client";

/**
 * Canonical filter for "active hub-level conversation threads."
 *
 * Active means:
 *   - Belongs to the hub conversations feed, not a document  (documentId: null)
 *   - Not in the trash                                       (deletedAt: null)
 *   - Not archived                                           (status: "OPEN")
 *
 * Spread this into any findMany / count call that surfaces hub-level threads
 * to members — unread badges, the conversations page list, hub home pinned +
 * recent. Callers add the additional clauses they need (isPinned, updatedAt,
 * an OR for unread-since-last-visit).
 *
 * Centralising the shape here eliminates the three drift bugs found during
 * the session-114-after audit:
 *   1. `status: { not: "ARCHIVED" }` never matched anything — schema has only
 *      OPEN | CLOSED, so the filter was a no-op and CLOSED threads leaked in.
 *   2. Missing `documentId: null` let document threads bleed into the hub feed.
 *   3. Missing `deletedAt: null` let trashed threads appear on hub Home.
 *
 * The Activity stream is intentionally NOT a caller — it shows replies to
 * closed/archived threads as history, so it filters only `deletedAt: null`
 * inline. Keep that separation.
 */
export function activeHubThreadWhere(hubId: string): Prisma.HubConversationThreadWhereInput {
  return {
    hubId,
    documentId: null,
    deletedAt: null,
    status: "OPEN",
  };
}
