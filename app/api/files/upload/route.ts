/**
 * POST /api/files/upload — the Vercel Blob client-upload webhook for Files
 * (RIM_GoogleWorkspace.md, Slice 3). Mirrors the existing app-wide
 * /api/upload route's handleUpload pattern, scoped to Files authorization.
 *
 * Two phases in one route (the @vercel/blob/client contract):
 *  1. generateClientToken — the browser asks for permission to upload
 *     straight to Blob. We re-derive the viewer + place from the session and
 *     the client's declared destination, refuse if not writable, and hand
 *     back a token plus a server-validated tokenPayload (never the client's
 *     raw string — same "don't trust the client" discipline as everywhere
 *     else in this system).
 *  2. uploadCompleted — Vercel's servers call back once the bytes are safely
 *     in Blob. We enqueue a GoogleFileTransfer row and kick off the Blob→
 *     Drive move via after(), so the common case completes before this
 *     request's execution context ends; anything that doesn't finish is
 *     caught by the cron backstop.
 *
 * The file never touches this function's body — Blob-to-browser upload is
 * direct, and Blob-to-Drive is a server-side stream (lib/google/drive.ts's
 * uploadFileContent) — so a 500 MB upload never proxies through a request
 * payload limit.
 */

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isCrossSiteRequest, filesViewer, resolvePlace, sanitizeFileName } from "@/lib/googleFiles";
import { processFileTransfer } from "@/lib/googleFileTransfer";
import { ALLOWED_UPLOAD_MIME_TYPES } from "@/lib/google/mime";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

interface UploadTokenPayload {
  place: string;
  folder: string | null;
  userId: string;
  fileName: string;
  mimeType: string;
}

export async function POST(request: NextRequest) {
  // The token-generation phase mints upload permission — refuse cross-site,
  // matching every other state-changing Files route (create, rename/move/
  // trash, the open route's GET-that-mints).
  if (isCrossSiteRequest(request)) {
    return NextResponse.json({ error: "Open this from within RIM." }, { status: 403 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "BLOB_READ_WRITE_TOKEN is not configured" }, { status: 500 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const viewer = filesViewer(await auth());
        if (!viewer) throw new Error("Please sign in.");

        let parsed: { place?: unknown; folder?: unknown; fileName?: unknown; mimeType?: unknown };
        try {
          parsed = clientPayload ? JSON.parse(clientPayload) : {};
        } catch {
          throw new Error("That request didn't make sense.");
        }
        const placeKey = typeof parsed.place === "string" ? parsed.place : "";
        const place = await resolvePlace(viewer.userId, viewer.roles, placeKey);
        if (!place || !place.canWrite) {
          throw new Error("You don't have permission to upload here.");
        }
        const fileName = sanitizeFileName(parsed.fileName);
        if (!fileName) throw new Error("Please give the file a name.");
        const mimeType =
          typeof parsed.mimeType === "string" && parsed.mimeType
            ? parsed.mimeType
            : "application/octet-stream";
        const folder = typeof parsed.folder === "string" ? parsed.folder : null;

        // Re-serialize a server-validated payload — never pass the client's
        // raw string through to the completion phase.
        const tokenPayload: UploadTokenPayload = {
          place: place.key,
          folder,
          userId: viewer.userId,
          fileName,
          mimeType,
        };

        return {
          allowedContentTypes: [...ALLOWED_UPLOAD_MIME_TYPES],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          tokenPayload: JSON.stringify(tokenPayload),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) return;
        const parsed = JSON.parse(tokenPayload) as UploadTokenPayload;

        // Vercel's upload-completed callback is at-least-once delivery — a
        // retry (slow response, transient 5xx) must not enqueue a second
        // transfer for the same staged file. blobPathname is unique per
        // upload, so a retried create() hits that constraint; reuse the
        // row a prior delivery already created instead of duplicating it.
        let transfer;
        try {
          transfer = await db.googleFileTransfer.create({
            data: {
              userId: parsed.userId,
              placeKey: parsed.place,
              folderId: parsed.folder,
              fileName: parsed.fileName,
              mimeType: parsed.mimeType,
              blobUrl: blob.url,
              blobPathname: blob.pathname,
            },
          });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            const existing = await db.googleFileTransfer.findUnique({
              where: { blobPathname: blob.pathname },
            });
            if (!existing) throw e;
            transfer = existing;
          } else {
            throw e;
          }
        }

        // Best-effort in-request completion; the cron backstop covers
        // anything after() doesn't finish before the invocation ends. Safe
        // to re-trigger on a redelivered callback too — processFileTransfer
        // only ever claims a PENDING (or stale-abandoned) row.
        after(() => processFileTransfer(transfer.id));
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    console.error("[files-upload]", err instanceof Error ? err.message : err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
