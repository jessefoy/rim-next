import { db } from "@/lib/db";
import {
  getInstalledAppAttention,
  listInstalledAppUpdates,
} from "@/lib/hubApps";
import { getToolBySlug, type ToolSlug } from "@/lib/toolRegistry";

export type HubActivitySourceKey = "conversations" | "files" | "members" | `app:${ToolSlug}`;
export type HubActivitySource = "all" | HubActivitySourceKey;

export type HubActivitySourceOption = {
  key: HubActivitySourceKey;
  label: string;
};

/** One source-aware shape for every meaningful item in Space Updates. */
export type HubActivityItem = {
  id: string;
  sourceKey: HubActivitySourceKey;
  sourceLabel: string;
  kind: string;
  authorId: string | null;
  authorName: string;
  verb: string;
  subject: string | null;
  href: string;
  ts: string;
  isForUser: boolean;
};

export type HubActivityFilter = "all" | "recent" | "for-me";

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

const RECENT_ACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;

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
    case "request-removal": return "requested removal of";
    case "approve-removal": return "approved removal of";
    case "cancel-removal": return "kept";
    default: return "updated";
  }
}

function validCursor(cursor?: string | null): Date | null {
  if (!cursor) return null;
  const parsed = new Date(cursor);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function createdAtWindow(cursorDate: Date | null, filter: HubActivityFilter, recentSince: Date) {
  const gt = filter === "recent" ? recentSince : undefined;
  const lt = cursorDate ?? undefined;
  return gt || lt ? { ...(gt ? { gt } : {}), ...(lt ? { lt } : {}) } : undefined;
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

/** The core sections and installed apps that can contribute Updates here. */
export async function listHubActivitySources(options: {
  hubId: string;
  conversationsEnabled: boolean;
  filesEnabled: boolean;
}): Promise<HubActivitySourceOption[]> {
  const toolSlugs = await installedUpdateApps(options.hubId);
  const sources: HubActivitySourceOption[] = [
    ...(options.conversationsEnabled
      ? [{ key: "conversations" as const, label: "Conversations" }]
      : []),
    ...(options.filesEnabled ? [{ key: "files" as const, label: "Files" }] : []),
    { key: "members", label: "Members" },
    ...toolSlugs.flatMap((slug) => {
      const tool = getToolBySlug(slug);
      return tool ? [{ key: `app:${slug}` as const, label: tool.label }] : [];
    }),
  ];
  return sources.sort((a, b) => a.label.localeCompare(b.label));
}

/** Treat an unknown or non-Updates source as the complete stream. */
export function parseHubActivitySource(value: string | null): HubActivitySource {
  if (value === "conversations" || value === "files" || value === "members") return value;
  if (value?.startsWith("app:")) {
    const slug = value.slice(4);
    const tool = getToolBySlug(slug);
    if (tool?.spaceContributions.updates) return `app:${tool.slug}`;
  }
  return "all";
}

export async function listHubActivity(options: {
  hubId: string;
  hubSlug: string;
  userId: string;
  conversationsEnabled?: boolean;
  filesEnabled?: boolean;
  source?: HubActivitySource;
  filter?: HubActivityFilter;
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: HubActivityItem[]; nextCursor: string | null }> {
  const limit = Math.max(1, Math.min(options.limit ?? 30, 60));
  const filter = options.filter ?? "all";
  const cursorDate = validCursor(options.cursor);
  const recentSince = new Date(Date.now() - RECENT_ACTIVITY_MS);
  const createdAt = createdAtWindow(cursorDate, filter, recentSince);
  const forUser = filter === "for-me";
  const source = options.source ?? "all";
  const includesSource = (key: HubActivitySourceKey) => source === "all" || source === key;
  const installedToolSlugs = await installedUpdateApps(options.hubId);
  const toolSlugs = source === "all"
    ? installedToolSlugs
    : source.startsWith("app:")
      ? installedToolSlugs.filter((slug) => source === `app:${slug}`)
      : [];

  const [threads, replies, fileAudits, joins, appItems] = await Promise.all([
    !includesSource("conversations") || options.conversationsEnabled === false || forUser
      ? Promise.resolve([])
      : db.hubConversationThread.findMany({
          where: {
            hubId: options.hubId,
            deletedAt: null,
            ...(createdAt ? { createdAt } : {}),
          },
          select: {
            id: true,
            title: true,
            authorId: true,
            createdAt: true,
            author: { select: { firstName: true, lastName: true, preferredName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
    !includesSource("conversations") || options.conversationsEnabled === false
      ? Promise.resolve([])
      : db.hubConversationReply.findMany({
          where: {
            thread: {
              hubId: options.hubId,
              deletedAt: null,
              ...(forUser ? { subscriptions: { some: { userId: options.userId } } } : {}),
            },
            ...(forUser ? { authorId: { not: options.userId } } : {}),
            ...(createdAt ? { createdAt } : {}),
          },
          select: {
            id: true,
            authorId: true,
            createdAt: true,
            author: { select: { firstName: true, lastName: true, preferredName: true } },
            thread: {
              select: {
                id: true,
                title: true,
                subscriptions: { where: { userId: options.userId }, select: { id: true }, take: 1 },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
    !includesSource("files") || options.filesEnabled === false
      ? Promise.resolve([])
      : db.googleFileAudit.findMany({
          where: {
            hubId: options.hubId,
            action: { in: forUser ? ["comment"] : [...FILE_ACTIONS] },
            ...(forUser ? { userId: { not: options.userId } } : {}),
            ...(createdAt ? { createdAt } : {}),
          },
          select: { id: true, userId: true, action: true, googleFileId: true, detail: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
    !includesSource("members") || forUser
      ? Promise.resolve([])
      : db.hubMember.findMany({
          where: {
            hubId: options.hubId,
            ...(createdAt ? { joinedAt: createdAt } : {}),
          },
          select: {
            id: true,
            userId: true,
            joinedAt: true,
            user: { select: { firstName: true, lastName: true, preferredName: true } },
          },
          orderBy: { joinedAt: "desc" },
          take: limit,
        }),
    listInstalledAppUpdates(toolSlugs, {
      hubId: options.hubId,
      hubSlug: options.hubSlug,
      userId: options.userId,
      cursorDate,
      recentSince,
      filter,
      limit,
    }),
  ]);

  const auditedFileIds = [...new Set(fileAudits.flatMap((audit) => audit.googleFileId ? [audit.googleFileId] : []))];
  const fileMetas = auditedFileIds.length
    ? await db.googleFileMeta.findMany({
        where: { googleFileId: { in: auditedFileIds } },
        select: { googleFileId: true, heldAt: true, creatorUserId: true },
      })
    : [];
  const fileMetaById = new Map(fileMetas.map((meta) => [meta.googleFileId, meta]));
  const visibleFileAudits = fileAudits.filter((audit) => {
    if (!audit.googleFileId) return !forUser;
    const meta = fileMetaById.get(audit.googleFileId);
    if (meta?.heldAt) return false;
    return !forUser || meta?.creatorUserId === options.userId;
  });
  const fileUserIds = [...new Set(visibleFileAudits.flatMap((audit) => audit.userId ? [audit.userId] : []))];
  const fileUsers = fileUserIds.length
    ? await db.user.findMany({
        where: { id: { in: fileUserIds } },
        select: { id: true, firstName: true, lastName: true, preferredName: true },
      })
    : [];
  const fileUserById = new Map(fileUsers.map((user) => [user.id, user]));

  const items: HubActivityItem[] = [];
  for (const thread of threads) {
    const ts = thread.createdAt.toISOString();
    items.push({
      id: `conversation-${thread.id}`,
      sourceKey: "conversations",
      sourceLabel: "Conversation",
      kind: "conversation-started",
      authorId: thread.authorId,
      authorName: personName(thread.author),
      verb: "started",
      subject: thread.title,
      href: `/account/hub/${options.hubSlug}/conversations/${thread.id}`,
      ts,
      isForUser: false,
    });
  }
  for (const reply of replies) {
    const ts = reply.createdAt.toISOString();
    items.push({
      id: `reply-${reply.id}`,
      sourceKey: "conversations",
      sourceLabel: "Conversation reply",
      kind: "conversation-reply",
      authorId: reply.authorId,
      authorName: personName(reply.author),
      verb: "replied to",
      subject: reply.thread.title,
      href: `/account/hub/${options.hubSlug}/conversations/${reply.thread.id}`,
      ts,
      isForUser: reply.authorId !== options.userId && reply.thread.subscriptions.length > 0,
    });
  }
  for (const audit of visibleFileAudits) {
    const ts = audit.createdAt.toISOString();
    items.push({
      id: `file-${audit.id}`,
      sourceKey: "files",
      sourceLabel: audit.action === "comment" ? "File comment" : "Files",
      kind: audit.action === "comment" ? "file-comment" : `file-${audit.action}`,
      authorId: audit.userId,
      authorName: personName(audit.userId ? fileUserById.get(audit.userId) : null),
      verb: fileVerb(audit.action),
      subject: detailName(audit.detail),
      href: audit.googleFileId
        ? `/account/files/${audit.googleFileId}`
        : `/account/hub/${options.hubSlug}/files`,
      ts,
      isForUser: Boolean(
        audit.googleFileId &&
        audit.userId !== options.userId &&
        fileMetaById.get(audit.googleFileId)?.creatorUserId === options.userId,
      ),
    });
  }
  for (const member of joins) {
    const ts = member.joinedAt.toISOString();
    items.push({
      id: `member-${member.id}`,
      sourceKey: "members",
      sourceLabel: "Members",
      kind: "member-joined",
      authorId: member.userId,
      authorName: personName(member.user),
      verb: "joined the Space",
      subject: null,
      href: `/account/hub/${options.hubSlug}/members`,
      ts,
      isForUser: false,
    });
  }
  for (const item of appItems) {
    items.push(item);
  }

  items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const page = items.slice(0, limit);
  return {
    items: page,
    nextCursor: page.length === limit ? page[page.length - 1].ts : null,
  };
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
