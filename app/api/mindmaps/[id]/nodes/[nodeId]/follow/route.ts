import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { loadConversationContext } from "@/lib/mindMapConversation";

/** Resolve the node's thread + map-view access. */
async function resolve(id: string, nodeId: string, userId: string, roles: string[]) {
  const ctx = await loadConversationContext(id, userId, roles);
  if (!ctx) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!ctx.canAccess) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const thread = await db.hubConversationThread.findFirst({
    where: { mindMapNodeId: nodeId, deletedAt: null },
    select: { id: true },
  });
  if (!thread) return { error: NextResponse.json({ error: "No conversation yet." }, { status: 404 }) };
  return { threadId: thread.id };
}

/** POST — follow the topic (idempotent). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; nodeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, nodeId } = await params;
  const r = await resolve(id, nodeId, session.user.id, session.user.roles ?? []);
  if (r.error) return r.error;

  await db.hubThreadSubscription.upsert({
    where: { threadId_userId: { threadId: r.threadId, userId: session.user.id } },
    update: {},
    create: { threadId: r.threadId, userId: session.user.id, source: "SELF" },
  });
  return NextResponse.json({ subscribed: true });
}

/** DELETE — unfollow the topic (idempotent). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; nodeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, nodeId } = await params;
  const r = await resolve(id, nodeId, session.user.id, session.user.roles ?? []);
  if (r.error) return r.error;

  await db.hubThreadSubscription.deleteMany({ where: { threadId: r.threadId, userId: session.user.id } });
  return NextResponse.json({ subscribed: false });
}
