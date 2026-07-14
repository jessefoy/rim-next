/**
 * /account/files/doc/[fileId] — read a Google Doc inside RIM.
 *
 * The calm read path (RIM_GoogleWorkspace.md): the server exports the doc as
 * HTML, strips it down to semantics + emphasis (lib/google/docHtml.ts), and
 * renders it in RIM's own typography — no Google account, no Google UI.
 * Editing opens the real Google editor via the gated open route.
 */

import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import AccountLayout from "@/components/AccountLayout";
import { canAccessFileDrive } from "@/lib/googleFiles";
import { GOOGLE_MIME, exportDocHtml, getFile } from "@/lib/google/drive";
import { googleDocHtmlToRimHtml } from "@/lib/google/docHtml";
import { relativeDate } from "@/lib/relativeDate";

export const dynamic = "force-dynamic";

export default async function GoogleDocReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ fileId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { fileId } = await params;
  const { from } = await searchParams;

  const file = await getFile(fileId).catch(() => null);
  if (!file) notFound();

  const allowed = await canAccessFileDrive(
    session.user.id,
    session.user.roles ?? [],
    file.driveId,
  );
  if (!allowed) notFound();

  // Only Google Docs read in-app; anything else goes to Google's own surface.
  if (file.mimeType !== GOOGLE_MIME.doc) redirect(`/api/files/open/${fileId}`);

  // Reader back-links only ever point inside the member area.
  const backHref = from && from.startsWith("/account/") ? from : "/account/files";

  let html: string | null = null;
  try {
    html = googleDocHtmlToRimHtml(await exportDocHtml(fileId));
  } catch (e) {
    console.error("[files-reader]", e instanceof Error ? e.message : e);
  }

  return (
    <AccountLayout>
      <div className="gf-reader">
        <a className="gf-reader__back" href={backHref}>
          &larr; Back to files
        </a>
        <header className="gf-reader__head">
          <h1 className="ac-page-title">{file.name}</h1>
          <p className="gf-reader__meta">
            {file.modifiedTime ? `Updated ${relativeDate(file.modifiedTime)}` : ""}
            {file.lastModifyingUser?.displayName
              ? ` · ${file.lastModifyingUser.displayName}`
              : ""}
          </p>
          <a
            className="btn"
            href={`/api/files/open/${fileId}`}
            target="_blank"
            rel="noopener"
          >
            Open in Google Docs
          </a>
        </header>
        {html !== null ? (
          <article
            className="rim-content gf-reader__doc"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="gf-status">
            We couldn&rsquo;t load this document right now. Please try again, or
            open it in Google Docs above.
          </p>
        )}
      </div>
    </AccountLayout>
  );
}
