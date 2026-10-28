import "server-only";
import { after } from "next/server";
import { db } from "@/lib/db";
import type { SaveActor, SaveReply } from "@/lib/programSave";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import { sendHubConvNewThreadEmail, sendHubConvNewReplyEmail, sendEachPaced } from "@/lib/email";
import { excerptOf } from "@/lib/notifications";

/**
 * A team's Conversations (2026-10-28): starting one and replying, moved here
 * from their routes unchanged so the RIM Guide posts through the same steps
 * (lib/guideSchedule.ts). Each checks the team's access as before.
 */

/** Who is posting: their id, roles, and the name and email the posts and emails use. */
export type TeamActor = SaveActor & { name?: string | null; email?: string | null };

const answer = (payload: unknown, init?: { status?: number }): SaveReply => ({
  status: init?.status ?? 200,
  body: payload as Record<string, unknown>,
});

/** POST /api/hub/[slug]/conversations: start a conversation. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function startConversation(actor: TeamActor, slug: string, input: any): Promise<SaveReply> {
  const { hub, member } = await getHubMembership(slug, actor.id);
  if (!hub) return answer({ error: "Not found" }, { status: 404 });
  const isAdmin = actor.roles.includes("ADMIN");
  if ((!hub?.conversationsEnabled || !canAccessHub(member, [...actor.roles]))) return answer({ error: "Forbidden" }, { status: 403 });

  const { title, body, category, notifyUserIds } = input;
  if (!title?.trim() || !body) {
    return answer({ error: "Title and body required" }, { status: 400 });
  }

  const thread = await db.hubConversationThread.create({
    data: {
      hubId:    hub.id,
      authorId: actor.id,
      title:    title.trim(),
      body,
      category: category || "General",
      status:   "OPEN",
    },
    include: {
      author: { select: { firstName: true, lastName: true, preferredName: true } },
      _count:  { select: { replies: true } },
    },
  });

  // Seed subscriptions: author (always), all coordinators of this hub, and
  // any members the author explicitly picked in the "Also notify" panel.
  // The author is the source of truth for *initial* subscribers; once threaded,
  // anyone can be added via reply pickers or self-subscribe.
  const coords = await db.hubMember.findMany({
    where:  { hubId: hub.id, isCoordinator: true, status: "ACTIVE" },
    select: { userId: true },
  });
  const pickedIds: string[] = Array.isArray(notifyUserIds) ? notifyUserIds : [];

  const subRows: Array<{ threadId: string; userId: string; source: string }> = [
    { threadId: thread.id, userId: actor.id, source: "AUTHOR" },
  ];
  const seen = new Set<string>([actor.id]);
  for (const c of coords) {
    if (seen.has(c.userId)) continue;
    seen.add(c.userId);
    subRows.push({ threadId: thread.id, userId: c.userId, source: "COORDINATOR_AUTO" });
  }
  for (const uid of pickedIds) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    subRows.push({ threadId: thread.id, userId: uid, source: "ADDED" });
  }
  await db.hubThreadSubscription.createMany({ data: subRows, skipDuplicates: true });

  // Email everyone subscribed (except the author) who's an active hub member
  // with communicationsEnabled. Use after() for fire-and-forget reliability —
  // the .then() pattern from before could be dropped by Vercel teardown.
  const recipientIds = subRows.filter((r) => r.userId !== actor.id).map((r) => r.userId);
  const authorName = actor.name || actor.email?.split("@")[0] || "Someone";
  const threadTitle = title.trim();
  const hubName = hub.name;

  after(async () => {
    if (recipientIds.length === 0) return;
    const eligible = await db.hubMember.findMany({
      where: {
        hubId:                 hub.id,
        userId:                { in: recipientIds },
        status:                "ACTIVE",
        // Team emails switched off still get the notice (2026-10-20).
        // An archived account isn't emailed about a team it can't sign in to
        // (2026-10-19 audit; archiving leaves team memberships as they were).
        user:                  { archivedAt: null },
      },
      include: { user: { select: { email: true, firstName: true } } },
    });
    await sendEachPaced(
      eligible.filter((m) => m.user.email),
      (m) =>
        sendHubConvNewThreadEmail({
            to: m.user.email!,
            firstName: m.user.firstName,
            authorName,
            hubName,
            hubSlug: slug,
            threadTitle,
            threadId: thread.id,
            excerpt: excerptOf(body),
            noticeOnly: !m.communicationsEnabled,
        }),
      "hub-conv-new-thread",
    );
  });

  return answer(thread, { status: 201 });
}

/** POST /api/hub/[slug]/conversations/[id]/replies: reply to one. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function replyToConversation(actor: TeamActor, slug: string, id: string, input: any): Promise<SaveReply> {
  const { hub, member } = await getHubMembership(slug, actor.id);
  if (!hub) return answer({ error: "Not found" }, { status: 404 });
  const isAdmin = actor.roles.includes("ADMIN");
  if ((!hub?.conversationsEnabled || !canAccessHub(member, [...actor.roles]))) return answer({ error: "Forbidden" }, { status: 403 });

  const thread = await db.hubConversationThread.findUnique({ where: { id } });
  if (!thread || thread.hubId !== hub.id) {
    return answer({ error: "Not found" }, { status: 404 });
  }
  // Block replies on archived or trashed threads. archivedAt is the canonical
  // archive marker (session 115); status is kept in sync but no longer the
  // source of truth.
  if (thread.archivedAt || thread.deletedAt) {
    return answer({ error: "Thread is closed" }, { status: 400 });
  }

  const { body, notifyUserIds } = input;
  if (!body) {
    return answer({ error: "Body required" }, { status: 400 });
  }

  const reply = await db.hubConversationReply.create({
    data: {
      threadId: id,
      authorId: actor.id,
      body,
    },
    include: {
      author: { select: { firstName: true, lastName: true, preferredName: true } },
    },
  });

  // Auto-subscribe the replier (subscribe-by-replying), then add anyone
  // explicitly picked in the "Also notify" panel.
  const newSubs: Array<{ threadId: string; userId: string; source: string }> = [
    { threadId: id, userId: actor.id, source: "ADDED" },
  ];
  const pickedIds: string[] = Array.isArray(notifyUserIds) ? notifyUserIds : [];
  const seen = new Set<string>([actor.id]);
  for (const uid of pickedIds) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    newSubs.push({ threadId: id, userId: uid, source: "ADDED" });
  }
  await db.hubThreadSubscription.createMany({ data: newSubs, skipDuplicates: true });

  // Email every current subscriber except the replier.
  const replierName = actor.name || actor.email?.split("@")[0] || "Someone";
  const threadTitle = thread.title;
  const threadId = thread.id;
  const hubName = hub.name;
  const replierId = actor.id;

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
        // Team emails switched off still get the notice (2026-10-20).
        // An archived account isn't emailed about a team it can't sign in to
        // (2026-10-19 audit; archiving leaves team memberships as they were).
        user:                  { archivedAt: null },
      },
      include: { user: { select: { email: true, firstName: true } } },
    });

    await sendEachPaced(
      eligible.filter((m) => m.user.email),
      (m) =>
        sendHubConvNewReplyEmail({
            to: m.user.email!,
            firstName: m.user.firstName,
            replierName,
            hubName,
            hubSlug: slug,
            threadTitle,
            threadId,
            replyId: reply.id,
            excerpt: excerptOf(body),
            noticeOnly: !m.communicationsEnabled,
        }),
      "hub-conv-new-reply",
    );
  });

  return answer(reply, { status: 201 });
}
