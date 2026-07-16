import "server-only";
import { db } from "@/lib/db";

/**
 * Native-documents → Google Files migration — the DRY-RUN reporter
 * (RIM_GoogleWorkspace.md §6, Slice 4 cutover). Read-only: it never writes to
 * the DB or Drive. It answers "what would move, and where?" so we look at real
 * counts before touching the one-way door.
 *
 * The write path (a later step) converts ACTIVE native docs → Google Docs
 * (HTML import) and transfers ACTIVE uploaded PDFs into each doc's HOME Space
 * folder; LINK docs (external URLs, not files) and archived/trashed docs are
 * reported but not moved in v1. Nothing here is destructive.
 */

const BLOB_HOST = ".public.blob.vercel-storage.com";

export interface MigrationDryRun {
  totalNonTrashed: number;
  byKind: { native: number; upload: number; link: number };
  byState: { active: number; archived: number };
  hubless: number;
  crossShared: number; // docs placed into a hub beyond their origin
  uploadsWithBlob: number;
  uploadsMissingBlob: number; // UPLOAD rows whose url isn't a Vercel Blob
  nativeEmpty: number; // NATIVE with no body to import
  /** What the write path would actually move: ACTIVE native-with-body + ACTIVE upload-with-blob. */
  migratable: number;
  /** ACTIVE docs whose home Space has no folder yet (should be 0 post-provisioning). */
  homeUnprovisioned: number;
  /** ACTIVE hubless docs — they'd land in the Community Space. */
  homelessToCommunity: number;
  perHub: { hubName: string; hubSlug: string | null; provisioned: boolean; docCount: number }[];
  notes: string[];
}

function isBlobUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && url.includes(BLOB_HOST);
}

export async function buildMigrationDryRun(): Promise<MigrationDryRun> {
  const docs = await db.hubDocument.findMany({
    where: { deletedAt: null }, // trashed docs are excluded from migration
    select: {
      docKind: true,
      url: true,
      body: true,
      hubId: true,
      archivedAt: true,
      hub: { select: { name: true, slug: true, googleRootFolderId: true } },
      placements: { select: { hubId: true } },
    },
  });

  const r: MigrationDryRun = {
    totalNonTrashed: docs.length,
    byKind: { native: 0, upload: 0, link: 0 },
    byState: { active: 0, archived: 0 },
    hubless: 0,
    crossShared: 0,
    uploadsWithBlob: 0,
    uploadsMissingBlob: 0,
    nativeEmpty: 0,
    migratable: 0,
    homeUnprovisioned: 0,
    homelessToCommunity: 0,
    perHub: [],
    notes: [],
  };

  const perHub = new Map<string, { hubName: string; hubSlug: string | null; provisioned: boolean; docCount: number }>();

  for (const d of docs) {
    const active = d.archivedAt === null;
    if (active) r.byState.active++;
    else r.byState.archived++;

    if (!d.hubId) r.hubless++;
    if (d.placements.length > 0) r.crossShared++;

    const kind = d.docKind;
    if (kind === "NATIVE") {
      r.byKind.native++;
      const hasBody = d.body != null && JSON.stringify(d.body).length > 2;
      if (!hasBody) r.nativeEmpty++;
      if (active && hasBody) r.migratable++;
    } else if (kind === "UPLOAD") {
      r.byKind.upload++;
      if (isBlobUrl(d.url)) {
        r.uploadsWithBlob++;
        if (active) r.migratable++;
      } else {
        r.uploadsMissingBlob++;
      }
    } else {
      r.byKind.link++;
    }

    // Home Space resolution mirrors the write path: origin hub, else first
    // placement, else Community (hubless).
    const homeHubId = d.hubId ?? d.placements[0]?.hubId ?? null;
    if (active) {
      if (!homeHubId) {
        r.homelessToCommunity++;
      } else if (d.hubId && !d.hub?.googleRootFolderId) {
        // Only checkable for the origin hub (we selected its folder); a
        // placement-only home is rare and flagged in notes.
        r.homeUnprovisioned++;
      }
    }

    // Per-hub tally (origin hub).
    if (d.hub) {
      const key = d.hub.slug ?? d.hub.name;
      const row = perHub.get(key) ?? {
        hubName: d.hub.name,
        hubSlug: d.hub.slug,
        provisioned: Boolean(d.hub.googleRootFolderId),
        docCount: 0,
      };
      row.docCount++;
      perHub.set(key, row);
    }
  }

  r.perHub = [...perHub.values()].sort((a, b) => b.docCount - a.docCount);

  if (r.byKind.link > 0) {
    r.notes.push(
      `${r.byKind.link} LINK doc(s) (external URLs) are not files — v1 does not migrate them; decide whether to recreate them as shortcuts or leave them.`,
    );
  }
  if (r.byState.archived > 0) {
    r.notes.push(
      `${r.byState.archived} archived doc(s) are reported but not migrated in v1 (only ACTIVE docs move).`,
    );
  }
  if (r.crossShared > 0) {
    r.notes.push(
      `${r.crossShared} doc(s) are shared into more than one hub — at migration they collapse to their home Space (cross-Space sharing is deferred, backlog 2026-07-15-001).`,
    );
  }
  if (r.homeUnprovisioned > 0) {
    r.notes.push(
      `${r.homeUnprovisioned} active doc(s) have an origin hub with no Files folder — run "Set up files for all teams" first.`,
    );
  }
  if (r.uploadsMissingBlob > 0) {
    r.notes.push(
      `${r.uploadsMissingBlob} UPLOAD doc(s) don't point at a Vercel Blob — their file can't be transferred automatically.`,
    );
  }

  return r;
}
