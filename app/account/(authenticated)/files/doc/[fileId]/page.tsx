/**
 * /account/files/doc/[fileId] — read a Google Doc inside RIM.
 *
 * The calm read path (RIM_GoogleWorkspace.md): the server exports the doc as
 * HTML, strips it down to semantics + emphasis (lib/google/docHtml.ts), and
 * renders it in RIM's own typography on a white writing surface — no Google
 * account, no Google UI. Editing opens the real Google editor via the gated
 * open route.
 */

import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import AccountLayout from "@/components/AccountLayout";
import { filesViewer, getAccessiblePlaces, resolvePlaceForFile } from "@/lib/googleFiles";
import { GOOGLE_MIME, exportDocHtml, getFileOrNull } from "@/lib/google/drive";
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
  // Gate on the page itself, not just the (authenticated) layout: layouts
  // don't re-run on soft navigation, so an archived-mid-session member could
  // otherwise soft-navigate into a doc (reviewer, session 163).
  const viewer = filesViewer(await auth());
  if (!viewer) redirect("/login");
  const { fileId } = await params;
  const { from } = await searchParams;

  // Distinguish "deleted / not mine" (notFound) from "Drive briefly down"
  // (a graceful try-again). notFound() is called OUTSIDE the try so its
  // control-flow throw isn't swallowed as a load error.
  let loadFailed = false;
  let file: Awaited<ReturnType<typeof getFileOrNull>> = null;
  let accessible = false;
  try {
    const [f, places] = await Promise.all([
      getFileOrNull(fileId),
      getAccessiblePlaces(viewer.userId, viewer.roles),
    ]);
    file = f;
    // Subtree-aware (not a bare driveId match): on a shared Drive the doc must
    // live inside a Space the viewer can actually reach.
    accessible = Boolean(f && (await resolvePlaceForFile(places, f)));
  } catch {
    loadFailed = true;
  }

  if (!loadFailed) {
    if (!file || !accessible) notFound();
    // Only Google Docs read in-app; anything else goes to Google's own surface.
    if (file.mimeType !== GOOGLE_MIME.doc) redirect(`/api/files/open/${fileId}`);
  }

  // Reader back-links only ever point inside the member area.
  const backHref = from && from.startsWith("/account/") ? from : "/account/files";

  let html: string | null = null;
  if (!loadFailed && file) {
    try {
      html = googleDocHtmlToRimHtml(await exportDocHtml(fileId));
    } catch (e) {
      console.error("[files-reader]", e instanceof Error ? e.message : e);
    }
  }

  return (
    <AccountLayout>
      <div className="gf-reader">
        <a className="gf-reader__back" href={backHref}>
          &larr; Back to files
        </a>
        <header className="gf-reader__head">
          <h1 className="ac-page-title">{file?.name ?? "Document"}</h1>
          {file && (
            <p className="gf-reader__meta">
              {file.modifiedTime ? `Updated ${relativeDate(file.modifiedTime)}` : ""}
              {file.lastModifyingUser?.displayName
                ? ` · ${file.lastModifyingUser.displayName}`
                : ""}
            </p>
          )}
          {file && (
            <a
              className="btn"
              href={`/api/files/open/${fileId}`}
              target="_blank"
              rel="noopener"
            >
              Open in Google Docs
            </a>
          )}
        </header>
        {html !== null ? (
          <article
            className="rim-content gf-reader__doc"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="gf-status">
            We couldn&rsquo;t load this document right now. Please try again
            {file ? ", or open it in Google Docs above." : "."}
          </p>
        )}
      </div>
    </AccountLayout>
  );
}
