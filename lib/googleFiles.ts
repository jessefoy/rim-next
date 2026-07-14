import "server-only";
import { db } from "@/lib/db";
import { googleConfigured } from "@/lib/google/auth";
import { getFile, listSharedDrives, type DriveFile } from "@/lib/google/drive";

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
  /** The origin hub's DB id (hub places only) — for audit attribution. */
  hubId: string | null;
  name: string;
  driveId: string;
  /** Where browsing starts: a hub's optional root folder, else the drive. */
  rootId: string;
}

/**
 * The Community drive is the ONE Shared Drive whose name is the reserved
 * "Community" (or "RIM — Community"), matched exactly after normalizing case,
 * dashes, and spacing. Exact match — not a substring — so a restricted hub
 * drive that merely contains the word (e.g. "RIM — Community Care Team")
 * can never be surfaced as the all-members Community place (reviewer,
 * session 163). Decided over an env var (session 163): zero config, and the
 * name is admin-controlled at drive creation.
 */
function isCommunityDriveName(name: string): boolean {
  const normalized = name
    .toLowerCase()
    .replace(/[—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized === "community" || normalized === "rim community";
}

/**
 * Cached ~5 minutes per warm instance. On a refresh FAILURE we serve the
 * previous (now-stale) value rather than null: a transient Drive blip must
 * not become an authorization denial for every Community file — serving the
 * last-known drive id is correct, since drive identity effectively never
 * changes (reviewer, session 163).
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
    const drive = drives.find((d) => isCommunityDriveName(d.name)) ?? null;
    communityCache = { drive, at: Date.now() };
    return drive;
  } catch {
    // Serve the last-known value through the blip (may be null if never resolved).
    return communityCache?.drive ?? null;
  }
}

function communityPlace(drive: { id: string; name: string }): FilesPlace {
  return {
    key: "community",
    kind: "community",
    hubSlug: null,
    hubId: null,
    name: "Community",
    driveId: drive.id,
    rootId: drive.id,
  };
}

function hubPlace(h: {
  id: string;
  slug: string;
  name: string;
  googleDriveId: string | null;
  googleRootFolderId: string | null;
}): FilesPlace {
  return {
    key: `hub:${h.slug}`,
    kind: "hub",
    hubSlug: h.slug,
    hubId: h.id,
    name: h.name,
    driveId: h.googleDriveId!,
    rootId: h.googleRootFolderId ?? h.googleDriveId!,
  };
}

const HUB_PLACE_SELECT = {
  id: true,
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

/**
 * Resolve + authorize one place by key. Derived from getAccessiblePlaces so
 * there is exactly ONE authorization definition — a place can never be
 * resolvable-by-key after it has dropped out of the sidebar (reviewer,
 * session 163). Null = no such place for this viewer.
 */
export async function resolvePlace(
  userId: string,
  roles: string[],
  key: string,
): Promise<FilesPlace | null> {
  const places = await getAccessiblePlaces(userId, roles);
  return places.find((p) => p.key === key) ?? null;
}

/**
 * The gate for the per-file routes (stream / open / reader): resolve which of
 * the viewer's places owns this drive, returning the PLACE (not a bare
 * boolean) so callers get hubId for audit attribution and rootId/hubSlug for
 * downstream write policy (Slice 3). Null = not authorized.
 */
export async function resolveDriveAccess(
  userId: string,
  roles: string[],
  driveId: string | null | undefined,
): Promise<FilesPlace | null> {
  if (!driveId) return null;
  const places = await getAccessiblePlaces(userId, roles);
  return places.find((p) => p.driveId === driveId) ?? null;
}

/**
 * Should this member see the Files link in the account sidebar? The one
 * definition of "has any Files place," derived from the same rules as
 * getAccessiblePlaces but without a second DB round-trip: it reuses the hub
 * memberships AccountLayout already fetched, and the cached Community drive.
 * Kept in sync with the access model so the link never disagrees with what
 * /account/files actually shows (reviewer, session 163 — flagged by four
 * angles).
 */
export async function memberHasFilesAccess(
  roles: string[],
  memberships: {
    hub: { status: string; googleFilesEnabled: boolean; googleDriveId: string | null };
  }[],
): Promise<boolean> {
  if (!googleConfigured()) return false;
  if (roles.includes("ADMIN") || roles.includes("GUIDING_TEACHER")) return true;
  if (
    memberships.some(
      (m) =>
        m.hub.status === "ACTIVE" &&
        m.hub.googleFilesEnabled &&
        Boolean(m.hub.googleDriveId),
    )
  ) {
    return true;
  }
  // Community is open to every member (session 163) — show the link whenever
  // the Community drive exists.
  return Boolean(await resolveCommunityDrive());
}

/**
 * The shared front-of-route gate for the per-file API routes (stream, open).
 * Runs the viewer gate, fetches the file + the viewer's places in parallel,
 * and confirms the file's owning drive is one the viewer can reach — returning
 * the authorized { viewer, file, place } or a typed error the route maps to a
 * response. Centralizes the auth scaffold so a new per-file route (Slice 3)
 * can't reintroduce the missing-gate bug this pass already fixed once.
 * Lets getFile throw (network failure) so the route's try/catch returns 502.
 */
export type AuthorizedFile = {
  viewer: { userId: string; roles: string[] };
  file: DriveFile & { parents?: string[]; driveId?: string };
  place: FilesPlace;
};

export async function authorizeFileRequest(
  session: Parameters<typeof filesViewer>[0],
  fileId: string,
): Promise<
  { ok: true; data: AuthorizedFile } | { ok: false; status: number; error: string }
> {
  const viewer = filesViewer(session);
  if (!viewer) return { ok: false, status: 401, error: "Please sign in." };
  const [file, places] = await Promise.all([
    getFile(fileId),
    getAccessiblePlaces(viewer.userId, viewer.roles),
  ]);
  const place = places.find((p) => p.driveId === file.driveId) ?? null;
  if (!place) {
    return { ok: false, status: 404, error: "You don't have access to this file." };
  }
  return { ok: true, data: { viewer, file, place } };
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
