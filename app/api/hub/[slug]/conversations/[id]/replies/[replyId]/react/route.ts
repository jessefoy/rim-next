import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";

const ALLOWED_EMOJIS = ["👍", "❤️", "🙏", "💡", "😊"];

/** POST /api/hub/[slug]/conversations/[id]/replies/[replyId]/react — add emoji reaction */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string; replyId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, id: threadId, replyId } = await params;
  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!member && !isAdmin)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { emoji } = (body ?? {}) as { emoji?: string };

  if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
    return Response.json({ error: "Invalid emoji" }, { status: 400 });
  }

  const reply = await db.hubConversationReply.findUnique({ where: { id: replyId } });
  if (!reply || reply.threadId !== threadId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const current = (reply.reactions as Record<string, number>) ?? {};
  const updated = { ...current, [emoji]: (current[emoji] ?? 0) + 1 };

  await db.hubConversationReply.update({
    where: { id: replyId },
    data: { reactions: updated },
  });

  return Response.json({ reactions: updated });
}
