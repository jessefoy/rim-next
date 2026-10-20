/**
 * A person's Notifications (2026-10-20). Jesse: "in one's general member
 * area, a notification section… notifications from all kinds of sources
 * because some people don't even have hubs. It could aggregate all of their
 * notifications from their hubs… like text meets email, where there's the
 * right information with a dropdown… and where they can go into the hub when
 * they click them."
 *
 * One principle: every notice is written once, to the person. It is shown
 * in Notifications (/account/notifications) and emailed by their choice.
 * The email senders in lib/email.ts pass a `notice` to sendTemplatedEmail,
 * which records it here and then decides the email:
 *
 *   - "personal": about you or yours (your session, your registration, your
 *     account). Always emailed, as today.
 *   - "team": news on a team you're on (a conversation, a file, a session
 *     that needs someone). Emailed by your choice (User.teamEmailMode):
 *     each one (the default, as today), one daily summary, or none ("I'll
 *     check Notifications").
 *
 * Staged accounts that have never signed in get no notices (the same gate as
 * the emails). Read is a mark, never a removal.
 */

import { db } from "@/lib/db";

export type NoticeCategory = "personal" | "team";

export interface NoticeInput {
  /** The kind, usually the email template's slug. */
  kind: string;
  category: NoticeCategory;
  /** Where it's from: "team:host-team", "programs", "account". */
  sourceKey: string;
  /** "Hosting Team", "Programs", "Your account". */
  sourceLabel: string;
  /** One line, a sentence: "Maria asked for someone to cover Good Evening · Thu, Oct 22". */
  title: string;
  /** A few plain lines shown when it's opened. */
  detail?: string | null;
  /** Where it leads in the app: "/tools/schedule?hub=…&session=…". */
  href: string;
  /** Notices about one thing fold together: "conv:<threadId>". */
  threadKey?: string | null;
  /** Team news that can't wait (a session within two days that needs
   *  someone): emailed at once whatever the person chose (Jesse, 2026-10-20). */
  urgent?: boolean;
}

/** Within two days: news about it can't wait for a summary. */
export function isUrgentSession(at: Date | null | undefined, now: Date = new Date()): boolean {
  if (!at || Number.isNaN(at.getTime())) return false;
  const ahead = at.getTime() - now.getTime();
  return ahead >= 0 && ahead < 2 * 24 * 60 * 60 * 1000;
}

export type TeamEmailMode = "each" | "summary" | "none";

export function teamEmailModeOf(value: string | null | undefined): TeamEmailMode {
  return value === "summary" || value === "none" ? value : "each";
}

/** An app path from a full link (emails carry full links; the inbox keeps paths). */
export function appPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return url.startsWith("/") ? url : `/${url}`;
  }
}

/**
 * Record a notice for the person with this email. Returns it and their email
 * choice for team news, or null when there's no such signed-in person.
 * Never throws: a notice that can't be written must not stop the email.
 */
export async function recordNotice(email: string, notice: NoticeInput): Promise<{ id: string; mode: TeamEmailMode } | null> {
  try {
    const user = await db.user.findFirst({
      where: { email: { equals: email.trim(), mode: "insensitive" }, archivedAt: null },
      select: { id: true, emailVerified: true, teamEmailMode: true },
    });
    if (!user || !user.emailVerified) return null;
    const created = await db.notification.create({
      data: {
        userId: user.id,
        kind: notice.kind,
        category: notice.category,
        sourceKey: notice.sourceKey,
        sourceLabel: notice.sourceLabel,
        title: notice.title.slice(0, 300),
        detail: notice.detail ? notice.detail.slice(0, 2000) : null,
        href: notice.href.slice(0, 500),
        threadKey: notice.threadKey ?? null,
      },
      select: { id: true },
    });
    return { id: created.id, mode: teamEmailModeOf(user.teamEmailMode) };
  } catch (err) {
    console.error("[notifications] record failed", notice.kind, err);
    return null;
  }
}

/**
 * This team notice's email is settled: sent one by one, or not wanted
 * ("none"). What's left unsettled is due for the daily summary.
 */
export async function settleNoticeEmail(id: string): Promise<void> {
  await db.notification.update({ where: { id }, data: { summarizedAt: new Date() } }).catch((err) => {
    console.error("[notifications] settle failed", err);
  });
}

/** A team as a notice source. */
export function teamSource(hubSlug: string, teamName: string): Pick<NoticeInput, "sourceKey" | "sourceLabel"> {
  return { sourceKey: `team:${hubSlug}`, sourceLabel: teamName };
}

export const PROGRAMS_SOURCE = { sourceKey: "programs", sourceLabel: "Programs" } as const;
export const ACCOUNT_SOURCE = { sourceKey: "account", sourceLabel: "Your account" } as const;

/** The opening words of what someone wrote (HTML or plain), for a notice. */
export function excerptOf(body: unknown, max = 160): string | null {
  if (typeof body !== "string") return null;
  const text = body
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text;
}

// ─── Reading them ────────────────────────────────────────────────────────────

export interface NoticeRow {
  id: string;
  kind: string;
  category: NoticeCategory;
  sourceKey: string;
  sourceLabel: string;
  title: string;
  detail: string | null;
  href: string;
  threadKey: string | null;
  ts: string;
  unread: boolean;
}

/** How many unread notices a person has (the rail's number). */
export async function countUnreadNotices(userId: string): Promise<number> {
  try {
    return await db.notification.count({ where: { userId, readAt: null } });
  } catch (err) {
    console.error("[notifications] count failed", err);
    return 0;
  }
}

/**
 * A page of a person's notices, newest first. `source`: one source key, or
 * all. `unreadOnly`: leave out what they've read. The cursor is the last
 * row's id (ties on time can't drop a row).
 */
export async function listNotices(opts: {
  userId: string;
  source?: string | null;
  unreadOnly?: boolean;
  cursor?: string | null;
  limit?: number;
}): Promise<{ rows: NoticeRow[]; nextCursor: string | null }> {
  const limit = Math.max(1, Math.min(opts.limit ?? 40, 100));
  const found = await db.notification.findMany({
    where: {
      userId: opts.userId,
      ...(opts.source && opts.source !== "all" ? { sourceKey: opts.source } : {}),
      ...(opts.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const page = found.slice(0, limit);
  return {
    rows: page.map((n) => ({
      id: n.id,
      kind: n.kind,
      category: n.category === "team" ? "team" : "personal",
      sourceKey: n.sourceKey,
      sourceLabel: n.sourceLabel,
      title: n.title,
      detail: n.detail,
      href: n.href,
      threadKey: n.threadKey,
      ts: n.createdAt.toISOString(),
      unread: !n.readAt,
    })),
    nextCursor: found.length > limit ? page[page.length - 1].id : null,
  };
}

/** The sources a person has notices from, for the From picker. */
export async function listNoticeSources(userId: string): Promise<{ key: string; label: string; unread: number }[]> {
  const groups = await db.notification.groupBy({
    by: ["sourceKey", "sourceLabel"],
    where: { userId },
    _count: { _all: true },
  });
  const unread = await db.notification.groupBy({
    by: ["sourceKey"],
    where: { userId, readAt: null },
    _count: { _all: true },
  });
  const unreadBy = new Map(unread.map((u) => [u.sourceKey, u._count._all]));
  const seen = new Map<string, { key: string; label: string; unread: number }>();
  for (const g of groups) {
    if (!seen.has(g.sourceKey)) seen.set(g.sourceKey, { key: g.sourceKey, label: g.sourceLabel, unread: unreadBy.get(g.sourceKey) ?? 0 });
  }
  // Teams first by name, then Programs, then the account.
  const rank = (k: string) => (k.startsWith("team:") ? 0 : k === "programs" ? 1 : 2);
  return [...seen.values()].sort((a, b) => rank(a.key) - rank(b.key) || a.label.localeCompare(b.label));
}

/** Mark notices read: these, or everything up to `asOf` (when the page loaded). */
export async function markNoticesRead(opts: { userId: string; ids?: string[]; all?: boolean; asOf?: Date | null; source?: string | null }): Promise<void> {
  const now = new Date();
  if (opts.all) {
    const asOf = opts.asOf && opts.asOf < now ? opts.asOf : now;
    await db.notification.updateMany({
      where: {
        userId: opts.userId,
        readAt: null,
        createdAt: { lte: asOf },
        // Only what's on screen: the From choice, when one is made.
        ...(opts.source && opts.source !== "all" ? { sourceKey: opts.source } : {}),
      },
      data: { readAt: now },
    });
    return;
  }
  const ids = [...new Set((opts.ids ?? []).filter((x) => typeof x === "string"))].slice(0, 200);
  if (!ids.length) return;
  await db.notification.updateMany({ where: { userId: opts.userId, id: { in: ids }, readAt: null }, data: { readAt: now } });
}
