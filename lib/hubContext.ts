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
import { activeHubThreadWhere } from "./hubQueries";
import { countHubActivitySince } from "./hubActivity";
import { getHubHomeApps } from "./hubApps";

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
  /** Meaningful Space events since Activity was last opened. */
  activityUnread: number;
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
  activitySeenAt: Date | null,
  conversationsEnabled: boolean,
): Promise<HubContext> {
  const [primary, conversationsUnread, activityUnread] = await Promise.all([
    getPrimaryToolContext(hubSlug),
    conversationsEnabled
      ? countUnreadConversations(hubId, userId, lastVisitedAt)
      : Promise.resolve(0),
    countHubActivitySince(hubId, activitySeenAt),
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
    activityUnread,
  };
}

/* ─────────────────────────  Primary-tool counts  ───────────────────────── */

async function getPrimaryToolContext(hubSlug: string): Promise<{
  primaryTool: ToolDefinition | null;
  primaryCount: number;
  primaryLabel: string;
}> {
  const links = await db.hubAppLink.findMany({
    where: { hub: { slug: hubSlug }, isEnabled: true },
    select: { toolSlug: true, label: true, href: true, isEnabled: true },
    orderBy: { order: "asc" },
  });
  const apps = await getHubHomeApps(hubSlug, links);
  const primary = apps.find((app) => app.toolSlug !== null);
  if (!primary?.toolSlug) {
    return { primaryTool: null, primaryCount: 0, primaryLabel: "" };
  }
  return {
    primaryTool: toolBySlug(primary.toolSlug),
    primaryCount: primary.count ?? 0,
    primaryLabel: primary.countLabel ?? "",
  };
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
      ...activeHubThreadWhere(hubId),
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
