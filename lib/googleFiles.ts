import "server-only";
import { db } from "@/lib/db";
import { googleConfigured } from "@/lib/google/auth";
import { listSharedDrives } from "@/lib/google/drive";

/**
 * The Files system's places + authorization layer (RIM_GoogleWorkspace.md).
 *
 * A "place" is a location in the Finder's sidebar: the Community drive plus
 * each files-enabled hub drive the viewer can enter. RIM's database is the
 * permission system — every Files route resolves the target drive from these
 * server-side mappings and NEVER from a client-supplied drive id. The access
 * rules mirror the documents model:
 *   - hub places:      a HubMember row (any status) OR GUIDING_TEACHER —
 *                      the same door as lib/hubAuth.ts::canAccessHub.
 *                      ADMIN-alone does not pass (the session-128 boundary).
 *   - Community place: any signed-in member (decided session 163: Community
 *                      is readable AND editable by all members — "tended,
 *                      not gated"; revisit if the need arises).
 */

/**
 * The viewer gate for every Files API route. Session presence isn't enough:
 * the member *pages* enforce archivedAt + agreedToTerms structurally via the
 * (authenticated) layout, but API routes are reachable directly — and an
 * offboarded member's still-valid session must not read org files or mint
 * edit links (reviewer, session 163). The session callback already enriches
 * these fields, so this check costs no query.
 */
export function filesViewer(
  session: {
    user?: {
      id?: string;
      roles?: string[];
      archivedAt?: Date | string | null;
      agreedToTerms?: boolean | null;
    };
  } | null,
): { userId: string; roles: string[] } | null {
  const u = session?.user;
  if (!u?.id) return null;
  if (u.archivedAt) return null;
  if (!u.agreedToTerms) return null;
  return { userId: u.id, roles: u.roles ?? [] };
}

export interface FilesPlace {
  /** "community" or "hub:<slug>" — the key the client passes back. */
  key: string;
  kind: "community" | "hub";
  hubSlug: string | null;
  name: string;
  driveId: string;
  /** Where browsing starts: a hub's optional root folder, else the drive. */
  rootId: string;
}

/**
 * The Community drive is found by name — any Shared Drive the service account
 * belongs to whose name contains "community" (the same rule as the
 * /admin/google-test selftest; decided session 163 over an env var). Cached
 * ~5 minutes per warm instance; a lookup failure is NOT cached, so a
 * transient Google blip can't hide Community for the full window.
 */
let communityCache: { drive: { id: string; name: string } | null; at: number } | null = null;
const COMMUNITY_TTL_MS = 5 * 60_000;

export async function resolveCommunityDrive(): Promise<{ id: string; name: string } | null> {
  if (!googleConfigured()) return null;
  if (communityCache && Date.now() - communityCache.at < COMMUNITY_TTL_MS) {
    return communityCache.drive;
  }
  try {
    const drives = await listSharedDrives();
    const drive = drives.find((d) => /community/i.test(d.name)) ?? null;
    communityCache = { drive, at: Date.now() };
    return drive;
  } catch {
    return null;
  }
}

function communityPlace(drive: { id: string; name: string }): FilesPlace {
  return {
    key: "community",
    kind: "community",
    hubSlug: null,
    name: "Community",
    driveId: drive.id,
    rootId: drive.id,
  };
}

function hubPlace(h: {
  slug: string;
  name: string;
  googleDriveId: string | null;
  googleRootFolderId: string | null;
}): FilesPlace {
  return {
    key: `hub:${h.slug}`,
    kind: "hub",
    hubSlug: h.slug,
    name: h.name,
    driveId: h.googleDriveId!,
    rootId: h.googleRootFolderId ?? h.googleDriveId!,
  };
}

const HUB_PLACE_SELECT = {
  slug: true,
  name: true,
  googleDriveId: true,
  googleRootFolderId: true,
} as const;

/** Every place this member can open — Community first, then their team drives. */
export async function getAccessiblePlaces(
  userId: string,
  roles: string[],
): Promise<FilesPlace[]> {
  if (!googleConfigured()) return [];
  const isGT = roles.includes("GUIDING_TEACHER");
  const [community, hubs] = await Promise.all([
    resolveCommunityDrive(),
    db.hub.findMany({
      where: {
        status: "ACTIVE",
        googleFilesEnabled: true,
        googleDriveId: { not: null },
        ...(isGT ? {} : { members: { some: { userId } } }),
      },
      select: HUB_PLACE_SELECT,
      orderBy: { name: "asc" },
    }),
  ]);
  const places: FilesPlace[] = [];
  if (community) places.push(communityPlace(community));
  for (const h of hubs) places.push(hubPlace(h));
  return places;
}

/** Resolve + authorize one place by key. Null = no such place for this viewer. */
export async function resolvePlace(
  userId: string,
  roles: string[],
  key: string,
): Promise<FilesPlace | null> {
  if (!googleConfigured()) return null;
  if (key === "community") {
    const community = await resolveCommunityDrive();
    return community ? communityPlace(community) : null;
  }
  if (key.startsWith("hub:")) {
    const slug = key.slice(4);
    const isGT = roles.includes("GUIDING_TEACHER");
    const hub = await db.hub.findFirst({
      where: {
        slug,
        status: "ACTIVE",
        googleFilesEnabled: true,
        googleDriveId: { not: null },
        ...(isGT ? {} : { members: { some: { userId } } }),
      },
      select: HUB_PLACE_SELECT,
    });
    return hub ? hubPlace(hub) : null;
  }
  return null;
}

/**
 * May this viewer touch content in this drive? The gate for the per-file
 * routes (stream / open / reader), where the request carries a file id and
 * the file's owning drive is checked against the viewer's places.
 */
export async function canAccessFileDrive(
  userId: string,
  roles: string[],
  driveId: string | null | undefined,
): Promise<boolean> {
  if (!driveId) return false;
  const places = await getAccessiblePlaces(userId, roles);
  return places.some((p) => p.driveId === driveId);
}

/**
 * Audit-log a Google file action — RIM's own record of who did what
 * (independent of Google's often-anonymous attribution). Fire-and-forget
 * safe: an audit failure must never block the user's action.
 */
export async function logFileAction(opts: {
  userId: string;
  action: string;
  googleFileId?: string;
  hubId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.googleFileAudit.create({
      data: {
        userId: opts.userId,
        action: opts.action,
        googleFileId: opts.googleFileId ?? null,
        hubId: opts.hubId ?? null,
        detail: opts.detail ? JSON.parse(JSON.stringify(opts.detail)) : undefined,
      },
    });
  } catch (e) {
    console.error("[google-files-audit] write failed", e);
  }
}
