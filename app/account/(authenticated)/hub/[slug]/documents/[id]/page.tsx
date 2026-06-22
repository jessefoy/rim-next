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
import { canAccessHub, getHubMembership, effectiveCoordinator } from "@/lib/hubAuth";
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
    include: { addedBy: { select: { firstName: true, lastName: true, preferredName: true } } },
  });
  if (!doc || doc.hubId !== hub.id) notFound();

  const isCoordinator = effectiveCoordinator(member, session.user.roles ?? []);

  // Office docs (OnlyOffice) carry no native `body` — their content lives in the
  // full-screen editor. This page becomes the doc's home: metadata + the
  // conversation thread + an "Open in editor" CTA, instead of native body.
  const isOffice = doc.docKind === "ONLYOFFICE";
  const officeKindLabel =
    doc.fileType === "SHEET" ? "Spreadsheet"
    : doc.fileType === "SLIDE" ? "Presentation"
    : "Document";
  const bodyHtml = !isOffice && doc.body ? await renderContentBodyAsync(doc.body) : "";

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
        {isCoordinator && !isOffice && (
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
          <a href="#doc-conversations" className="doc-page__conv-anchor">
            {threads.length > 0
              ? `${threads.length} conversation${threads.length === 1 ? "" : "s"} ↓`
              : "Conversations ↓"}
          </a>
        </div>
        <hr />

        {isOffice ? (
          <div className="doc-page__office">
            <span className="doc-page__office-kind">{officeKindLabel}</span>
            <a href={`/account/documents/${id}/office`} className="btn doc-page__office-open">
              Open in editor →
            </a>
            <p className="doc-page__office-hint">
              Co-editing, comments, version history, and real pages — opens full-screen.
            </p>
          </div>
        ) : bodyHtml ? (
          <div
            className="doc-body rim-content rim-content--document"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : (
          <p style={{ fontFamily: "var(--font-doc)", fontSize: 14, color: "var(--rim-text-muted)", fontStyle: "italic" }}>
            No content yet.
          </p>
        )}
      </div>

      {!isOffice && (
        <div className="doc-page__footer">
          <a href={`/api/hub/${slug}/documents/${id}/export`} download>
            ↓ Download as Markdown
          </a>
        </div>
      )}

      <HubDocConversationsClient
        hubSlug={slug}
        docId={id}
        initialThreads={threads}
        hubMembers={hubMembers}
        coordinatorIds={coordinatorIds}
        currentUserId={session.user.id}
      />
    </div>
  );
}
