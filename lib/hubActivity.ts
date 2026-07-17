import { db } from "@/lib/db";

/** One renderer-friendly shape for every source in a Space activity river. */
export type HubActivityItem = {
  type: "conversation" | "reply" | "file" | "member" | "app";
  id: string;
  authorId: string | null;
  authorName: string;
  verb: string;
  subject: string | null;
  href: string;
  ts: string;
};

export type HubActivityFilter = "all" | "mine";

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
    case "create-doc": return "created the document";
    case "create-sheet": return "created the spreadsheet";
    case "create-slides": return "created the presentation";
    case "create-folder": return "created the folder";
    case "upload": return "uploaded";
    case "rename": return "renamed";
    case "move": return "moved";
    case "hold": return "held back";
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

function sessionLabel(date: Date | null): string {
  if (!date) return "an upcoming session";
  return date.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
  });
}

export async function listHubActivity(options: {
  hubId: string;
  hubSlug: string;
  userId: string;
  conversationsEnabled?: boolean;
  filter?: HubActivityFilter;
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: HubActivityItem[]; nextCursor: string | null }> {
  const limit = Math.max(1, Math.min(options.limit ?? 30, 60));
  const cursorDate = validCursor(options.cursor);
  const createdAt = cursorDate ? { lt: cursorDate } : undefined;
  const mine = options.filter === "mine";
  const actorWhere = mine ? options.userId : undefined;

  const schedulerInstalled = await db.hubAppLink.findFirst({
    where: {
      hubId: options.hubId,
      isEnabled: true,
      toolSlug: "schedule",
    },
    select: { id: true },
  });

  const [threads, replies, fileAudits, joins, subRequests, subClaims] = await Promise.all([
    options.conversationsEnabled === false ? Promise.resolve([]) : db.hubConversationThread.findMany({
      where: {
        hubId: options.hubId,
        deletedAt: null,
        ...(actorWhere ? { authorId: actorWhere } : {}),
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
    options.conversationsEnabled === false ? Promise.resolve([]) : db.hubConversationReply.findMany({
      where: {
        thread: { hubId: options.hubId, deletedAt: null },
        ...(actorWhere ? { authorId: actorWhere } : {}),
        ...(createdAt ? { createdAt } : {}),
      },
      select: {
        id: true,
        authorId: true,
        createdAt: true,
        author: { select: { firstName: true, lastName: true, preferredName: true } },
        thread: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.googleFileAudit.findMany({
      where: {
        hubId: options.hubId,
        action: { in: [...FILE_ACTIONS] },
        ...(actorWhere ? { userId: actorWhere } : {}),
        ...(createdAt ? { createdAt } : {}),
      },
      select: { id: true, userId: true, action: true, googleFileId: true, detail: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.hubMember.findMany({
      where: {
        hubId: options.hubId,
        ...(actorWhere ? { userId: actorWhere } : {}),
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
    schedulerInstalled
      ? db.subRequest.findMany({
          where: {
            assignment: {
              hubSlug: options.hubSlug,
              ...(actorWhere ? { userId: actorWhere } : {}),
            },
            ...(createdAt ? { createdAt } : {}),
          },
          select: {
            id: true,
            programSlug: true,
            sessionDate: true,
            createdAt: true,
            assignment: {
              select: {
                userId: true,
                user: { select: { firstName: true, lastName: true, preferredName: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : Promise.resolve([]),
    schedulerInstalled
      ? db.subClaim.findMany({
          where: {
            request: { assignment: { hubSlug: options.hubSlug } },
            ...(actorWhere ? { claimedById: actorWhere } : {}),
            ...(createdAt ? { createdAt } : {}),
          },
          select: {
            id: true,
            claimedById: true,
            createdAt: true,
            claimedBy: { select: { firstName: true, lastName: true, preferredName: true } },
            request: { select: { programSlug: true, sessionDate: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : Promise.resolve([]),
  ]);

  const auditedFileIds = [...new Set(fileAudits.flatMap((a) => a.googleFileId ? [a.googleFileId] : []))];
  const heldFiles = auditedFileIds.length
    ? await db.googleFileMeta.findMany({
        where: { googleFileId: { in: auditedFileIds }, heldAt: { not: null } },
        select: { googleFileId: true },
      })
    : [];
  const heldFileIds = new Set(heldFiles.map((file) => file.googleFileId));
  const visibleFileAudits = fileAudits.filter(
    (audit) => !audit.googleFileId || !heldFileIds.has(audit.googleFileId),
  );
  const fileUserIds = [...new Set(visibleFileAudits.flatMap((a) => a.userId ? [a.userId] : []))];
  const fileUsers = fileUserIds.length
    ? await db.user.findMany({
        where: { id: { in: fileUserIds } },
        select: { id: true, firstName: true, lastName: true, preferredName: true },
      })
    : [];
  const fileUserById = new Map(fileUsers.map((u) => [u.id, u]));
  const programSlugs = [...new Set([
    ...subRequests.map((request) => request.programSlug),
    ...subClaims.map((claim) => claim.request.programSlug),
  ])];
  const programs = programSlugs.length
    ? await db.program.findMany({
        where: { slug: { in: programSlugs } },
        select: { slug: true, name: true },
      })
    : [];
  const programNameBySlug = new Map(programs.map((program) => [program.slug, program.name]));

  const items: HubActivityItem[] = [];
  for (const t of threads) {
    items.push({
      type: "conversation",
      id: `conversation-${t.id}`,
      authorId: t.authorId,
      authorName: personName(t.author),
      verb: "started",
      subject: t.title,
      href: `/account/hub/${options.hubSlug}/conversations/${t.id}`,
      ts: t.createdAt.toISOString(),
    });
  }
  for (const r of replies) {
    items.push({
      type: "reply",
      id: `reply-${r.id}`,
      authorId: r.authorId,
      authorName: personName(r.author),
      verb: "replied to",
      subject: r.thread.title,
      href: `/account/hub/${options.hubSlug}/conversations/${r.thread.id}`,
      ts: r.createdAt.toISOString(),
    });
  }
  for (const a of visibleFileAudits) {
    items.push({
      type: "file",
      id: `file-${a.id}`,
      authorId: a.userId,
      authorName: personName(a.userId ? fileUserById.get(a.userId) : null),
      verb: fileVerb(a.action),
      subject: detailName(a.detail),
      href: a.googleFileId
        ? `/account/files/${a.googleFileId}`
        : `/account/hub/${options.hubSlug}/files`,
      ts: a.createdAt.toISOString(),
    });
  }
  for (const m of joins) {
    items.push({
      type: "member",
      id: `member-${m.id}`,
      authorId: m.userId,
      authorName: personName(m.user),
      verb: "joined the Space",
      subject: null,
      href: `/account/hub/${options.hubSlug}/members`,
      ts: m.joinedAt.toISOString(),
    });
  }
  for (const request of subRequests) {
    items.push({
      type: "app",
      id: `schedule-sub-${request.id}`,
      authorId: request.assignment.userId,
      authorName: personName(request.assignment.user),
      verb: "requested coverage for",
      subject: `${programNameBySlug.get(request.programSlug) ?? request.programSlug} · ${sessionLabel(request.sessionDate)}`,
      href: `/tools/schedule?hub=${encodeURIComponent(options.hubSlug)}`,
      ts: request.createdAt.toISOString(),
    });
  }
  for (const claim of subClaims) {
    items.push({
      type: "app",
      id: `schedule-sub-claim-${claim.id}`,
      authorId: claim.claimedById,
      authorName: personName(claim.claimedBy),
      verb: "claimed coverage for",
      subject: `${programNameBySlug.get(claim.request.programSlug) ?? claim.request.programSlug} · ${sessionLabel(claim.request.sessionDate)}`,
      href: `/tools/schedule?hub=${encodeURIComponent(options.hubSlug)}`,
      ts: claim.createdAt.toISOString(),
    });
  }

  items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const page = items.slice(0, limit);
  return {
    items: page,
    nextCursor: page.length === limit ? page[page.length - 1].ts : null,
  };
}

/** Count meaningful Space activity after an independent read boundary. */
export async function countHubActivitySince(hubId: string, since: Date | null): Promise<number> {
  if (!since) return 0;
  const hub = await db.hub.findUnique({
    where: { id: hubId },
    select: {
      slug: true,
      conversationsEnabled: true,
      appLinks: {
        where: {
          isEnabled: true,
          toolSlug: "schedule",
        },
        select: { id: true },
        take: 1,
      },
    },
  });
  const [threads, replies, files, joins, subRequests, subClaims] = await Promise.all([
    hub?.conversationsEnabled
      ? db.hubConversationThread.count({ where: { hubId, deletedAt: null, createdAt: { gt: since } } })
      : Promise.resolve(0),
    hub?.conversationsEnabled
      ? db.hubConversationReply.count({ where: { thread: { hubId, deletedAt: null }, createdAt: { gt: since } } })
      : Promise.resolve(0),
    db.googleFileAudit.findMany({
      where: { hubId, action: { in: [...FILE_ACTIONS] }, createdAt: { gt: since } },
      select: { googleFileId: true },
    }),
    db.hubMember.count({ where: { hubId, joinedAt: { gt: since } } }),
    hub?.appLinks.length
      ? db.subRequest.count({ where: { assignment: { hubSlug: hub.slug }, createdAt: { gt: since } } })
      : Promise.resolve(0),
    hub?.appLinks.length
      ? db.subClaim.count({ where: { request: { assignment: { hubSlug: hub.slug } }, createdAt: { gt: since } } })
      : Promise.resolve(0),
  ]);
  const changedFileIds = [...new Set(files.flatMap((file) => file.googleFileId ? [file.googleFileId] : []))];
  const heldFiles = changedFileIds.length
    ? await db.googleFileMeta.findMany({
        where: { googleFileId: { in: changedFileIds }, heldAt: { not: null } },
        select: { googleFileId: true },
      })
    : [];
  const heldFileIds = new Set(heldFiles.map((file) => file.googleFileId));
  const visibleFileCount = files.filter(
    (file) => !file.googleFileId || !heldFileIds.has(file.googleFileId),
  ).length;
  return threads + replies + visibleFileCount + joins + subRequests + subClaims;
}
