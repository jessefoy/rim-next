/**
 * Blob cleanup utility — deletes orphaned Vercel Blob files when
 * BlockNote JSON content is updated or deleted.
 *
 * Usage:
 *   await cleanupRemovedBlobs(oldBody, newBody);  // on update
 *   await cleanupAllBlobs(oldBody);                // on delete
 */

import { del } from "@vercel/blob";

const BLOB_HOST = ".public.blob.vercel-storage.com";

/**
 * Recursively extract all Vercel Blob URLs from BlockNote JSON content.
 * Looks for image block `url` props and any string value matching the blob host.
 */
export function extractBlobUrls(body: unknown): string[] {
  const urls: string[] = [];

  function walk(node: unknown) {
    if (!node) return;
    if (typeof node === "string") {
      if (node.includes(BLOB_HOST)) urls.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node === "object") {
      for (const val of Object.values(node as Record<string, unknown>)) {
        walk(val);
      }
    }
  }

  walk(body);
  return [...new Set(urls)]; // deduplicate
}

/**
 * Delete blob URLs that were in `oldBody` but are NOT in `newBody`.
 * Safe to call even if there are no blobs — it's a no-op.
 */
export async function cleanupRemovedBlobs(
  oldBody: unknown,
  newBody: unknown
): Promise<void> {
  const oldUrls = extractBlobUrls(oldBody);
  if (oldUrls.length === 0) return;

  const newUrls = new Set(extractBlobUrls(newBody));
  const removed = oldUrls.filter((url) => !newUrls.has(url));

  if (removed.length === 0) return;

  try {
    await del(removed);
  } catch (err) {
    // Log but don't fail the request — blob cleanup is best-effort
    console.error("Blob cleanup failed:", err);
  }
}

/**
 * Delete ALL blob URLs found in the body (used when content is deleted entirely).
 */
export async function cleanupAllBlobs(body: unknown): Promise<void> {
  const urls = extractBlobUrls(body);
  if (urls.length === 0) return;

  try {
    await del(urls);
  } catch (err) {
    console.error("Blob cleanup failed:", err);
  }
}
