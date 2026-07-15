import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import { sendHubConvNewReplyEmail } from "@/lib/email";

// POST /api/hub/[slug]/conversations/[id]/replies — add reply (any member)
//
// Notification model: every current subscriber of the thread is emailed.
// The replier itself is auto-subscribed if not already (subscribe-by-replying).
// Optional notifyUserIds: members to add as new subscribers on this reply —
// they receive this reply email and every future one.
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
  if ((!hub?.conversationsEnabled || !canAccessHub(member, session.user.roles ?? [], hub?.openToAllMembers))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const thread = await db.hubConversationThread.findUnique({ where: { id } });
  if (!thread || thread.hubId !== hub.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Block replies on archived or trashed threads. archivedAt is the canonical
  // archive marker (session 115); status is kept in sync but no longer the
  // source of truth.
  if (thread.archivedAt || thread.deletedAt) {
    return NextResponse.json({ error: "Thread is closed" }, { status: 400 });
  }

  const { body, notifyUserIds } = await req.json();
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

  // Auto-subscribe the replier (subscribe-by-replying), then add anyone
  // explicitly picked in the "Also notify" panel.
  const newSubs: Array<{ threadId: string; userId: string; source: string }> = [
    { threadId: id, userId: session.user.id, source: "ADDED" },
  ];
  const pickedIds: string[] = Array.isArray(notifyUserIds) ? notifyUserIds : [];
  const seen = new Set<string>([session.user.id]);
  for (const uid of pickedIds) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    newSubs.push({ threadId: id, userId: uid, source: "ADDED" });
  }
  await db.hubThreadSubscription.createMany({ data: newSubs, skipDuplicates: true });

  // Email every current subscriber except the replier.
  const replierName = session.user.name || session.user.email?.split("@")[0] || "Someone";
  const threadTitle = thread.title;
  const threadId = thread.id;
  const hubName = hub.name;
  const replierId = session.user.id;

  after(async () => {
    const subs = await db.hubThreadSubscription.findMany({
      where:  { threadId, userId: { not: replierId } },
      select: { userId: true },
    });
    if (subs.length === 0) return;

    // Filter to active hub members with communicationsEnabled.
    const eligible = await db.hubMember.findMany({
      where: {
        hubId:                 hub.id,
        userId:                { in: subs.map((s) => s.userId) },
        status:                "ACTIVE",
        communicationsEnabled: true,
      },
      include: { user: { select: { email: true, firstName: true } } },
    });

    await Promise.allSettled(
      eligible
        .filter((m) => m.user.email)
        .map((m) =>
          sendHubConvNewReplyEmail({
            to: m.user.email!,
            firstName: m.user.firstName,
            replierName,
            hubName,
            hubSlug: slug,
            threadTitle,
            threadId,
          })
        )
    );
  });

  return NextResponse.json(reply, { status: 201 });
}
