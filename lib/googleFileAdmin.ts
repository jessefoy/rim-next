import "server-only";
import { db } from "@/lib/db";
import { googleConfigured } from "@/lib/google/auth";
import {
  getAnyonePermission,
  getFileOrNull,
  revokeAnyonePermission,
} from "@/lib/google/drive";
import { logFileAction, resolveCommunityDrive } from "@/lib/googleFiles";

/**
 * Admin link revoke/lockdown (RIM_GoogleWorkspace.md §5; backlog
 * 2026-07-14-001). Distinct from lib/googleFiles.ts: that module answers
 * "what can THIS member reach" (membership-scoped); this one answers "what
 * has RIM ever exposed, and how do we cut it off" (ADMIN-only, sees every
 * files-enabled place regardless of the admin's own membership — an admin
 * must be able to lock down a hub they don't belong to).
 *
 * The worklist is sourced from google_file_audit's "mint-link" entries (the
 * backlog item's own design) — never a full-drive file enumeration. Known
 * limitation: logFileAction swallows its own write failures (a transient DB
 * hiccup at the moment of minting leaves no audit row), so this is a
 * best-effort record, not a provable-complete one; there is no live-Drive
 * fallback enumeration, which would be expensive and is not built here.
 */

/** Run `fn` over `items` with bounded concurrency, `size` at a time. */
async function runInBatches<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return results;
}

export interface AdminPlace {
  /** "community" or "hub:<slug>" — mirrors the FilesPlace key convention. */
  key: string;
  name: string;
  /** The audit-log grouping key — null means Community. */
  hubId: string | null;
}

/** Every files-enabled place, admin-wide — no membership filter. */
export async function getAllFilesPlaces(): Promise<AdminPlace[]> {
  if (!googleConfigured()) return [];
  const [community, hubs] = await Promise.all([
    resolveCommunityDrive(),
    db.hub.findMany({
      where: { googleFilesEnabled: true, googleDriveId: { not: null } },
      select: { id: true, slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const places: AdminPlace[] = [];
  if (community) places.push({ key: "community", name: "Community", hubId: null });
  for (const h of hubs) places.push({ key: `hub:${h.slug}`, name: h.name, hubId: h.id });
  return places;
}

/** Resolve one admin place by key — derived from getAllFilesPlaces so there's
 *  exactly one definition of what places exist. */
export async function resolveAdminPlace(key: string): Promise<AdminPlace | null> {
  const places = await getAllFilesPlaces();
  return places.find((p) => p.key === key) ?? null;
}

export interface MintedFileStatus {
  googleFileId: string;
  mintedAt: Date;
  /** Live Drive lookup — null if the file no longer exists. */
  name: string | null;
  /** Whether the anyone-with-link permission is still present right now. */
  stillExposed: boolean;
  /**
   * True when the live check itself failed (a transient Drive error, NOT a
   * clean 404) — distinct from "confirmed not exposed," so a blip can't
   * read as a false all-clear. stillExposed is left false (conservative
   * default) but the UI must show this as "couldn't check," not "locked down."
   */
  checkFailed: boolean;
}

/**
 * The minted-file worklist for one place, with a LIVE per-file status check
 * — the log alone can't tell you if a file was already revoked or deleted
 * since. Checks run FILE-first, then permission (skipped if the file is
 * genuinely gone — getFileOrNull's clean-404 case) — never in blind
 * parallel, so a real "deleted" (no error) can't be confused with a
 * transient failure on the permission call. Bounded concurrency across
 * files: this is an admin-only page, not a member hot path, but a worklist
 * that grows over time shouldn't fire unbounded parallel Drive calls.
 */
export async function getMintedFileWorklist(hubId: string | null): Promise<MintedFileStatus[]> {
  const minted = await db.googleFileAudit.findMany({
    where: { action: "mint-link", hubId, googleFileId: { not: null } },
    distinct: ["googleFileId"],
    select: { googleFileId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return runInBatches(minted, 5, async (m) => {
    const fileId = m.googleFileId!;
    try {
      const file = await getFileOrNull(fileId); // clean null on genuine 404
      if (!file) {
        return { googleFileId: fileId, mintedAt: m.createdAt, name: null, stillExposed: false, checkFailed: false };
      }
      const anyone = await getAnyonePermission(fileId);
      return {
        googleFileId: fileId,
        mintedAt: m.createdAt,
        name: file.name,
        stillExposed: Boolean(anyone),
        checkFailed: false,
      };
    } catch (e) {
      console.error("[admin-google-worklist] status check failed", fileId, e);
      return {
        googleFileId: fileId,
        mintedAt: m.createdAt,
        name: null,
        stillExposed: false,
        checkFailed: true,
      };
    }
  });
}

/** Revoke one file's link — logs the action for the audit trail. */
export async function revokeFileLink(opts: {
  fileId: string;
  hubId: string | null;
  adminUserId: string;
}): Promise<{ revoked: boolean }> {
  const revoked = await revokeAnyonePermission(opts.fileId);
  await logFileAction({
    userId: opts.adminUserId,
    action: "revoke-link",
    googleFileId: opts.fileId,
    hubId: opts.hubId,
    detail: { revoked },
  });
  return { revoked };
}

/**
 * Sweep every CURRENTLY-exposed file for a place — the "lock down this
 * drive" action. Reuses getMintedFileWorklist (rather than re-deriving its
 * own file list) so cost scales with what's actually still exposed, not
 * with all-time minted count, and so a deleted-since-mint file can never
 * abort the sweep (the worklist already tolerates that per-file). Logs ONE
 * summary audit row rather than one per file — the bulk action is one
 * event, not N; the single-file revoke route is where per-file logging
 * belongs.
 */
export async function lockdownPlace(opts: {
  hubId: string | null;
  adminUserId: string;
}): Promise<{ checked: number; revoked: number }> {
  const worklist = await getMintedFileWorklist(opts.hubId);
  const exposed = worklist.filter((w) => w.stillExposed);

  const outcomes = await runInBatches(exposed, 5, async (w) => {
    try {
      return await revokeAnyonePermission(w.googleFileId);
    } catch (e) {
      console.error("[admin-google-lockdown] revoke failed", w.googleFileId, e);
      return false;
    }
  });
  const revokedCount = outcomes.filter(Boolean).length;

  await logFileAction({
    userId: opts.adminUserId,
    action: "lockdown-drive",
    hubId: opts.hubId,
    detail: { checked: worklist.length, exposed: exposed.length, revoked: revokedCount },
  });

  return { checked: worklist.length, revoked: revokedCount };
}
