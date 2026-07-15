import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canAccessHub, effectiveCoordinator, getHubMembership } from "@/lib/hubAuth";

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
  if (!hub || ((!hub?.conversationsEnabled || !canAccessHub(member, session.user.roles ?? [], hub?.openToAllMembers)))) {
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

/** DELETE /api/hub/[slug]/conversations/[id]/replies/[replyId] — remove a reply.
 *  Allowed for the reply's own author, or a coordinator / GUIDING_TEACHER /
 *  ADMIN for moderation (mirrors the thread moderation model). Hard delete —
 *  replies have no soft-delete lifecycle the way threads/documents do. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string; replyId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, id: threadId, replyId } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!hub?.conversationsEnabled || !canAccessHub(member, session.user.roles ?? [], hub?.openToAllMembers))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const reply = await db.hubConversationReply.findUnique({ where: { id: replyId } });
  if (!reply || reply.threadId !== threadId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const isOwn = reply.authorId === session.user.id;
  const isModerator = effectiveCoordinator(member, session.user.roles ?? []);
  if (!isOwn && !isModerator) {
    return Response.json({ error: "You can only delete your own replies" }, { status: 403 });
  }

  await db.hubConversationReply.delete({ where: { id: replyId } });
  return Response.json({ ok: true });
}
