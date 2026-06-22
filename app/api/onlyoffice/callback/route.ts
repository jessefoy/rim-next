import { db } from "@/lib/db";
import { resolveEditedFileUrl, verifyOnlyOfficeToken } from "@/lib/onlyoffice";
import { del, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

const EXT_FOR_FILETYPE: Record<string, string> = {
  DOC: "docx",
  SHEET: "xlsx",
  SLIDE: "pptx",
  FORM: "docx",
};

interface OnlyOfficeCallback {
  key?: string;
  status?: number;
  url?: string;
  token?: string;
  /** OnlyOffice's Authorization-header callback nests the body fields here. */
  payload?: OnlyOfficeCallback;
}

/**
 * POST — OnlyOffice's save callback.
 *
 * NOT session-gated: the document server calls this server-to-server with no
 * RIM session, so it's authenticated by the shared-secret JWT instead — the
 * one deliberate exception to the canAccessHub-on-every-route rule (flagged in
 * the Connections Map). On status 2 (MustSave) / 6 (ForceSave) it downloads the
 * edited file and persists a new version. Must always return {"error":0} on a
 * handled request, or OnlyOffice shows the user an error.
 */
export async function POST(req: NextRequest) {
  const raw = (await req.json().catch(() => null)) as OnlyOfficeCallback | null;
  if (!raw) return NextResponse.json({ error: 1 });

  // The JWT arrives in the Authorization header (JWT_HEADER) or the body `token`.
  const authHeader = req.headers.get("authorization") ?? "";
  const headerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7)
    : "";
  const token = headerToken || raw.token || "";
  const verified = token ? verifyOnlyOfficeToken<OnlyOfficeCallback>(token) : null;
  if (!verified) {
    console.error("[onlyoffice/callback] JWT verification failed");
    return NextResponse.json({ error: 1 });
  }

  // OnlyOffice signs the callback into the Authorization header, whose token
  // nests the body fields under `payload`; a body-embedded `token` carries them
  // at the top level. Read both — reading only the top level gave
  // status=undefined, so the save block below never ran and edits never
  // persisted (the real root of bug #1; the host-rewrite below is needed too,
  // but was never reached).
  const cb = verified.payload ?? verified;
  const { key, status, url } = cb;

  // The edited-file URL is pinned to the document server's public origin before
  // we fetch it (the host OnlyOffice reports is internal-only behind the proxy).
  const resolvedUrl = url ? resolveEditedFileUrl(url) : null;

  // 2 = MustSave (10s after the last editor closed), 6 = ForceSave (mid-session).
  if (status === 2 || status === 6) {
    if (!url || !key) return NextResponse.json({ error: 0 });

    // The edited-file URL is pinned to the document server's public origin (the
    // host OnlyOffice reports is internal-only behind the proxy). null = the URL
    // was unparseable — skip the save rather than fetch something unexpected.
    if (!resolvedUrl) {
      console.error("[onlyoffice/callback] unparseable edited-file url; skipping save");
      return NextResponse.json({ error: 0 });
    }

    // key is `${documentId}-${version}`; a cuid has no hyphens, so the last
    // hyphen is our separator.
    const dash = key.lastIndexOf("-");
    const documentId = dash > 0 ? key.slice(0, dash) : key;

    try {
      const doc = await db.hubDocument.findUnique({
        where: { id: documentId },
        select: { id: true, fileType: true, version: true, storageKey: true },
      });
      if (!doc) {
        console.error(`[onlyoffice/callback] unknown document ${documentId}`);
        return NextResponse.json({ error: 0 });
      }

      const res = await fetch(resolvedUrl);
      if (!res.ok) throw new Error(`download edited file failed: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const ext = EXT_FOR_FILETYPE[doc.fileType] ?? "docx";

      if (status === 6) {
        // ForceSave: the editor is still open under key `${id}-${version}`.
        // Persist in place (same version's blob, no bump) so that live key
        // stays valid — bumping mid-session would strand the open editor.
        const { url: blobUrl } = await put(
          `hub-docs/${documentId}/v${doc.version}.${ext}`,
          buffer,
          { access: "public", addRandomSuffix: false, token: process.env.BLOB_READ_WRITE_TOKEN },
        );
        if (blobUrl !== doc.storageKey) {
          await db.hubDocument.update({
            where: { id: documentId },
            data: { storageKey: blobUrl },
          });
        }
      } else {
        // MustSave: the last editor closed. Claim the next version atomically
        // (so two overlapping saves can't collide on the same number), write
        // its blob, then drop the previous version's blob.
        const bumped = await db.hubDocument.update({
          where: { id: documentId },
          data: { version: { increment: 1 } },
          select: { version: true },
        });
        const { url: blobUrl } = await put(
          `hub-docs/${documentId}/v${bumped.version}.${ext}`,
          buffer,
          { access: "public", addRandomSuffix: false, token: process.env.BLOB_READ_WRITE_TOKEN },
        );
        await db.hubDocument.update({
          where: { id: documentId },
          data: { storageKey: blobUrl },
        });
        if (
          doc.storageKey &&
          doc.storageKey !== blobUrl &&
          doc.storageKey.includes(".public.blob.vercel-storage.com")
        ) {
          await del(doc.storageKey).catch((e) =>
            console.error("[onlyoffice/callback] old blob cleanup failed", e),
          );
        }
      }
    } catch (err) {
      // Return error:0 anyway so OnlyOffice doesn't loop; the edit stays open
      // and the next save retries. Logged for Vercel observability.
      console.error("[onlyoffice/callback] save failed", err);
    }
  }

  return NextResponse.json({ error: 0 });
}
