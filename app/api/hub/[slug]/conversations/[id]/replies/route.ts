import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership } from "@/lib/hubAuth";
import { sendHubConvNewReplyEmail } from "@/lib/email";

// POST /api/hub/[slug]/conversations/[id]/replies — add reply (any member)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!member && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const thread = await db.hubConversationThread.findUnique({
    where: { id },
    include: {
      replies: { select: { authorId: true } },
    },
  });
  if (!thread || thread.hubId !== hub.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (thread.status !== "OPEN") {
    return NextResponse.json({ error: "Thread is closed" }, { status: 400 });
  }

  const { body } = await req.json();
  if (!body) {
    return NextResponse.json({ error: "Body required" }, { status: 400 });
  }

  const reply = await db.hubConversationReply.create({
    data: {
      threadId: id,
      authorId: session.user.id,
      body,
    },
    include: {
      author: { select: { firstName: true, lastName: true, preferredName: true } },
    },
  });

  // Fire-and-forget: notify thread author + prior repliers (deduped, excluding poster)
  const replierName = session.user.name || session.user.email?.split("@")[0] || "Someone";
  const participantIds = new Set<string>();
  participantIds.add(thread.authorId);
  for (const r of thread.replies) participantIds.add(r.authorId);
  participantIds.delete(session.user.id); // don't notify the poster

  if (participantIds.size > 0) {
    db.user.findMany({
      where: { id: { in: [...participantIds] } },
      select: { id: true, email: true, firstName: true },
    }).then((users) => {
      for (const u of users) {
        if (u.email) {
          sendHubConvNewReplyEmail({
            to: u.email,
            firstName: u.firstName,
            replierName,
            hubName: hub.name,
            hubSlug: slug,
            threadTitle: thread.title,
            threadId: thread.id,
          }).catch(() => {});
        }
      }
    }).catch(() => {});
  }

  return NextResponse.json(reply, { status: 201 });
}
