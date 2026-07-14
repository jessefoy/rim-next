/**
 * /account/hub/[slug]/documents/[id] — View a native hub document
 *
 * Bear-inspired document presentation: clean white card on warm background,
 * Inter font, generous padding, no borders.
 *
 * Below the document card: a Conversations section for document-level threads.
 * A quiet stat link at the top of the card anchors to it when threads exist.
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import { canAccessDocument, canEditDocument } from "@/lib/documentAuth";
import { renderContentBodyAsync } from "@/lib/renderRichContentServer";
import Link from "next/link";
import HubDocConversationsClient from "@/components/HubDocConversationsClient";

export const dynamic = "force-dynamic";

export default async function HubDocumentViewPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || !canAccessHub(member, session.user.roles ?? [])) redirect("/account/dashboard");

  const doc = await db.hubDocument.findUnique({
    where: { id },
    include: {
      addedBy:    { select: { firstName: true, lastName: true, preferredName: true } },
      placements: { select: { hubId: true } },
    },
  });
  if (!doc) notFound();

  // The doc must live in THIS hub — its origin, or shared into it — AND the
  // viewer must be able to reach it (visibility-aware). This is the
  // canAccessHub → canAccessDocument shift for shared/community docs (§7).
  const viewerMemberships = await db.hubMember.findMany({
    where:  { userId: session.user.id },
    select: { hubId: true, isCoordinator: true, status: true },
  });
  const inThisHub = doc.hubId === hub.id || doc.placements.some((p) => p.hubId === hub.id);
  const canSee = canAccessDocument(doc, {
    userId: session.user.id,
    roles: session.user.roles ?? [],
    memberships: viewerMemberships,
  });
  if (!inThisHub || !canSee) notFound();

  const canEdit = canEditDocument(doc, {
    userId: session.user.id,
    roles: session.user.roles ?? [],
    memberships: viewerMemberships,
  }) && (!doc.isLocked || doc.addedById === session.user.id || (session.user.roles ?? []).some((role) => role === "ADMIN" || role === "GUIDING_TEACHER"));

  // Comments live with the document's ORIGIN hub. When this doc is only shared
  // INTO the current hub (origin is elsewhere, or it's hubless), the conversation
  // API rejects reads/writes scoped to this hub — so don't show a comments
  // affordance here that would dead-end. (RIM_Documents.md §7, origin-owns-lifecycle.)
  const isOriginHub = doc.hubId === hub.id;

  const bodyHtml = doc.body ? await renderContentBodyAsync(doc.body) : "";

  const addedByName =
    doc.addedBy.preferredName ||
    [doc.addedBy.firstName, doc.addedBy.lastName].filter(Boolean).join(" ");

  // Fetch document conversations and hub member list for the conversations panel
  const [convThreads, hubMemberRows, coordRows] = await Promise.all([
    db.hubConversationThread.findMany({
      where: { hubId: hub.id, documentId: id, deletedAt: null },
      include: {
        author: { select: { firstName: true, lastName: true, preferredName: true } },
        _count: { select: { replies: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.hubMember.findMany({
      where: { hubId: hub.id, status: "ACTIVE", communicationsEnabled: true },
      include: { user: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    }),
    db.hubMember.findMany({
      where: { hubId: hub.id, isCoordinator: true },
      select: { userId: true },
    }),
  ]);

  const threads = convThreads.map((t) => ({
    id:         t.id,
    title:      t.title,
    body:       t.body,
    authorId:   t.authorId,
    author:     { firstName: t.author.firstName, lastName: t.author.lastName, preferredName: t.author.preferredName },
    replyCount: t._count.replies,
    createdAt:  t.createdAt.toISOString(),
    updatedAt:  t.updatedAt.toISOString(),
  }));

  const hubMembers = hubMemberRows
    .filter((m) => m.userId !== session.user.id)
    .map((m) => ({
      id:            m.userId,
      firstName:     m.user.firstName,
      lastName:      m.user.lastName,
      preferredName: m.user.preferredName,
    }));

  const coordinatorIds = coordRows.map((r) => r.userId);

  return (
    <div className="doc-page">
      <div className="doc-page__nav">
        <Link href={`/account/hub/${slug}/documents`} className="doc-page__back">
          ← Documents
        </Link>
        {canEdit && doc.hubId === hub.id && (
          <Link href={`/account/hub/${slug}/documents/${id}/edit`} className="doc-page__edit-link">
            Edit
          </Link>
        )}
      </div>

      <div className="doc-page__card">
        <h1>{doc.label}</h1>
        <div className="doc-page__meta-row">
          <p className="doc-page__meta">
            {addedByName} ·{" "}
            {new Date(doc.updatedAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          {isOriginHub && (
            <a href="#doc-conversations" className="doc-page__conv-anchor">
              {threads.length > 0
                ? `${threads.length} comment${threads.length === 1 ? "" : "s"} ↓`
                : "Comments ↓"}
            </a>
          )}
        </div>
        <hr />

        {bodyHtml ? (
          <div
            className="doc-body rim-content rim-content--document"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : (
          <p className="doc-page__empty">
            No content yet.
          </p>
        )}
      </div>

      {doc.docKind === "NATIVE" && (
        <div className="doc-page__footer">
          <a href={`/api/documents/${id}/export?format=md`} download>↓ Download Markdown</a>
          <a href={`/api/documents/${id}/export?format=print`} target="_blank" rel="noreferrer">Print / Save as PDF</a>
        </div>
      )}

      {isOriginHub && (
        <HubDocConversationsClient
          hubSlug={slug}
          docId={id}
          initialThreads={threads}
          hubMembers={hubMembers}
          coordinatorIds={coordinatorIds}
          currentUserId={session.user.id}
        />
      )}
    </div>
  );
}
