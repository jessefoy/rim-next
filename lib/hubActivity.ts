import { db } from "@/lib/db";
import {
  getInstalledAppAttention,
  listInstalledAppNeeds,
  listInstalledAppUpdates,
  completeDownTo,
  type HubAppUpdateItem,
  type HubTakeSessionAction,
} from "@/lib/hubApps";
import { ctDateStr } from "@/lib/scheduleUtils";
import { cache } from "react";
import { getToolBySlug, type ToolSlug } from "@/lib/toolRegistry";

/**
 * A team's Updates, read like an inbox (2026-10-19, Jesse: "People should be
 * able to read it like an inbox and by type. It should also go to the item
 * specifically.").
 *
 * - **Needs you** comes first: what the viewer could act on now, offered by
 *   installed apps (the Scheduler's open sessions and cover requests). It
 *   settles itself: an item leaves once someone takes it.
 * - **History** is everything that happened, newest first, each item one
 *   sentence linking to the exact thing (the session, the reply, the comment).
 * - **Read state** is a mark, never a removal: opening an item marks it read
 *   (hub_update_reads); everything before HubMember.activitySeenAt counts as
 *   read ("Mark all as read"). All keeps everything. This reverses the July
 *   rule of no read bookkeeping, which existed because the old read point
 *   emptied Recent; nothing here hides an item.
 * - **Types** are the folders: For you, Everything, then each source.
 *
 * The Space owns read state and rendering; each app owns what its items mean
 * (lib/hubApps.ts). Who sees leaving: lib/hubEvents.ts.
 */

export type HubActivitySourceKey = "conversations" | "files" | "members" | `app:${ToolSlug}`;
/** A folder: everything, what's for you, or one type. */
export type HubActivityFolder = "all" | "for-you" | HubActivitySourceKey;
export type HubActivityShow = "all" | "unread";

export type HubActivitySourceOption = {
  key: HubActivitySourceKey;
  label: string;
};

/** One source-aware shape for every item in a team's Updates. */
export type HubActivityItem = {
  id: string;
  sourceKey: HubActivitySourceKey;
  sourceLabel: string;
  kind: string;
  /** Who did it: your own doings are never unread. */
  actorId?: string | null;
  authorId: string | null;
  authorName: string;
  verb: string;
  subject: string | null;
  href: string;
  ts: string;
  isForUser: boolean;
  state?: { label: string; tone: "open" | "done" | "quiet" } | null;
  note?: string | null;
  leadsOnly?: boolean;
  action?: HubTakeSessionAction | null;
  /** The read keys this item stands for (a day's replies in one conversation
   *  are one item). */
  readKeys: string[];
  unread: boolean;
};

export type HubAttentionItem = {
  id: string;
  sourceKey: HubActivitySourceKey;
  sourceLabel: string;
  label: string;
  href: string;
  count: number;
};

const FILE_ACTIONS = [
  "create-folder",
  "upload",
  "share",
  "comment",
  "request-removal",
  "approve-removal",
  "cancel-removal",
] as const;

function personName(u: {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
} | null | undefined) {
  if (!u) return "Someone";
  const first = u.preferredName || u.firstName;
  return [first, u.lastName].filter(Boolean).join(" ") || "Someone";
}

function detailObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function detailName(detail: unknown): string {
  const d = detailObject(detail);
  const candidate = d.name ?? d.to ?? d.from;
  return typeof candidate === "string" && candidate.trim() ? candidate : "a file";
}

function fileVerb(action: string): string {
  switch (action) {
    case "create-folder": return "created the folder";
    case "upload": return "uploaded";
    case "share": return "shared";
    case "comment": return "commented on";
    case "request-removal": return "asked to remove";
    case "approve-removal": return "removed";
    case "cancel-removal": return "kept";
    default: return "updated";
  }
}

function validCursor(cursor?: string | null): Date | null {
  if (!cursor) return null;
  const parsed = new Date(cursor);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// The cursor is inclusive (lte): a page stops short of its boundary moment,
// so rows sharing that moment all come on the next page.
function timeWindow(cursorDate: Date | null, since: Date | null) {
  const gt = since ?? undefined;
  const lte = cursorDate ?? undefined;
  return gt || lte ? { ...(gt ? { gt } : {}), ...(lte ? { lte } : {}) } : undefined;
}

async function installedUpdateApps(hubId: string): Promise<ToolSlug[]> {
  const links = await db.hubAppLink.findMany({
    where: { hubId, isEnabled: true, toolSlug: { not: null } },
    select: { toolSlug: true },
  });
  const toolSlugs = links.flatMap((link) => {
    const tool = link.toolSlug ? getToolBySlug(link.toolSlug) : null;
    return tool?.spaceContributions.updates ? [tool.slug] : [];
  });
  return [...new Set(toolSlugs)];
}

/** The types this team's Updates can show: its core sections and installed apps. */
export async function listHubActivitySources(options: {
  hubId: string;
  conversationsEnabled: boolean;
  filesEnabled: boolean;
}): Promise<HubActivitySourceOption[]> {
  const toolSlugs = await installedUpdateApps(options.hubId);
  return [
    ...toolSlugs.flatMap((slug) => {
      const tool = getToolBySlug(slug);
      // "Schedule", not the tool's name: the folder is a kind of news.
      return tool ? [{ key: `app:${slug}` as const, label: slug === "schedule" ? "Schedule" : tool.label }] : [];
    }),
    ...(options.conversationsEnabled ? [{ key: "conversations" as const, label: "Conversations" }] : []),
    ...(options.filesEnabled ? [{ key: "files" as const, label: "Files" }] : []),
    { key: "members", label: "Members" },
  ];
}

/** An unknown folder is Everything. */
export function parseHubActivityFolder(value: string | null): HubActivityFolder {
  if (value === "for-you" || value === "for-me") return "for-you";
  if (value === "conversations" || value === "files" || value === "members") return value;
  if (value?.startsWith("app:")) {
    const tool = getToolBySlug(value.slice(4));
    if (tool?.spaceContributions.updates) return `app:${tool.slug}`;
  }
  return "all";
}

export function parseHubActivityShow(value: string | null): HubActivityShow {
  return value === "unread" ? "unread" : "all";
}

/** Who is looking: what they may see and where their read point is. */
export interface HubActivityViewer {
  userId: string;
  roles: string[];
  /** One of the team's leads (hubLeadAllowed): sees leads-only items. */
  isLead: boolean;
  /** Everything before this counts as read; null = no read state (a
   *  guiding teacher looking in on a team they aren't on). */
  readPoint: Date | null;
}

/** A member's read point: their "Mark all as read", or when they joined. */
export function readPointOf(member: { activitySeenAt: Date | null; joinedAt: Date } | null | undefined): Date | null {
  if (!member) return null;
  return member.activitySeenAt ?? member.joinedAt;
}

/** Apply read state to raw items, given the keys this person has opened. */
function markRead<T extends { id: string; ts: string; readKeys?: string[]; actorId?: string | null }>(
  items: T[],
  viewer: HubActivityViewer,
  opened: Set<string>,
  tsOfKey?: Map<string, string>,
  actorOfKey?: Map<string, string | null>,
): Array<T & { readKeys: string[]; unread: boolean }> {
  return items.map((item) => {
    const readKeys = item.readKeys ?? [item.id];
    const unread = viewer.readPoint === null
      ? false
      : readKeys.some((key) => {
          const ts = tsOfKey?.get(key) ?? item.ts;
          const actor = actorOfKey?.has(key) ? actorOfKey.get(key) : item.actorId;
          return new Date(ts) > viewer.readPoint! && !opened.has(key) && actor !== viewer.userId;
        });
    return { ...item, readKeys, unread };
  });
}

async function openedKeys(hubId: string, userId: string, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await db.hubUpdateRead.findMany({
    where: { userId, hubId, itemKey: { in: keys } },
    select: { itemKey: true },
  });
  return new Set(rows.map((r) => r.itemKey));
}

/** One page of history, built from every source, before read state. */
async function historyPage(options: {
  hubId: string;
  hubSlug: string;
  viewer: HubActivityViewer;
  conversationsEnabled: boolean;
  filesEnabled: boolean;
  folder: HubActivityFolder;
  cursorDate: Date | null;
  since: Date | null;
  limit: number;
  widened?: boolean;
}): Promise<{
  items: Array<Omit<HubActivityItem, "readKeys" | "unread"> & { readKeys?: string[] }>;
  tsOfKey: Map<string, string>;
  actorOfKey: Map<string, string | null>;
  nextCursor: string | null;
}> {
  const { hubId, hubSlug, viewer, folder, limit } = options;
  const forYou = folder === "for-you";
  const includes = (key: HubActivitySourceKey) => folder === "all" || forYou || folder === key;
  const createdAt = timeWindow(options.cursorDate, options.since);
  const installed = await installedUpdateApps(hubId);
  const toolSlugs = folder === "all" || forYou
    ? installed
    : installed.filter((slug) => folder === `app:${slug}`);

  const [threadsRaw, repliesRaw, fileAuditsRaw, joinsRaw, leavesRaw, appPage] = await Promise.all([
    !includes("conversations") || !options.conversationsEnabled || forYou
      ? Promise.resolve([])
      : db.hubConversationThread.findMany({
          where: { hubId, deletedAt: null, ...(createdAt ? { createdAt } : {}) },
          select: {
            id: true, title: true, authorId: true, createdAt: true,
            author: { select: { firstName: true, lastName: true, preferredName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
    !includes("conversations") || !options.conversationsEnabled
      ? Promise.resolve([])
      : db.hubConversationReply.findMany({
          where: {
            thread: {
              hubId,
              deletedAt: null,
              ...(forYou ? { subscriptions: { some: { userId: viewer.userId } } } : {}),
            },
            ...(forYou ? { authorId: { not: viewer.userId } } : {}),
            ...(createdAt ? { createdAt } : {}),
          },
          select: {
            id: true, authorId: true, createdAt: true,
            author: { select: { firstName: true, lastName: true, preferredName: true } },
            thread: {
              select: {
                id: true, title: true,
                subscriptions: { where: { userId: viewer.userId }, select: { id: true }, take: 1 },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
    !includes("files") || !options.filesEnabled
      ? Promise.resolve([])
      : db.googleFileAudit.findMany({
          where: {
            hubId,
            action: { in: forYou ? ["comment"] : [...FILE_ACTIONS] },
            ...(forYou ? { userId: { not: viewer.userId } } : {}),
            ...(createdAt ? { createdAt } : {}),
          },
          select: { id: true, userId: true, action: true, googleFileId: true, detail: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
    !includes("members") || forYou
      ? Promise.resolve([])
      : db.hubMember.findMany({
          where: { hubId, ...(createdAt ? { joinedAt: createdAt } : {}) },
          select: {
            id: true, userId: true, joinedAt: true,
            user: { select: { firstName: true, lastName: true, preferredName: true } },
          },
          orderBy: { joinedAt: "desc" },
          take: limit,
        }),
    // Someone left the team: the leads see it (Jesse, 2026-10-19).
    !includes("members") || forYou || !viewer.isLead
      ? Promise.resolve([])
      : db.hubEvent.findMany({
          where: { hubSlug, kind: "member-left", ...(createdAt ? { createdAt } : {}) },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
    listInstalledAppUpdates(toolSlugs, {
      hubId,
      hubSlug,
      userId: viewer.userId,
      cursorDate: options.cursorDate,
      since: options.since,
      forYou,
      isLead: viewer.isLead,
      limit,
    }),
  ]);

  // Each source fetched at most `limit` rows, newest first. Below the newest
  // of the oldest rows among the sources that filled up, a source may hold
  // rows not yet fetched, so this page shows only what is newer than that
  // moment and the next page starts there (inclusive). Counting raw rows,
  // before replies group and hidden files drop out, keeps it complete.
  let boundary = completeDownTo(
    [threadsRaw, repliesRaw, fileAuditsRaw, joinsRaw.map((j) => ({ createdAt: j.joinedAt })), leavesRaw],
    limit,
  );
  if (appPage.boundary && (!boundary || appPage.boundary > boundary)) boundary = appPage.boundary;
  // More than a page of rows at one moment (a batch written together): read
  // again with a much larger page so the whole moment is in hand, then step
  // past it.
  const stuck = !!boundary && !!options.cursorDate && boundary.getTime() === options.cursorDate.getTime();
  if (stuck && !options.widened) {
    return historyPage({ ...options, limit: Math.min(limit * 20, 2000), widened: true });
  }
  const keep = (d: Date) => !boundary || (stuck ? d >= boundary : d > boundary);
  const nextCursor = boundary ? (stuck ? new Date(boundary.getTime() - 1) : boundary).toISOString() : null;
  const threads = threadsRaw.filter((t) => keep(t.createdAt));
  const replies = repliesRaw.filter((r) => keep(r.createdAt));
  const fileAudits = fileAuditsRaw.filter((a) => keep(a.createdAt));
  const joins = joinsRaw.filter((j) => keep(j.joinedAt));
  const leaves = leavesRaw.filter((e) => keep(e.createdAt));
  const appItems = appPage.items.filter((i) => keep(new Date(i.ts)));

  // Files: drafts never show; Leads-only files only to leads.
  const auditedFileIds = [...new Set(fileAudits.flatMap((a) => (a.googleFileId ? [a.googleFileId] : [])))];
  const fileMetas = auditedFileIds.length
    ? await db.googleFileMeta.findMany({
        where: { googleFileId: { in: auditedFileIds } },
        select: { googleFileId: true, heldAt: true, creatorUserId: true, leadsOnly: true },
      })
    : [];
  const fileMetaById = new Map(fileMetas.map((meta) => [meta.googleFileId, meta]));
  const visibleFileAudits = fileAudits.filter((audit) => {
    if (!audit.googleFileId) return !forYou;
    const meta = fileMetaById.get(audit.googleFileId);
    if (meta?.heldAt) return false;
    const stamped = detailObject(audit.detail).leadsOnly === true;
    if ((meta?.leadsOnly || stamped) && !viewer.isLead) return false;
    return !forYou || meta?.creatorUserId === viewer.userId;
  });

  const userIds = new Set<string>([
    ...visibleFileAudits.flatMap((a) => (a.userId ? [a.userId] : [])),
    ...leaves.flatMap((e) => [e.subjectUserId, e.actorId].filter((x): x is string => !!x)),
  ]);
  const users = userIds.size
    ? await db.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, firstName: true, lastName: true, preferredName: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  type Raw = Omit<HubActivityItem, "readKeys" | "unread"> & { readKeys?: string[] };
  const items: Raw[] = [];
  const tsOfKey = new Map<string, string>();
  const actorOfKey = new Map<string, string | null>();

  for (const thread of threads) {
    items.push({
      id: `conversation-${thread.id}`,
      sourceKey: "conversations",
      sourceLabel: "Conversation",
      kind: "conversation-started",
      actorId: thread.authorId,
      authorId: thread.authorId,
      authorName: personName(thread.author),
      verb: "started",
      subject: thread.title,
      href: `/account/hub/${hubSlug}/conversations/${thread.id}`,
      ts: thread.createdAt.toISOString(),
      isForUser: false,
    });
  }

  // A day's replies in one conversation are one item (newest first).
  const replyGroups = new Map<string, typeof replies>();
  for (const reply of replies) {
    const key = `${reply.thread.id}~${ctDateStr(reply.createdAt.toISOString())}`;
    const group = replyGroups.get(key) ?? [];
    group.push(reply);
    replyGroups.set(key, group);
  }
  for (const [key, group] of replyGroups) {
    const newest = group[0];
    const oldest = group[group.length - 1];
    const names = [...new Set(group.map((r) => personName(r.author)))];
    const who = names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names[0]} and ${names.length - 1} others`;
    for (const r of group) {
      tsOfKey.set(`reply-${r.id}`, r.createdAt.toISOString());
      actorOfKey.set(`reply-${r.id}`, r.authorId);
    }
    items.push({
      id: `replies-${key}`,
      sourceKey: "conversations",
      sourceLabel: "Conversation",
      kind: "conversation-reply",
      authorId: newest.authorId,
      authorName: who,
      verb: group.length === 1 ? "replied in" : `added ${group.length} replies in`,
      subject: newest.thread.title,
      // The first of the day's replies: read on from there.
      href: `/account/hub/${hubSlug}/conversations/${newest.thread.id}#reply-${oldest.id}`,
      ts: newest.createdAt.toISOString(),
      isForUser: group.some((r) => r.authorId !== viewer.userId) && newest.thread.subscriptions.length > 0,
      readKeys: group.map((r) => `reply-${r.id}`),
    });
  }

  for (const audit of visibleFileAudits) {
    const commentId = detailObject(audit.detail).commentId;
    items.push({
      id: `file-${audit.id}`,
      sourceKey: "files",
      sourceLabel: audit.action === "comment" ? "File comment" : "File",
      kind: audit.action === "comment" ? "file-comment" : `file-${audit.action}`,
      actorId: audit.userId,
      authorId: audit.userId,
      authorName: personName(audit.userId ? userById.get(audit.userId) : null),
      verb: fileVerb(audit.action),
      subject: detailName(audit.detail),
      href: audit.googleFileId
        ? `/account/files/${audit.googleFileId}${typeof commentId === "string" ? `#comment-${commentId}` : ""}`
        : `/account/hub/${hubSlug}/files`,
      ts: audit.createdAt.toISOString(),
      // For you: a comment on your file (the same rule as the For you folder).
      isForUser: Boolean(
        audit.action === "comment" &&
        audit.googleFileId &&
        audit.userId !== viewer.userId &&
        fileMetaById.get(audit.googleFileId)?.creatorUserId === viewer.userId,
      ),
    });
  }

  for (const member of joins) {
    items.push({
      id: `member-${member.id}`,
      sourceKey: "members",
      sourceLabel: "Members",
      kind: "member-joined",
      actorId: member.userId,
      authorId: member.userId,
      authorName: personName(member.user),
      verb: "joined the team",
      subject: null,
      href: `/account/hub/${hubSlug}/members#member-${member.userId}`,
      ts: member.joinedAt.toISOString(),
      isForUser: false,
    });
  }

  for (const e of leaves) {
    const by = e.actorId && e.actorId !== e.subjectUserId ? personName(userById.get(e.actorId)) : null;
    items.push({
      id: `event-${e.id}`,
      sourceKey: "members",
      sourceLabel: "Members",
      kind: "member-left",
      actorId: e.actorId,
      authorId: e.subjectUserId,
      authorName: personName(e.subjectUserId ? userById.get(e.subjectUserId) : null),
      verb: "is no longer on the team",
      subject: null,
      href: `/account/hub/${hubSlug}/members`,
      ts: e.createdAt.toISOString(),
      isForUser: false,
      note: by ? `Removed by ${by}` : null,
      leadsOnly: true,
    });
  }

  for (const item of appItems as HubAppUpdateItem[]) items.push(item);

  items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  return { items, tsOfKey, actorOfKey, nextCursor };
}

/** Join items that are one thing (a day's replies across two passes). */
function mergeById(items: HubActivityItem[]): HubActivityItem[] {
  const byId = new Map<string, HubActivityItem>();
  for (const item of items) {
    const had = byId.get(item.id);
    byId.set(item.id, had
      ? { ...had, unread: had.unread || item.unread, readKeys: [...new Set([...had.readKeys, ...item.readKeys])] }
      : item);
  }
  return [...byId.values()];
}

/**
 * A page of a team's Updates history for one folder, newest first, with read
 * state. `show: "unread"` leaves out what the viewer has read. `passes`: how
 * many pages to read on when a folder or Unread leaves a page nearly empty.
 */
export async function listHubActivity(options: {
  hubId: string;
  hubSlug: string;
  viewer: HubActivityViewer;
  conversationsEnabled?: boolean;
  filesEnabled?: boolean;
  folder?: HubActivityFolder;
  show?: HubActivityShow;
  cursor?: string | null;
  limit?: number;
  passes?: number;
}): Promise<{ items: HubActivityItem[]; nextCursor: string | null }> {
  const limit = Math.max(1, Math.min(options.limit ?? 30, 100));
  const folder = options.folder ?? "all";
  const show = options.show ?? "all";
  if (show === "unread" && options.viewer.readPoint === null) return { items: [], nextCursor: null };

  let cursorDate = validCursor(options.cursor);
  let out: HubActivityItem[] = [];
  let nextCursor: string | null = null;
  for (let pass = 0; pass < (options.passes ?? 3); pass++) {
    const page = await historyPage({
      hubId: options.hubId,
      hubSlug: options.hubSlug,
      viewer: options.viewer,
      conversationsEnabled: options.conversationsEnabled !== false,
      filesEnabled: options.filesEnabled !== false,
      folder,
      cursorDate,
      since: show === "unread" ? options.viewer.readPoint : null,
      limit,
    });
    const opened = await openedKeys(options.hubId, options.viewer.userId, page.items.flatMap((i) => i.readKeys ?? [i.id]));
    const marked = markRead(page.items, options.viewer, opened, page.tsOfKey, page.actorOfKey).filter(
      (item) => (folder !== "for-you" || item.isForUser) && (show === "all" || item.unread),
    );
    out = mergeById([...out, ...marked]);
    nextCursor = page.nextCursor;
    if (out.length >= Math.min(limit, 10) || !nextCursor) break;
    cursorDate = new Date(nextCursor);
  }
  return { items: out, nextCursor };
}

// Computed once per request: the hub layout (the rail's number) and the
// Updates page both ask. Primitive arguments, so React's cache can match them.
const needsOnce = cache(async (
  hubId: string, hubSlug: string, userId: string, rolesKey: string, isLead: boolean, readPointMs: number | null,
): Promise<HubActivityItem[]> => {
  // Never rejects: React caches a rejection too, and both the rail and the
  // page read this. A failure shows no Needs you rather than breaking a page.
  try {
    const toolSlugs = await installedUpdateApps(hubId);
    const raw = await listInstalledAppNeeds(toolSlugs, {
      hubId, hubSlug, userId, roles: rolesKey ? rolesKey.split(",") : [], isLead,
    });
    const opened = await openedKeys(hubId, userId, raw.map((i) => i.id));
    // A need is news until opened, whenever its session is.
    return raw.map((item) => ({ ...item, readKeys: [item.id], unread: readPointMs !== null && !opened.has(item.id) }));
  } catch (err) {
    console.error("[updates] Needs you failed", err);
    return [];
  }
});

const forYouUnreadOnce = cache(async (
  hubId: string, hubSlug: string, userId: string, rolesKey: string, isLead: boolean, readPointMs: number | null,
  conversationsEnabled: boolean, filesEnabled: boolean,
): Promise<HubActivityItem[]> => {
  if (readPointMs === null) return [];
  const viewer = { userId, roles: rolesKey ? rolesKey.split(",") : [], isLead, readPoint: new Date(readPointMs) };
  try {
    const page = await listHubActivity({
      hubId, hubSlug, viewer, conversationsEnabled, filesEnabled, folder: "for-you", show: "unread", limit: 100, passes: 1,
    });
    return page.items;
  } catch (err) {
    console.error("[updates] For you count failed", err);
    return [];
  }
});

type Scope = {
  hubId: string;
  hubSlug: string;
  viewer: HubActivityViewer;
  conversationsEnabled: boolean;
  filesEnabled: boolean;
};

function onceArgs(o: { hubId: string; hubSlug: string; viewer: HubActivityViewer }) {
  return [
    o.hubId, o.hubSlug, o.viewer.userId, [...o.viewer.roles].sort().join(","), o.viewer.isLead,
    o.viewer.readPoint ? o.viewer.readPoint.getTime() : null,
  ] as const;
}

/** What the viewer could act on now, from installed apps, with read state. */
export function listHubNeeds(options: { hubId: string; hubSlug: string; viewer: HubActivityViewer }): Promise<HubActivityItem[]> {
  return needsOnce(...onceArgs(options));
}

/**
 * Unread counts for the folders. "For you" is the same count as the rail's
 * (Needs you, plus history about you); Everything and each type count up to
 * 100 unread items (shown as 99+).
 */
export async function countHubUnread(options: Scope): Promise<{
  forYou: number;
  all: number;
  bySource: Partial<Record<HubActivitySourceKey, number>>;
}> {
  if (options.viewer.readPoint === null) return { forYou: 0, all: 0, bySource: {} };
  const [all, forYou] = await Promise.all([
    listHubActivity({ ...options, folder: "all", show: "unread", limit: 100, passes: 1 }),
    countHubUnreadForYou(options),
  ]);
  const bySource: Partial<Record<HubActivitySourceKey, number>> = {};
  for (const item of all.items) bySource[item.sourceKey] = (bySource[item.sourceKey] ?? 0) + 1;
  return { forYou, all: all.items.length, bySource };
}

/** The rail's number for one team: unread items for you only (Jesse, 2026-10-19). */
export async function countHubUnreadForYou(options: Scope): Promise<number> {
  if (options.viewer.readPoint === null) return 0;
  const [history, needs] = await Promise.all([
    forYouUnreadOnce(...onceArgs(options), options.conversationsEnabled, options.filesEnabled),
    listHubNeeds(options),
  ]);
  return history.length + needs.filter((n) => n.unread).length;
}

/**
 * Mark items read, or everything the person had on screen ("Mark all as
 * read" sends `asOf`, when their page loaded, so what arrived since stays
 * unread). The read point only moves forward.
 */
export async function markHubUpdatesRead(options: {
  hubId: string;
  userId: string;
  keys?: string[];
  all?: boolean;
  asOf?: Date | null;
}): Promise<void> {
  if (options.all) {
    const now = new Date();
    const asOf = options.asOf && options.asOf < now ? options.asOf : now;
    await db.hubMember.updateMany({
      where: {
        hubId: options.hubId,
        userId: options.userId,
        OR: [{ activitySeenAt: null }, { activitySeenAt: { lt: asOf } }],
      },
      data: { activitySeenAt: asOf },
    });
    // Needs-you items are dated by their session, so the read point doesn't
    // cover them: the caller passes their keys too.
  }
  const keys = [...new Set((options.keys ?? []).filter((k) => typeof k === "string" && k.length > 0 && k.length <= 200))].slice(0, 200);
  if (keys.length === 0) return;
  await db.hubUpdateRead.createMany({
    data: keys.map((itemKey) => ({ userId: options.userId, hubId: options.hubId, itemKey })),
    skipDuplicates: true,
  });
}

/** Durable, app-owned Home signals. Passive shared history stays in Updates. */
export async function getHubHomeAttention(options: {
  hubId: string;
  hubSlug: string;
  userId: string;
}): Promise<HubAttentionItem[]> {
  const toolSlugs = await installedUpdateApps(options.hubId);
  return getInstalledAppAttention(toolSlugs, options.hubId, options.hubSlug, options.userId);
}
