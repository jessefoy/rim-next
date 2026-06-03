/**
 * /account/hub/[slug]/activity — Unified hub activity stream
 *
 * Shows everything that has happened in the hub: documents added/updated,
 * hub conversations, document conversations, and replies. One river,
 * newest first. Filter pills narrow to Documents, Conversations, or Mine.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import HubActivityClient from "@/components/HubActivityClient";

export const dynamic = "force-dynamic";

type ActivityItem =
  | { type: "document_added";   id: string; docId: string; docLabel: string; authorId: string; authorName: string; ts: string }
  | { type: "document_updated"; id: string; docId: string; docLabel: string; authorId: string; authorName: string; ts: string }
  | { type: "hub_thread";       id: string; threadId: string; threadTitle: string; authorId: string; authorName: string; ts: string }
  | { type: "hub_reply";        id: string; threadId: string; threadTitle: string; authorId: string; authorName: string; ts: string }
  | { type: "doc_thread";       id: string; threadId: string; threadTitle: string; docId: string; docLabel: string; authorId: string; authorName: string; ts: string }
  | { type: "doc_reply";        id: string; threadId: string; threadTitle: string; docId: string; docLabel: string; authorId: string; authorName: string; ts: string };

function personName(u: { firstName: string | null; lastName: string | null; preferredName: string | null }) {
  const first = u.preferredName || u.firstName;
  return [first, u.lastName].filter(Boolean).join(" ") || "Someone";
}

export default async function HubActivityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || !canAccessHub(member, session.user.roles ?? [])) redirect("/account/dashboard");

  const LIMIT = 30;

  const [docs, hubThreads, hubReplies, docThreads, docReplies] = await Promise.all([
    db.hubDocument.findMany({
      where: { hubId: hub.id, deletedAt: null },
      select: {
        id: true, label: true, addedById: true, createdAt: true, updatedAt: true,
        addedBy: { select: { firstName: true, lastName: true, preferredName: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: LIMIT,
    }),
    db.hubConversationThread.findMany({
      where: { hubId: hub.id, documentId: null, deletedAt: null },
      select: {
        id: true, title: true, authorId: true, createdAt: true,
        author: { select: { firstName: true, lastName: true, preferredName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
    db.hubConversationReply.findMany({
      where: { thread: { hubId: hub.id, documentId: null, deletedAt: null } },
      select: {
        id: true, authorId: true, createdAt: true,
        author: { select: { firstName: true, lastName: true, preferredName: true } },
        thread: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
    db.hubConversationThread.findMany({
      where: { hubId: hub.id, deletedAt: null, documentId: { not: null } },
      select: {
        id: true, title: true, authorId: true, documentId: true, createdAt: true,
        author:   { select: { firstName: true, lastName: true, preferredName: true } },
        document: { select: { label: true } },
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
    db.hubConversationReply.findMany({
      where: { thread: { hubId: hub.id, documentId: { not: null }, deletedAt: null } },
      select: {
        id: true, authorId: true, createdAt: true,
        author:  { select: { firstName: true, lastName: true, preferredName: true } },
        thread:  { select: { id: true, title: true, documentId: true, document: { select: { label: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
  ]);

  const items: ActivityItem[] = [];

  for (const doc of docs) {
    const isNew = Math.abs(doc.updatedAt.getTime() - doc.createdAt.getTime()) < 5000;
    items.push({
      type:       isNew ? "document_added" : "document_updated",
      id:         `doc-${doc.id}-${isNew ? "added" : "updated"}`,
      docId:      doc.id,
      docLabel:   doc.label,
      authorId:   doc.addedById,
      authorName: personName(doc.addedBy),
      ts:         doc.updatedAt.toISOString(),
    });
  }

  for (const t of hubThreads) {
    items.push({
      type: "hub_thread", id: `hub-thread-${t.id}`,
      threadId: t.id, threadTitle: t.title,
      authorId: t.authorId, authorName: personName(t.author),
      ts: t.createdAt.toISOString(),
    });
  }

  for (const r of hubReplies) {
    items.push({
      type: "hub_reply", id: `hub-reply-${r.id}`,
      threadId: r.thread.id, threadTitle: r.thread.title,
      authorId: r.authorId, authorName: personName(r.author),
      ts: r.createdAt.toISOString(),
    });
  }

  for (const t of docThreads) {
    items.push({
      type: "doc_thread", id: `doc-thread-${t.id}`,
      threadId: t.id, threadTitle: t.title,
      docId: t.documentId!, docLabel: t.document?.label ?? "Document",
      authorId: t.authorId, authorName: personName(t.author),
      ts: t.createdAt.toISOString(),
    });
  }

  for (const r of docReplies) {
    items.push({
      type: "doc_reply", id: `doc-reply-${r.id}`,
      threadId: r.thread.id, threadTitle: r.thread.title,
      docId: r.thread.documentId!, docLabel: r.thread.document?.label ?? "Document",
      authorId: r.authorId, authorName: personName(r.author),
      ts: r.createdAt.toISOString(),
    });
  }

  items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const initialItems = items.slice(0, LIMIT);

  return (
    <HubActivityClient
      hubSlug={slug}
      currentUserId={session.user.id}
      initialItems={initialItems}
    />
  );
}
