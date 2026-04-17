/**
 * /account/hub/[slug]/conversations/[id] — Thread detail
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import HubConvThreadClient from "@/components/HubConvThreadClient";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";

export const dynamic = "force-dynamic";

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

  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!member && !isAdmin)) redirect("/account/dashboard");

  const thread = await db.hubConversationThread.findUnique({
    where: { id },
    include: {
      author: { select: { firstName: true, lastName: true, preferredName: true } },
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

  const serialized = {
    id:       thread.id,
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
      reactions: (r.reactions as Record<string, number>) ?? {},
      createdAt: r.createdAt.toISOString(),
    }))),
    createdAt: thread.createdAt.toISOString(),
  };

  const userName =
    session.user.name ||
    session.user.email?.split("@")[0] ||
    "";

  return (
    <HubConvThreadClient
      hubSlug={slug}
      initialThread={serialized}
      isCoordinator={isCoordinator}
      currentUserId={session.user.id}
      currentUserName={userName}
    />
  );
}
