import { db } from "@/lib/db";
import {
  countInstalledAppUpdatesSince,
  getInstalledAppAttention,
  listInstalledAppUpdates,
} from "@/lib/hubApps";
import { getToolBySlug, type ToolSlug } from "@/lib/toolRegistry";

export type HubActivitySourceKey = "conversations" | "files" | "members" | `app:${ToolSlug}`;

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
  isNew: boolean;
  isForUser: boolean;
};

export type HubActivityFilter = "all" | "new" | "for-me";

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

function createdAtWindow(cursorDate: Date | null, filter: HubActivityFilter, newSince: Date | null) {
  const gt = filter === "new" ? newSince ?? undefined : undefined;
  const lt = cursorDate ?? undefined;
  return gt || lt ? { ...(gt ? { gt } : {}), ...(lt ? { lt } : {}) } : undefined;
}

function isAfter(iso: string, boundary: Date | null) {
  return Boolean(boundary && new Date(iso).getTime() > boundary.getTime());
}

async function installedUpdateApps(hubId: string): Promise<ToolSlug[]> {
  const links = await db.hubAppLink.findMany({
    where: { hubId, isEnabled: true, toolSlug: { not: null } },
    select: { toolSlug: true },
  });
  return links.flatMap((link) => {
    const tool = link.toolSlug ? getToolBySlug(link.toolSlug) : null;
    return tool?.spaceContributions.updates ? [tool.slug] : [];
  });
}

export async function listHubActivity(options: {
  hubId: string;
  hubSlug: string;
  userId: string;
  conversationsEnabled?: boolean;
  filter?: HubActivityFilter;
  newSince?: Date | null;
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: HubActivityItem[]; nextCursor: string | null }> {
  const limit = Math.max(1, Math.min(options.limit ?? 30, 60));
  const filter = options.filter ?? "all";
  if (filter === "new" && !options.newSince) {
    return { items: [], nextCursor: null };
  }
  const cursorDate = validCursor(options.cursor);
  const createdAt = createdAtWindow(cursorDate, filter, options.newSince ?? null);
  const forUser = filter === "for-me";
  const toolSlugs = await installedUpdateApps(options.hubId);

  const [threads, replies, fileAudits, joins, appItems] = await Promise.all([
    options.conversationsEnabled === false || forUser
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
    options.conversationsEnabled === false
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
    db.googleFileAudit.findMany({
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
    forUser
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
      newSince: options.newSince ?? null,
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
      isNew: isAfter(ts, options.newSince ?? null),
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
      isNew: isAfter(ts, options.newSince ?? null),
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
      isNew: isAfter(ts, options.newSince ?? null),
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
      isNew: isAfter(ts, options.newSince ?? null),
      isForUser: false,
    });
  }
  for (const item of appItems) {
    items.push({
      ...item,
      isNew: isAfter(item.ts, options.newSince ?? null),
    });
  }

  items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const page = items.slice(0, limit);
  return {
    items: page,
    nextCursor: page.length === limit ? page[page.length - 1].ts : null,
  };
}

/** Count shared Updates after the independent Updates read boundary. */
export async function countHubActivitySince(hubId: string, since: Date | null): Promise<number> {
  if (!since) return 0;
  const hub = await db.hub.findUnique({
    where: { id: hubId },
    select: { slug: true, conversationsEnabled: true },
  });
  if (!hub) return 0;
  const toolSlugs = await installedUpdateApps(hubId);
  const [threads, replies, files, joins, appUpdates] = await Promise.all([
    hub.conversationsEnabled
      ? db.hubConversationThread.count({ where: { hubId, deletedAt: null, createdAt: { gt: since } } })
      : Promise.resolve(0),
    hub.conversationsEnabled
      ? db.hubConversationReply.count({ where: { thread: { hubId, deletedAt: null }, createdAt: { gt: since } } })
      : Promise.resolve(0),
    db.googleFileAudit.findMany({
      where: { hubId, action: { in: [...FILE_ACTIONS] }, createdAt: { gt: since } },
      select: { googleFileId: true },
    }),
    db.hubMember.count({ where: { hubId, joinedAt: { gt: since } } }),
    countInstalledAppUpdatesSince(toolSlugs, hub.slug, since),
  ]);
  const changedFileIds = [...new Set(files.flatMap((file) => file.googleFileId ? [file.googleFileId] : []))];
  const heldFiles = changedFileIds.length
    ? await db.googleFileMeta.findMany({
        where: { googleFileId: { in: changedFileIds }, heldAt: { not: null } },
        select: { googleFileId: true },
      })
    : [];
  const heldFileIds = new Set(heldFiles.map((file) => file.googleFileId));
  const visibleFileCount = files.filter((file) => !file.googleFileId || !heldFileIds.has(file.googleFileId)).length;
  return threads + replies + visibleFileCount + joins + appUpdates;
}

/** Personal, actionable Home signals. Passive shared history stays in Updates. */
export async function getHubHomeAttention(options: {
  hubId: string;
  hubSlug: string;
  userId: string;
  seenAt: Date | null;
  conversationsEnabled: boolean;
}): Promise<HubAttentionItem[]> {
  const toolSlugs = await installedUpdateApps(options.hubId);
  const [conversationReplies, fileCommentAudits, appAttention] = await Promise.all([
    options.conversationsEnabled && options.seenAt
      ? db.hubConversationReply.count({
          where: {
            authorId: { not: options.userId },
            createdAt: { gt: options.seenAt },
            thread: {
              hubId: options.hubId,
              deletedAt: null,
              subscriptions: { some: { userId: options.userId } },
            },
          },
        })
      : Promise.resolve(0),
    options.seenAt
      ? db.googleFileAudit.findMany({
          where: {
            hubId: options.hubId,
            action: "comment",
            userId: { not: options.userId },
            createdAt: { gt: options.seenAt },
          },
          select: { googleFileId: true },
        })
      : Promise.resolve([]),
    getInstalledAppAttention(toolSlugs, options.hubId, options.hubSlug, options.userId),
  ]);

  const fileIds = [...new Set(fileCommentAudits.flatMap((audit) => audit.googleFileId ? [audit.googleFileId] : []))];
  const ownedVisibleFiles = fileIds.length
    ? await db.googleFileMeta.findMany({
        where: {
          googleFileId: { in: fileIds },
          creatorUserId: options.userId,
          heldAt: null,
        },
        select: { googleFileId: true },
      })
    : [];
  const ownedFileIds = new Set(ownedVisibleFiles.map((file) => file.googleFileId));
  const fileComments = fileCommentAudits.filter(
    (audit) => audit.googleFileId && ownedFileIds.has(audit.googleFileId),
  ).length;

  const attention: HubAttentionItem[] = [];
  if (conversationReplies > 0) {
    attention.push({
      id: "conversation-replies",
      sourceKey: "conversations",
      sourceLabel: "Conversations",
      label: plural(conversationReplies, "1 new reply in a conversation you follow", `${conversationReplies} new replies in conversations you follow`),
      href: `/account/hub/${options.hubSlug}/activity?filter=for-me`,
      count: conversationReplies,
    });
  }
  if (fileComments > 0) {
    attention.push({
      id: "file-comments",
      sourceKey: "files",
      sourceLabel: "Files",
      label: plural(fileComments, "1 new comment on your file", `${fileComments} new comments on your files`),
      href: `/account/hub/${options.hubSlug}/activity?filter=for-me`,
      count: fileComments,
    });
  }
  return [...attention, ...appAttention];
}

function plural(count: number, singular: string, multiple: string) {
  return count === 1 ? singular : multiple;
}
