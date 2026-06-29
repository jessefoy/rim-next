import { NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendMindMapCommentEmail } from "@/lib/email";
import {
  loadConversationContext,
  coordinatorRecipientIds,
  commentRecipients,
  readReactions,
} from "@/lib/mindMapConversation";

function displayName(u: { firstName: string | null; lastName: string | null; preferredName: string | null }) {
  return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || "Member";
}
function bodyText(body: unknown): string {
  return typeof body === "string" ? body : "";
}

/** GET — the topic's conversation (comments + your follow state). Empty when none yet. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; nodeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, nodeId } = await params;
  const ctx = await loadConversationContext(id, session.user.id, session.user.roles ?? []);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!ctx.canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const thread = await db.hubConversationThread.findFirst({
    where: { mindMapNodeId: nodeId, deletedAt: null },
    select: { id: true },
  });
  if (!thread) {
    return NextResponse.json({ comments: [], currentUserSubscribed: false, hasHub: ctx.hubHome !== null });
  }

  const [replies, sub] = await Promise.all([
    db.hubConversationReply.findMany({
      where: { threadId: thread.id },
      include: { author: { select: { firstName: true, lastName: true, preferredName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.hubThreadSubscription.findFirst({ where: { threadId: thread.id, userId: session.user.id }, select: { id: true } }),
  ]);

  return NextResponse.json({
    comments: replies.map((r) => ({
      id: r.id,
      authorName: displayName(r.author),
      body: bodyText(r.body),
      createdAt: r.createdAt.toISOString(),
      reactions: readReactions(r.reactions),
    })),
    currentUserSubscribed: !!sub,
    hasHub: ctx.hubHome !== null,
  });
}

/** POST — add a comment. Lazily creates the topic's thread on the first comment. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; nodeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { id, nodeId } = await params;
  const ctx = await loadConversationContext(id, userId, session.user.roles ?? []);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!ctx.canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { body } = await req.json();
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) return NextResponse.json({ error: "Write a comment first." }, { status: 400 });

  if (ctx.hubHome === null) {
    return NextResponse.json({ error: "Place this map in a hub to start conversations." }, { status: 400 });
  }

  // The node must be persisted (a brand-new node is saved by the editor's
  // flush-before-post). If it isn't here yet, ask the client to retry.
  const node = await db.mindMapNode.findFirst({ where: { id: nodeId, mapId: id }, select: { id: true, label: true } });
  if (!node) return NextResponse.json({ error: "Saving — try again in a moment." }, { status: 409 });

  let thread = await db.hubConversationThread.findFirst({
    where: { mindMapNodeId: nodeId, deletedAt: null },
    select: { id: true },
  });

  let createdNew = false;
  if (!thread) {
    try {
      thread = await db.hubConversationThread.create({
        data: {
          hubId: ctx.hubHome,
          authorId: userId,
          title: node.label,
          mindMapNodeId: nodeId,
          status: "OPEN",
        },
        select: { id: true },
      });
      createdNew = true;
    } catch {
      // Lost the race to a concurrent first-comment (the @@unique on
      // mindMapNodeId rejected the second create) — use the winner.
      thread = await db.hubConversationThread.findFirst({
        where: { mindMapNodeId: nodeId, deletedAt: null },
        select: { id: true },
      });
    }
  }
  if (!thread) return NextResponse.json({ error: "Could not start the conversation." }, { status: 500 });
  const threadId0 = thread.id;

  if (createdNew) {
    // Auto-follow on a new topic: the commenter, the map author, and every
    // coordinator of every hub the map lives in.
    const coordIds = await coordinatorRecipientIds(ctx.mapHubIds);
    const subRows = [{ threadId: threadId0, userId, source: "AUTHOR" }];
    const seen = new Set<string>([userId]);
    for (const uid of [ctx.map.addedById, ...coordIds]) {
      if (seen.has(uid)) continue;
      seen.add(uid);
      subRows.push({ threadId: threadId0, userId: uid, source: uid === ctx.map.addedById ? "ADDED" : "COORDINATOR_AUTO" });
    }
    await db.hubThreadSubscription.createMany({ data: subRows, skipDuplicates: true });
  } else {
    // Follow-by-commenting (idempotent).
    await db.hubThreadSubscription.upsert({
      where: { threadId_userId: { threadId: threadId0, userId } },
      update: {},
      create: { threadId: threadId0, userId, source: "ADDED" },
    });
  }

  const reply = await db.hubConversationReply.create({
    data: { threadId: thread.id, authorId: userId, body: text },
    include: { author: { select: { firstName: true, lastName: true, preferredName: true } } },
  });

  const commenterName = session.user.name || session.user.email?.split("@")[0] || "Someone";
  const topicLabel = node.label;
  const mapTitle = ctx.map.title;
  const mapId = id;
  const threadId = thread.id;
  const mapHubIds = ctx.mapHubIds;

  after(async () => {
    const recipients = await commentRecipients(threadId, mapHubIds, userId);
    await Promise.allSettled(
      recipients.map((r) =>
        sendMindMapCommentEmail({ to: r.email, firstName: r.firstName, commenterName, topicLabel, mapTitle, mapId }),
      ),
    );
  });

  return NextResponse.json(
    {
      id: reply.id,
      authorName: displayName(reply.author),
      body: bodyText(reply.body),
      createdAt: reply.createdAt.toISOString(),
      reactions: {},
    },
    { status: 201 },
  );
}
