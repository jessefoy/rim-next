/**
 * /account/hub/[slug]/documents/[id] — View a native hub document
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
    <div className="hdoc-view">
      <div className="hdoc-view__nav">
        <Link href={`/account/hub/${slug}/documents`} className="hdoc-view__back">
          ← Documents
        </Link>
        {isCoordinator && (
          <Link href={`/account/hub/${slug}/documents/${id}/edit`} className="hdoc-view__edit-link">
            Edit
          </Link>
        )}
      </div>

      <div className="hdoc-view__header">
        <h1 className="hdoc-view__title">{doc.label}</h1>
        <p className="hdoc-view__meta">
          {addedByName} ·{" "}
          {new Date(doc.updatedAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {bodyHtml ? (
        <div
          className="hdoc-view__body man-layout-single"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      ) : (
        <p className="hdoc-view__empty">No content yet.</p>
      )}

      <div className="hdoc-view__footer">
        <a
          href={`/api/hub/${slug}/documents/${id}/export`}
          className="hdoc-view__export"
          download
        >
          ↓ Download as Markdown
        </a>
      </div>
    </div>
  );
}
