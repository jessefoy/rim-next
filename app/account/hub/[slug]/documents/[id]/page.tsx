/**
 * /account/hub/[slug]/documents/[id] — View a native hub document
 *
 * Bear-inspired document presentation: clean white card on warm background,
 * Inter font, generous padding, no borders.
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import { renderContentBodyAsync } from "@/lib/renderRichContentServer";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HubDocumentViewPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!member && !isAdmin)) redirect("/account/dashboard");

  const doc = await db.hubDocument.findUnique({
    where: { id },
    include: { addedBy: { select: { firstName: true, lastName: true, preferredName: true } } },
  });
  if (!doc || doc.hubId !== hub.id) notFound();

  const isCoordinator = (member?.isCoordinator ?? false) || isAdmin;
  const bodyHtml = doc.body ? await renderContentBodyAsync(doc.body) : "";

  const addedByName =
    doc.addedBy.preferredName ||
    [doc.addedBy.firstName, doc.addedBy.lastName].filter(Boolean).join(" ");

  return (
    <div className="doc-page">
      <div className="doc-page__nav">
        <Link href={`/account/hub/${slug}/documents`} className="doc-page__back">
          ← Documents
        </Link>
        {isCoordinator && (
          <Link href={`/account/hub/${slug}/documents/${id}/edit`} className="doc-page__edit-link">
            Edit
          </Link>
        )}
      </div>

      <div className="doc-page__card">
        <h1>{doc.label}</h1>
        <p className="doc-page__meta">
          {addedByName} ·{" "}
          {new Date(doc.updatedAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        <hr />

        {bodyHtml ? (
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

      <div className="doc-page__footer">
        <a
          href={`/api/hub/${slug}/documents/${id}/export`}
          download
        >
          ↓ Download as Markdown
        </a>
      </div>
    </div>
  );
}
