import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { loadConversationContext, readReactions, ALLOWED_EMOJIS } from "@/lib/mindMapConversation";

/**
 * POST /api/mindmaps/[id]/comments/[replyId]/react — toggle the viewer's emoji
 * on a comment. Verifies the comment belongs to a topic of THIS map, and gates
 * on map-view access.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; replyId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { id, replyId } = await params;
  const ctx = await loadConversationContext(id, userId, session.user.roles ?? []);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!ctx.canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { emoji } = await req.json();
  if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
    return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  }

  // The reply must belong to a thread anchored to a node of this map.
  const reply = await db.hubConversationReply.findUnique({
    where: { id: replyId },
    select: { id: true, reactions: true, thread: { select: { mindMapNode: { select: { mapId: true } } } } },
  });
  if (!reply || reply.thread.mindMapNode?.mapId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const reactions = readReactions(reply.reactions);
  const current = reactions[emoji] ?? [];
  if (current.includes(userId)) {
    const next = current.filter((u) => u !== userId);
    if (next.length === 0) delete reactions[emoji];
    else reactions[emoji] = next;
  } else {
    reactions[emoji] = [...current, userId];
  }

  await db.hubConversationReply.update({ where: { id: replyId }, data: { reactions } });
  return NextResponse.json({ reactions });
}
