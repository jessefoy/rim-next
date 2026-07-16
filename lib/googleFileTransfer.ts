import "server-only";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import {
  filesViewer,
  logFileAction,
  resolveParentFolder,
  resolvePlace,
} from "@/lib/googleFiles";
import { uploadFileContent } from "@/lib/google/drive";

/**
 * The Blob → Drive transfer worker (RIM_GoogleWorkspace.md, Slice 3 uploads).
 *
 * A large upload always lands in Vercel Blob first (the client-direct upload
 * pattern already used app-wide); this worker moves it into the authorized
 * Drive folder, then deletes the staging blob. Called two ways:
 *   - immediately, via after() right after the Blob upload webhook fires
 *     (app/api/files/upload/route.ts) — covers the common case in-request;
 *   - by the cron backstop (app/api/cron/process-file-transfers/route.ts),
 *     for anything the immediate attempt didn't finish (function timeout,
 *     cold start, crash) or that failed transiently.
 *
 * Authorization is RE-DERIVED here, never trusted from the enqueue-time
 * request: a transfer can sit for a while before the cron reaches it, and a
 * membership change in that window must be honored (RIM_GoogleWorkspace.md
 * §3 — "never trust client-supplied IDs," extended to "never trust
 * enqueue-time authorization" for anything that runs later than the request
 * that created it).
 */

const MAX_ATTEMPTS = 5;
/** A PROCESSING row older than this is presumed abandoned by a crashed/timed-out
 *  invocation and safe for the cron to reclaim. */
const STALE_PROCESSING_MS = 30 * 60_000;

function staleProcessingBefore(): Date {
  return new Date(Date.now() - STALE_PROCESSING_MS);
}

/**
 * Claim one transfer for processing: PENDING, or a PROCESSING row stale
 * enough to have been abandoned. The conditional updateMany is the
 * concurrency guard — if it affects zero rows, someone else (or nothing
 * eligible) got there first, and this call is a safe no-op.
 *
 * Deliberately NOT capped by attempts here: a row stuck at PROCESSING with
 * attempts already at MAX must still be reclaimable, or it would sit
 * abandoned forever (findTransfersToProcess excludes exhausted attempts from
 * its OWN sweep, but a stale claim always needs to resolve to a terminal
 * state one way or the other).
 */
async function claimTransfer(id: string): Promise<boolean> {
  const result = await db.googleFileTransfer.updateMany({
    where: {
      id,
      OR: [
        { status: "PENDING" },
        { status: "PROCESSING", updatedAt: { lt: staleProcessingBefore() } },
      ],
    },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  return result.count === 1;
}

/** A genuinely terminal failure (unauthorized, destination gone) — never retried. */
async function failPermanently(id: string, message: string): Promise<void> {
  await db.googleFileTransfer.update({
    where: { id },
    data: { status: "FAILED", lastError: message.slice(0, 2000) },
  });
}

/** A transient failure — retried until attempts exhausts MAX_ATTEMPTS. */
async function failTransiently(id: string, attempts: number, message: string): Promise<void> {
  await db.googleFileTransfer.update({
    where: { id },
    data: {
      status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
      lastError: message.slice(0, 2000),
    },
  });
}

/**
 * Best-effort staging-blob cleanup shared by the success path and the sweep.
 * Returns whether it actually succeeded, so a caller counting cleanups (the
 * sweep) doesn't mistake a swallowed failure for a completed one.
 */
async function cleanupBlob(id: string, blobPathname: string): Promise<boolean> {
  try {
    await del(blobPathname);
    await db.googleFileTransfer.update({ where: { id }, data: { blobDeletedAt: new Date() } });
    return true;
  } catch (e) {
    console.error("[files-transfer] blob cleanup failed", id, e);
    return false;
  }
}

export async function processFileTransfer(id: string): Promise<void> {
  const claimed = await claimTransfer(id);
  if (!claimed) return;

  const transfer = await db.googleFileTransfer.findUnique({ where: { id } });
  if (!transfer) return;

  try {
    // Re-derive authorization fresh — never trust the enqueue-time request.
    // filesViewer is the one archivedAt/agreedToTerms gate every Files
    // surface shares; shape the User row into the session-like input it
    // expects so this worker can't drift from that rule.
    const user = await db.user.findUnique({
      where: { id: transfer.userId },
      select: { id: true, roles: true, archivedAt: true, agreedToTerms: true },
    });
    const viewer = filesViewer(user ? { user } : null);
    if (!viewer) {
      await failPermanently(id, "The uploader is no longer an active member.");
      return;
    }
    const place = await resolvePlace(viewer.userId, viewer.roles, transfer.placeKey);
    if (!place || !place.canWrite) {
      await failPermanently(id, "No longer authorized to write to this location.");
      return;
    }
    const parent = await resolveParentFolder(place, transfer.folderId);
    if (!parent) {
      await failPermanently(id, "The destination folder no longer exists.");
      return;
    }

    const blobRes = await fetch(transfer.blobUrl);
    if (!blobRes.ok || !blobRes.body) {
      throw new Error(`Staged file fetch failed (${blobRes.status})`);
    }
    const contentLengthHeader = blobRes.headers.get("content-length");

    const file = await uploadFileContent({
      name: transfer.fileName,
      mimeType: transfer.mimeType,
      parentId: parent.id,
      content: blobRes.body,
      contentLength: contentLengthHeader ? Number(contentLengthHeader) : undefined,
    });

    // Persist success IMMEDIATELY — before the audit log or blob cleanup —
    // to shrink the window where a crash right here could otherwise leave
    // the row PROCESSING with a real Drive file already created, inviting a
    // duplicate on the next reclaim-and-retry.
    await db.googleFileTransfer.update({
      where: { id },
      data: { status: "DONE", googleFileId: file.id, lastError: null },
    });

    await logFileAction({
      userId: transfer.userId,
      action: "upload",
      googleFileId: file.id,
      hubId: place.hubId,
      detail: { place: place.key, name: transfer.fileName, mimeType: transfer.mimeType },
    });

    // Record RIM's own attribution so an uploaded file shows the uploader's
    // name in the Finder (not the "Added directly in Google Drive" placeholder
    // reserved for files that truly bypassed RIM). Uploads are shared, not
    // drafts (heldAt stays null). Best-effort + idempotent (upsert on the
    // unique googleFileId) — the transfer is already DONE, so a failure here
    // is a missing attribution nit, never a reason to fail/retry the upload.
    try {
      await db.googleFileMeta.upsert({
        where: { googleFileId: file.id },
        update: {},
        create: {
          googleFileId: file.id,
          creatorUserId: transfer.userId,
          heldAt: null,
          hubId: place.hubId,
          placeKey: place.key,
        },
      });
    } catch (metaErr) {
      console.error("[files-transfer] meta upsert failed", transfer.id, metaErr);
    }

    // Best-effort: the file is already safe in Drive, so a failed cleanup
    // here is a storage-cost nit, not a data-loss risk — leave it for the
    // cron's orphan sweep rather than failing a successful transfer over it.
    await cleanupBlob(id, transfer.blobPathname);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[files-transfer]", transfer.id, message);
    // transfer.attempts already reflects THIS attempt — claimTransfer
    // incremented it before this function body ran.
    await failTransiently(id, transfer.attempts, message);
  }
}

/**
 * The cron backstop's sweep: reclaimable transfers (PENDING with attempts
 * left, or PROCESSING stuck past the staleness window regardless of
 * attempts — a stale claim must always resolve, even one that's already
 * exhausted its retries), oldest first, capped per run so one invocation
 * can't take on unbounded Drive traffic.
 */
export async function findTransfersToProcess(limit: number): Promise<{ id: string }[]> {
  return db.googleFileTransfer.findMany({
    where: {
      OR: [
        { status: "PENDING", attempts: { lt: MAX_ATTEMPTS } },
        { status: "PROCESSING", updatedAt: { lt: staleProcessingBefore() } },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

/**
 * Clean up staging blobs left behind by transfers that exhausted their
 * retries — the failure is permanent (unauthorized / destination gone), so
 * the blob would otherwise sit in storage indefinitely. The audit/ledger row
 * itself is kept for troubleshooting. Independent per row, so run concurrently.
 */
export async function sweepFailedTransferBlobs(limit: number): Promise<number> {
  const stale = await db.googleFileTransfer.findMany({
    where: { status: "FAILED", blobDeletedAt: null },
    select: { id: true, blobPathname: true },
    take: limit,
  });
  const results = await Promise.all(stale.map((t) => cleanupBlob(t.id, t.blobPathname)));
  return results.filter(Boolean).length;
}
