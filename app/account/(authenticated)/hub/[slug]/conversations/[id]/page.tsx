/**
 * /account/hub/[slug]/conversations/[id] — Thread detail
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessHub, getHubMembership, canManageTrash } from "@/lib/hubAuth";
import HubConvThreadClient from "@/components/HubConvThreadClient";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";

export const dynamic = "force-dynamic";

/**
 * Reactions on HubConversationReply.reactions can be in two shapes:
 *   - New (per-user):  { "🙏": ["userId1", "userId2"], "❤️": ["userId3"] }
 *   - Legacy (count):  { "🙏": 3, "❤️": 1 }
 *
 * The legacy shape predates per-user tracking. We normalize to the new
 * shape on read so the client always gets a Record<emoji, userId[]>. Legacy
 * counts can't be migrated (no user info to assign), so they become empty
 * arrays — the lost counts are a one-time cost paid by the legacy shape.
 */
function normalizeReactions(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  const out: Record<string, string[]> = {};
  for (const [emoji, val] of Object.entries(raw)) {
    if (Array.isArray(val)) {
      out[emoji] = val.filter((v): v is string => typeof v === "string");
    } else if (typeof val === "number" && val > 0) {
      out[emoji] = [];
    }
  }
  return out;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { id } = await params;
  const thread = await db.hubConversationThread.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: thread?.title ?? "Conversation" };
}

export default async function HubConvThreadPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!hub?.conversationsEnabled || !canAccessHub(member, session.user.roles ?? []))) redirect("/account/dashboard");

  const thread = await db.hubConversationThread.findUnique({
    where: { id },
    include: {
      author:   { select: { firstName: true, lastName: true, preferredName: true } },
      replies: {
        include: {
          author: { select: { firstName: true, lastName: true, preferredName: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!thread || thread.hubId !== hub.id) notFound();

  const isCoordinator =
    member?.isCoordinator || (session.user.roles ?? []).includes("ADMIN");

  // Trashed threads: 404 for non-managers (they shouldn't even know it exists).
  // Managers can still view via the Trash page; this page redirects them there.
  if (thread.deletedAt) {
    if (!canManageTrash(session.user.roles ?? [], member?.isCoordinator ?? false)) {
      notFound();
    }
    redirect(`/account/hub/${slug}/trash`);
  }

  const serialized = {
    id:           thread.id,
    title:    thread.title,
    body:     thread.body,
    bodyHtml: await renderFormattedTextAsync(thread.body),
    status:   thread.status,
    isPinned: thread.isPinned,
    edited:   thread.edited,
    editedAt: thread.editedAt?.toISOString() ?? null,
    authorId: thread.authorId,
    author: {
      firstName:     thread.author.firstName,
      lastName:      thread.author.lastName,
      preferredName: thread.author.preferredName,
    },
    replies: await Promise.all(thread.replies.map(async (r) => ({
      id:        r.id,
      body:      r.body,
      bodyHtml:  await renderFormattedTextAsync(r.body),
      authorId:  r.authorId,
      author: {
        firstName:     r.author.firstName,
        lastName:      r.author.lastName,
        preferredName: r.author.preferredName,
      },
      edited:    r.edited,
      editedAt:  r.editedAt?.toISOString() ?? null,
      // Reactions: normalize legacy count shape ({emoji: 3}) to user-array
      // shape ({emoji: ["uid1", "uid2", ...]}). Legacy counts are dropped —
      // they had no user info, so toggle behavior couldn't honor them.
      reactions: normalizeReactions(r.reactions),
      createdAt: r.createdAt.toISOString(),
    }))),
    createdAt: thread.createdAt.toISOString(),
  };

  const [currentUser, hubMemberRows, subRows] = await Promise.all([
    db.user.findUnique({
      where:  { id: session.user.id },
      select: { firstName: true, lastName: true, preferredName: true },
    }),
    db.hubMember.findMany({
      where: {
        hubId:                 hub.id,
        status:                "ACTIVE",
        communicationsEnabled: true,
        userId:                { not: session.user.id },
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    }),
    db.hubThreadSubscription.findMany({
      where:  { threadId: id },
      select: { userId: true, source: true, subscribedAt: true },
      orderBy: { subscribedAt: "asc" },
    }),
  ]);

  const serializedMembers = hubMemberRows.map((m) => ({
    id:            m.userId,
    firstName:     m.user.firstName,
    lastName:      m.user.lastName,
    preferredName: m.user.preferredName,
  }));

  const subscriptions = subRows.map((s) => ({
    userId:       s.userId,
    source:       s.source,
    subscribedAt: s.subscribedAt.toISOString(),
  }));
  const currentUserSubscribed = subRows.some((s) => s.userId === session.user.id);

  return (
    <HubConvThreadClient
      hubSlug={slug}
      initialThread={serialized}
      isCoordinator={isCoordinator}
      currentUserId={session.user.id}
      currentUser={{
        firstName:     currentUser?.firstName ?? null,
        lastName:      currentUser?.lastName ?? null,
        preferredName: currentUser?.preferredName ?? null,
      }}
      hubMembers={serializedMembers}
      initialSubscriptions={subscriptions}
      initialCurrentUserSubscribed={currentUserSubscribed}
    />
  );
}
