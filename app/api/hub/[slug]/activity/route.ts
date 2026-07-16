import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";

/**
 * GET /api/hub/[slug]/activity
 *
 * A unified, chronologically sorted activity stream for a hub. Each item has a
 * `type` that tells the client how to render it. Since native Documents were
 * retired (session 165), the stream is the hub's conversation activity —
 * new threads and replies.
 *
 * Query params:
 *   mine:   "true" — only activity the current user is involved in
 *   cursor: ISO date string — return items older than this (pagination)
 *   limit:  number (default 30, max 60)
 */

type ActivityItem =
  | { type: "hub_thread"; id: string; threadId: string; threadTitle: string; authorId: string; authorName: string; ts: string }
  | { type: "hub_reply";  id: string; threadId: string; threadTitle: string; authorId: string; authorName: string; ts: string };

function personName(u: { firstName: string | null; lastName: string | null; preferredName: string | null }) {
  const first = u.preferredName || u.firstName;
  return [first, u.lastName].filter(Boolean).join(" ") || "Someone";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessHub(member, session.user.roles ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url    = new URL(req.url);
  const mine   = url.searchParams.get("mine") === "true";
  const cursor = url.searchParams.get("cursor");
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "30", 10), 60);
  const userId = session.user.id;

  const cursorDate = cursor ? new Date(cursor) : undefined;
  const dateFilter = cursorDate ? { lt: cursorDate } : undefined;

  // For "mine" filter: fetch subscription thread IDs once upfront.
  let myThreadIds: string[] | null = null;
  if (mine) {
    const subs = await db.hubThreadSubscription.findMany({
      where: { userId },
      select: { threadId: true },
    });
    myThreadIds = subs.map((s) => s.threadId);
  }

  const items: ActivityItem[] = [];

  const hubThreads = await db.hubConversationThread.findMany({
    where: {
      hubId:     hub.id,
      deletedAt: null,
      ...(mine && myThreadIds !== null && { id: { in: myThreadIds } }),
      ...(dateFilter && { createdAt: dateFilter }),
    },
    select: {
      id: true, title: true, authorId: true, createdAt: true,
      author: { select: { firstName: true, lastName: true, preferredName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  for (const t of hubThreads) {
    items.push({
      type:        "hub_thread",
      id:          `hub-thread-${t.id}`,
      threadId:    t.id,
      threadTitle: t.title,
      authorId:    t.authorId,
      authorName:  personName(t.author),
      ts:          t.createdAt.toISOString(),
    });
  }

  const hubReplies = await db.hubConversationReply.findMany({
    where: {
      thread: { hubId: hub.id },
      ...(mine && myThreadIds !== null && { threadId: { in: myThreadIds } }),
      ...(dateFilter && { createdAt: dateFilter }),
    },
    select: {
      id: true, authorId: true, createdAt: true,
      author: { select: { firstName: true, lastName: true, preferredName: true } },
      thread: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  for (const r of hubReplies) {
    items.push({
      type:        "hub_reply",
      id:          `hub-reply-${r.id}`,
      threadId:    r.thread.id,
      threadTitle: r.thread.title,
      authorId:    r.authorId,
      authorName:  personName(r.author),
      ts:          r.createdAt.toISOString(),
    });
  }

  // Sort newest-first, take the page.
  items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const page = items.slice(0, limit);
  const nextCursor = page.length === limit ? page[page.length - 1].ts : null;

  return NextResponse.json({ items: page, nextCursor });
}
