import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  sendNewReplyEmail,
  type NewReplyEmailData,
} from "@/lib/email";

function hasHubAccess(roles: string[]) {
  return roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
}

// POST /api/host/threads/[id]/replies — add a reply
// Body: { body }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasHubAccess(session.user.roles ?? [])) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: threadId } = await params;
  const reqBody = await request.json().catch(() => null);
  const { body: replyBody } = (reqBody ?? {}) as { body?: any };

  if (!replyBody) {
    return Response.json({ error: "Reply body is required" }, { status: 400 });
  }

  const thread = await db.hostThread.findUnique({
    where: { id: threadId },
    select: { id: true, title: true, status: true, authorId: true },
  });
  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }
  if (thread.status !== "OPEN") {
    return Response.json({ error: "This thread is closed" }, { status: 409 });
  }

  const reply = await db.hostReply.create({
    data: {
      threadId,
      authorId: session.user.id,
      body: replyBody,
    },
  });

  // Bump thread updatedAt so it floats to top
  await db.hostThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  });

  // Notify: thread author + all prior repliers (deduplicated, exclude current replier)
  void (async () => {
    try {
      const replier = await db.user.findUnique({
        where: { id: session.user.id },
        select: { firstName: true, lastName: true, email: true },
      });
      const replierName =
        [replier?.firstName, replier?.lastName].filter(Boolean).join(" ") ||
        replier?.email ||
        "Someone";

      // Collect notification targets: thread author + everyone who has replied (not current replier)
      const priorReplierIds = await db.hostReply.findMany({
        where: {
          threadId,
          NOT: { authorId: session.user.id },
          id: { not: reply.id }, // exclude this brand-new reply
        },
        select: { authorId: true },
        distinct: ["authorId"],
      });

      const targetIds = [
        ...new Set([
          thread.authorId,
          ...priorReplierIds.map((r) => r.authorId),
        ]),
      ].filter((uid) => uid !== session.user.id);

      if (targetIds.length === 0) return;

      const targets = await db.user.findMany({
        where: { id: { in: targetIds }, archivedAt: null },
        select: { id: true, email: true, firstName: true },
      });

      await db.alert.createMany({
        data: targets.map((u) => ({
          userId: u.id,
          type: "NEW_REPLY" as const,
          message: `${replierName} replied to "${thread.title}"`,
          linkUrl: `/account/hub/host-team/conversations/${threadId}`,
        })),
        skipDuplicates: true,
      });

      await Promise.all(
        targets.map((u) =>
          sendNewReplyEmail({
            to: u.email,
            firstName: u.firstName,
            replierName,
            threadTitle: thread.title,
            threadId,
          } as NewReplyEmailData)
        )
      );
    } catch (e) {
      console.error("[replies] notification error:", e);
    }
  })();

  return Response.json({ id: reply.id, ok: true }, { status: 201 });
}
