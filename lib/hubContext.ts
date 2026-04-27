/**
 * hubContext — live counts that power the workspace sidebar badge, the Home
 * state sentence, and the primary-work card.
 *
 * One function per hub. Each returns a small shape the Home page and sidebar
 * can render without further branching. Counts are deliberately conservative
 * (cheap queries, short lookups); this runs on every workspace render.
 */

import { db } from "./db";
import { TOOL_REGISTRY, type ToolDefinition } from "./toolRegistry";

export interface HubContext {
  /** The tool surfaced as the primary work card + "Work" sidebar item. Null for non-tool hubs. */
  primaryTool: ToolDefinition | null;
  /** Count shown as the sidebar badge on the primary tool and driving the state sentence. */
  primaryCount: number;
  /** Plain-English label for the primary count, e.g. "new registrations". */
  primaryLabel: string;
  /** One-line state sentence shown at the top of Home. */
  stateSentence: string;
  /** Non-archived conversation threads updated since the viewer's last visit. */
  conversationsUnread: number;
}

const NEUTRAL_SENTENCE = "Nothing needs your attention right now.";

function plural(n: number, singular: string, plural: string) {
  return n === 1 ? singular : plural;
}

export async function getHubContext(
  hubSlug: string,
  hubId: string,
  userId: string,
  lastVisitedAt: Date | null,
): Promise<HubContext> {
  const [primary, conversationsUnread] = await Promise.all([
    getPrimaryToolContext(hubSlug, userId),
    countUnreadConversations(hubId, userId, lastVisitedAt),
  ]);

  const stateSentence = buildStateSentence({
    primaryCount: primary.primaryCount,
    primaryLabel: primary.primaryLabel,
    conversationsUnread,
  });

  return {
    primaryTool: primary.primaryTool,
    primaryCount: primary.primaryCount,
    primaryLabel: primary.primaryLabel,
    stateSentence,
    conversationsUnread,
  };
}

/* ─────────────────────────  Primary-tool counts  ───────────────────────── */

async function getPrimaryToolContext(hubSlug: string, userId: string): Promise<{
  primaryTool: ToolDefinition | null;
  primaryCount: number;
  primaryLabel: string;
}> {
  switch (hubSlug) {
    case "registrar": {
      // "New registrations in the last 7 days" — a practical signal of work to review
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const count = await db.registration.count({
        where: { createdAt: { gte: since }, status: { not: "CANCELLED" } },
      });
      return {
        primaryTool: toolBySlug("programs"),
        primaryCount: count,
        primaryLabel: plural(count, "new registration", "new registrations"),
      };
    }

    case "host-team": {
      // Unclaimed host assignments in the next 14 days
      const now = new Date();
      const in14 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const count = await db.hostAssignment.count({
        where: {
          userId: null,
          sessionDate: { gte: now, lte: in14 },
        },
      });
      return {
        primaryTool: toolBySlug("schedule"),
        primaryCount: count,
        primaryLabel: plural(count, "session needs a host", "sessions need hosts"),
      };
    }

    case "support": {
      // Open sub-requests are the nearest neutral signal available without Gmail sync;
      // once real inbox-thread counts exist, swap here.
      const count = await db.subRequest.count({ where: { status: "OPEN" } });
      return {
        primaryTool: toolBySlug("inbox"),
        primaryCount: count,
        primaryLabel: plural(count, "open request", "open requests"),
      };
    }

    case "courses": {
      // Inactive courses = drafts waiting to be published
      const count = await db.course.count({ where: { isActive: false } });
      return {
        primaryTool: toolBySlug("learning"),
        primaryCount: count,
        primaryLabel: plural(count, "draft course", "draft courses"),
      };
    }

    default:
      return { primaryTool: null, primaryCount: 0, primaryLabel: "" };
  }
}

/* ─────────────────────────  Section counts  ───────────────────────── */

async function countUnreadConversations(
  hubId: string,
  _userId: string,
  lastVisitedAt: Date | null,
): Promise<number> {
  // Threads updated since the viewer's last visit. Lightweight, not per-thread read state —
  // refine later if needed. If lastVisitedAt is null (first visit), count is 0 (welcome path handles it).
  if (!lastVisitedAt) return 0;
  return db.hubConversationThread.count({
    where: {
      hubId,
      status: { not: "ARCHIVED" },
      updatedAt: { gt: lastVisitedAt },
    },
  });
}

/* ─────────────────────────  State sentence composition  ───────────────────────── */

function buildStateSentence(parts: {
  primaryCount: number;
  primaryLabel: string;
  conversationsUnread: number;
}): string {
  const { primaryCount, primaryLabel, conversationsUnread } = parts;
  const fragments: string[] = [];

  if (primaryCount > 0 && primaryLabel) {
    fragments.push(`${primaryCount} ${primaryLabel}`);
  }
  if (conversationsUnread > 0) {
    fragments.push(
      `${conversationsUnread} ${plural(conversationsUnread, "new conversation", "new conversations")}`,
    );
  }

  if (fragments.length === 0) return NEUTRAL_SENTENCE;
  if (fragments.length === 1) return capitalize(fragments[0]) + ".";
  return `${capitalize(fragments[0])} and ${fragments[1]}.`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toolBySlug(slug: string): ToolDefinition | null {
  return TOOL_REGISTRY.find((t) => t.slug === slug) ?? null;
}
