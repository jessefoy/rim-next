/**
 * /account/files/[fileId] — the file detail page (RIM_GoogleWorkspace.md,
 * file-detail slice). Every file (except folders, which drill down in the
 * Finder) opens here: one calm home where you read/preview it, see who created
 * it, manage its draft state, and — Slice 3 — talk about it.
 *
 * Rendering is fidelity-aware (the fork Jesse chose: exact-when-shared,
 * calm-when-draft):
 *   - a SHARED Google Doc/Sheet/Slides embeds Google's own pixel-perfect
 *     `/preview` (a reader link is minted just-in-time — the accepted
 *     link-as-key trade, lighter than the editor link "Open in Google" mints);
 *   - a DRAFT Google Doc reads through RIM's calm HTML export (no link minted,
 *     so the draft stays genuinely private on Google's side too);
 *   - PDFs / images / audio / video embed off RIM's own stream route (no
 *     Google exposure, already pixel-perfect);
 *   - a draft Sheet/Slides (no clean export) or an unusual type shows a quiet
 *     "open in Google" / "download" panel.
 *
 * The gate is authorizeFileRead — place access AND the draft gate (a held file
 * 404s for anyone but its creator or a moderator), run on the page itself
 * because layouts don't re-run on soft navigation.
 *
 * CSS prefix: gf-detail-
 */

import { auth } from "@/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import AccountLayout from "@/components/AccountLayout";
import FileDetailActions from "@/components/FileDetailActions";
import { db } from "@/lib/db";
import {
  authorizeFileRead,
  canManageFileMeta,
  logFileAction,
} from "@/lib/googleFiles";
import { sessionDisplayName } from "@/lib/sessionIdentity";
import { ensureAnyoneWithLink, exportDocHtml, getAnyonePermission } from "@/lib/google/drive";
import { GOOGLE_MIME, googlePreviewUrl, isGoogleEditorMime } from "@/lib/google/mime";
import { googleDocHtmlToRimHtml } from "@/lib/google/docHtml";
import { relativeDate } from "@/lib/relativeDate";

export const dynamic = "force-dynamic";

/** Human file-kind label + (for Google-native) the editor name. */
function classify(mime: string): { label: string; editorName: string; isEditor: boolean } {
  if (mime === GOOGLE_MIME.doc) return { label: "Google Doc", editorName: "Docs", isEditor: true };
  if (mime === GOOGLE_MIME.sheet) return { label: "Spreadsheet", editorName: "Sheets", isEditor: true };
  if (mime === GOOGLE_MIME.slides) return { label: "Presentation", editorName: "Slides", isEditor: true };
  if (mime === "application/pdf") return { label: "PDF", editorName: "", isEditor: false };
  if (mime.startsWith("image/")) return { label: "Image", editorName: "", isEditor: false };
  if (mime.startsWith("audio/")) return { label: "Audio", editorName: "", isEditor: false };
  if (mime.startsWith("video/")) return { label: "Video", editorName: "", isEditor: false };
  // Other Google-native types (Forms, Drawings, Jamboard…) — no in-RIM render
  // and the stream route refuses them, so they always open in Google.
  if (mime.startsWith("application/vnd.google-apps")) {
    return { label: "Google file", editorName: "", isEditor: true };
  }
  return { label: "File", editorName: "", isEditor: false };
}

export default async function FileDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ fileId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await auth();
  const { fileId } = await params;
  const { from } = await searchParams;

  // Distinguish a genuine denial (notFound/redirect) from a transient Drive
  // blip (graceful "try again"). getFile can throw inside authorizeFileRead.
  let loadFailed = false;
  let gate: Awaited<ReturnType<typeof authorizeFileRead>> | null = null;
  try {
    gate = await authorizeFileRead(session, fileId);
  } catch {
    loadFailed = true;
  }

  const backHref = from && from.startsWith("/account/") ? from : "/account/dashboard";

  // Control-flow throws (redirect/notFound) live outside the try above.
  if (gate && !gate.ok) {
    if (gate.status === 401) redirect("/login");
    notFound();
  }

  if (loadFailed || !gate || !gate.ok) {
    return (
      <AccountLayout>
        <div className="gf-detail">
          <a className="gf-detail__back" href={backHref}>
            &larr; Back to files
          </a>
          <p className="gf-status">We couldn&rsquo;t load this file right now. Please try again.</p>
        </div>
      </AccountLayout>
    );
  }

  const { viewer, file, place, meta } = gate.data;

  // Folders have no detail page — send them back to the Finder, opened to that
  // folder. (The Finder itself drills down; this is the direct-URL fallback.)
  if (file.mimeType === GOOGLE_MIME.folder) {
    redirect(
      place.hubSlug
        ? `/account/hub/${place.hubSlug}/files?folder=${encodeURIComponent(fileId)}`
        : "/account/dashboard",
    );
  }

  const mime = file.mimeType;
  const { label: kindLabel, editorName, isEditor } = classify(mime);
  const held = !!meta?.heldAt;
  const mine = !!meta?.creatorUserId && meta.creatorUserId === viewer.userId;
  const createdByUserId = meta?.creatorUserId ?? null;
  const canManage = await canManageFileMeta(viewer, place, meta);

  // Attribution name — shown to everyone, so resolve it with a single lookup.
  let createdByName: string | null = null;
  if (createdByUserId) {
    const cu = await db.user.findUnique({
      where: { id: createdByUserId },
      select: { id: true, firstName: true, lastName: true, preferredName: true },
    });
    createdByName = cu ? sessionDisplayName(cu, "A member") : "A member";
  }

  // The "Change creator" picker list is only rendered when the viewer can
  // manage, so only build it then — a read-only view skips the roster query.
  // Always include the viewer so "attribute to me" works (incl. Community,
  // which has no roster).
  let members: { id: string; name: string }[] = [];
  if (canManage) {
    const memberRows = place.hubId
      ? await db.hubMember.findMany({
          where: { hubId: place.hubId },
          select: {
            user: {
              select: { id: true, firstName: true, lastName: true, preferredName: true },
            },
          },
        })
      : [];
    members = memberRows.map((r) => ({
      id: r.user.id,
      name: sessionDisplayName(r.user, "A member"),
    }));
    if (!members.some((m) => m.id === viewer.userId)) {
      const vu = await db.user.findUnique({
        where: { id: viewer.userId },
        select: { id: true, firstName: true, lastName: true, preferredName: true },
      });
      if (vu) members.push({ id: vu.id, name: sessionDisplayName(vu, "A member") });
    }
    members.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Decide how to render the body. Drive-touching work (mint, export) is
  // wrapped so a failure degrades to a panel, never a 500.
  const crossSite = (await headers()).get("sec-fetch-site") === "cross-site";
  type BodyMode = "iframe" | "export" | "pdf" | "image" | "audio" | "video" | "google" | "download";
  let bodyMode: BodyMode;
  let previewUrl: string | null = null;
  let exportHtml: string | null = null;

  if (isGoogleEditorMime(mime)) {
    if (!held) {
      // Shared Google-native → Google's own high-fidelity preview iframe.
      try {
        if (!crossSite) {
          const minted = await ensureAnyoneWithLink(fileId, "reader");
          if (minted) {
            await logFileAction({
              userId: viewer.userId,
              action: "mint-link",
              googleFileId: fileId,
              hubId: place.hubId,
              detail: { place: place.key, mimeType: mime, role: "reader", via: "preview" },
            });
          }
          previewUrl = googlePreviewUrl(mime, fileId);
        } else {
          // A cross-site top-level navigation must not trigger a mint (lure
          // defense, mirroring the open route). Only preview if a link exists.
          const anyone = await getAnyonePermission(fileId);
          if (anyone) previewUrl = googlePreviewUrl(mime, fileId);
        }
      } catch (e) {
        console.error("[files-detail] preview", e instanceof Error ? e.message : e);
      }
      bodyMode = previewUrl ? "iframe" : "google";
    } else if (mime === GOOGLE_MIME.doc) {
      // Draft Doc → RIM's calm export reader (no link minted; stays private).
      try {
        exportHtml = googleDocHtmlToRimHtml(await exportDocHtml(fileId));
      } catch (e) {
        console.error("[files-detail] export", e instanceof Error ? e.message : e);
      }
      bodyMode = exportHtml ? "export" : "google";
    } else {
      // Draft Sheet/Slides — no clean export; the creator opens it in Google.
      bodyMode = "google";
    }
  } else if (mime.startsWith("application/vnd.google-apps")) {
    // A Google-native type we don't render in-RIM (Form, Drawing…): open in Google.
    bodyMode = "google";
  } else if (mime === "application/pdf") {
    bodyMode = "pdf";
  } else if (mime.startsWith("image/")) {
    bodyMode = "image";
  } else if (mime.startsWith("audio/")) {
    bodyMode = "audio";
  } else if (mime.startsWith("video/")) {
    bodyMode = "video";
  } else {
    bodyMode = "download";
  }

  const streamSrc = `/api/files/stream/${fileId}`;

  return (
    <AccountLayout>
      <div className="gf-detail">
        <a className="gf-detail__back" href={backHref}>
          &larr; Back to files
        </a>
        <h1 className="ac-page-title gf-detail__title">{file.name}</h1>

        <FileDetailActions
          fileId={fileId}
          kindLabel={kindLabel}
          isGoogleEditor={isEditor}
          editorName={editorName}
          held={held}
          mine={mine}
          canManage={canManage}
          createdByName={createdByName}
          createdByUserId={createdByUserId}
          modifiedLabel={file.modifiedTime ? relativeDate(file.modifiedTime) : null}
          members={members}
        />

        <div className="gf-detail__body">
          {bodyMode === "iframe" && previewUrl && (
            <iframe className="gf-detail__frame" src={previewUrl} title={file.name} />
          )}
          {bodyMode === "export" && exportHtml && (
            <article
              className="rim-content gf-detail__doc"
              dangerouslySetInnerHTML={{ __html: exportHtml }}
            />
          )}
          {bodyMode === "pdf" && (
            <iframe className="gf-detail__frame" src={streamSrc} title={file.name} />
          )}
          {bodyMode === "image" && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className="gf-detail__img" src={streamSrc} alt={file.name} />
          )}
          {bodyMode === "audio" && (
            <audio className="gf-detail__audio" controls src={streamSrc} />
          )}
          {bodyMode === "video" && (
            <video className="gf-detail__video" controls src={streamSrc} />
          )}
          {(bodyMode === "google" || bodyMode === "download") && (
            <div className="gf-detail__panel">
              <p className="gf-detail__panel-text">
                {bodyMode === "google"
                  ? held
                    ? "This draft opens in Google to view or edit."
                    : "This file opens in Google."
                  : "This file downloads to your device."}
              </p>
              <a
                className="gf-detail__btn gf-detail__btn--primary"
                href={bodyMode === "google" ? `/api/files/open/${fileId}` : streamSrc}
                target="_blank"
                rel="noopener"
              >
                {bodyMode === "google" ? `Open in Google ${editorName}`.trim() : "Download"}
              </a>
            </div>
          )}
        </div>
      </div>
    </AccountLayout>
  );
}
