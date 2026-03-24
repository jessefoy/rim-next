import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";

/** PATCH /api/hub/[slug]/conversations/[id]/replies/[replyId] — edit own reply */
export async function PATCH(
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

  const reqBody = await request.json().catch(() => null);
  const { body: newBody } = (reqBody ?? {}) as { body?: any };

  if (!newBody) {
    return Response.json({ error: "Reply body is required" }, { status: 400 });
  }

  const reply = await db.hubConversationReply.findUnique({ where: { id: replyId } });
  if (!reply || reply.threadId !== threadId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (reply.authorId !== session.user.id) {
    return Response.json({ error: "You can only edit your own replies" }, { status: 403 });
  }

  const updated = await db.hubConversationReply.update({
    where: { id: replyId },
    data: { body: newBody, edited: true, editedAt: new Date() },
  });

  return Response.json(updated);
}
