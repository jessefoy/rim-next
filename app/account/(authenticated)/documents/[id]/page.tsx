/**
 * /account/documents/[id] — hub-agnostic document viewer.
 *
 * The directory's destination for docs reached outside the viewer's hubs
 * (Community) or with no hub at all (Projects). Gated by the pure
 * canUserAccessDocument — no hub context required. Office docs route to the
 * full-screen editor; native docs render read-only; link/file docs offer the
 * file. Per-hub comments live on the hub doc-view page, not here.
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canUserAccessDocument } from "@/lib/documentAuth";
import { renderContentBodyAsync } from "@/lib/renderRichContentServer";
import Link from "next/link";
import AccountLayout from "@/components/AccountLayout";

export const dynamic = "force-dynamic";

export default async function DocumentReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const access = await canUserAccessDocument(id, session.user.id, session.user.roles ?? []);
  if (!access) notFound(); // null (missing) or false (forbidden) — either way, 404

  const doc = await db.hubDocument.findUnique({
    where: { id },
    include: { addedBy: { select: { firstName: true, lastName: true, preferredName: true } } },
  });
  if (!doc) notFound();

  const isOffice   = doc.docKind === "ONLYOFFICE";
  const isExternal = doc.docKind === "LINK" || doc.docKind === "UPLOAD";
  const officeKindLabel =
    doc.fileType === "SHEET" ? "Spreadsheet" : doc.fileType === "SLIDE" ? "Presentation" : "Document";
  const bodyHtml = !isOffice && !isExternal && doc.body ? await renderContentBodyAsync(doc.body) : "";

  const addedByName =
    doc.addedBy.preferredName ||
    [doc.addedBy.firstName, doc.addedBy.lastName].filter(Boolean).join(" ");

  return (
    <AccountLayout>
      <div className="doc-page">
      <div className="doc-page__nav">
        <Link href="/account/documents" className="doc-page__back">← Documents</Link>
      </div>

      <div className="doc-page__card">
        <h1>{doc.label}</h1>
        <p className="doc-page__meta">
          {addedByName} ·{" "}
          {new Date(doc.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
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
        ) : isExternal && doc.url ? (
          <div className="doc-page__office">
            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="btn doc-page__office-open">
              Open {doc.fileType === "PDF" ? "file" : "link"} →
            </a>
          </div>
        ) : bodyHtml ? (
          <div className="doc-body rim-content rim-content--document" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        ) : (
          <p style={{ fontFamily: "var(--font-doc)", fontSize: 14, color: "var(--rim-text-muted)", fontStyle: "italic" }}>
            No content yet.
          </p>
        )}
      </div>
      </div>
    </AccountLayout>
  );
}
