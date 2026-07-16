import "server-only";
import { db } from "@/lib/db";
import { isHubCoordinator } from "@/lib/hubAuth";
import { sessionDisplayName } from "@/lib/sessionIdentity";
import { googleConfigured } from "@/lib/google/auth";
import {
  GOOGLE_MIME,
  createFile,
  getFile,
  getFileOrNull,
  listSharedDrives,
  type DriveFile,
} from "@/lib/google/drive";

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
  /**
   * May this viewer create/rename/move/trash/upload here? (Slice 3.)
   * Community: every member (decided session 163). Hub: ACTIVE membership
   * or GUIDING_TEACHER — a paused/inactive member keeps read access through
   * the door but loses working power, matching the hub-membership authority
   * model. Reads never depend on this flag.
   */
  canWrite: boolean;
}

/**
 * The ONE definition of hub-place write authority, shared by
 * getAccessiblePlaces (via hubPlace) and the per-hub Files page so the
 * toolbar and the API gate can't drift apart: ACTIVE membership or
 * GUIDING_TEACHER (a paused/inactive member keeps read access through the
 * door but loses working power).
 *
 * Folder-scoped Spaces are now fully writable: the per-folder access gate
 * (resolvePlaceForFile / resolveParentFolder) confines every read AND write
 * to the Space's own subtree, so there's no longer any reason to hold scoped
 * places read-only. This replaces the Slice-3a restriction and is the
 * enforcement backlog 2026-07-14-002 called for — full closure of that item
 * also needs the provisioning step to keep folder-scoped Spaces on a
 * dedicated container Drive (see resolvePlaceForFile's invariant note).
 */
export function hubWriteAllowed(
  roles: string[],
  memberStatus: string | null | undefined,
): boolean {
  return roles.includes("GUIDING_TEACHER") || memberStatus === "ACTIVE";
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

/**
 * The Spaces container drive is the ONE Shared Drive named "RIM — Spaces"
 * (reserved name, exact-matched like Community) that holds every
 * auto-provisioned Space as a top-level folder. It is NEVER mapped as a
 * hub's whole drive — that's the load-bearing invariant the per-folder gate
 * relies on (see resolvePlaceForFile): a whole-drive place must never share a
 * drive with folder-scoped Spaces. Because provisioning only ever creates
 * folders here (never a whole-drive mapping) and admins map own-Drive/sensitive
 * hubs to their OWN drives, that invariant holds by construction.
 */
function isSpacesContainerName(name: string): boolean {
  const normalized = name
    .toLowerCase()
    .replace(/[—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized === "rim spaces" || normalized === "spaces";
}

/**
 * A drive RIM manages specially (the Community place or the Spaces container)
 * — never selectable as a hub's OWN whole drive in the admin picker, because
 * a whole-drive hub mapping onto either would break the isolation invariant
 * the per-folder gate relies on (see resolvePlaceForFile).
 */
export function isReservedDriveName(name: string): boolean {
  return isCommunityDriveName(name) || isSpacesContainerName(name);
}

let spacesCache: { drive: { id: string; name: string } | null; at: number } | null = null;

export async function resolveSpacesContainerDrive(): Promise<{ id: string; name: string } | null> {
  if (!googleConfigured()) return null;
  if (spacesCache && Date.now() - spacesCache.at < COMMUNITY_TTL_MS) {
    return spacesCache.drive;
  }
  try {
    const drives = await listSharedDrives();
    const drive = drives.find((d) => isSpacesContainerName(d.name)) ?? null;
    // Cache only a HIT — unlike Community (which reliably exists), the
    // container may be created mid-rollout; caching a "missing" result for
    // 5 min would make an admin's create-then-provision fail spuriously.
    if (drive) spacesCache = { drive, at: Date.now() };
    return drive;
  } catch {
    return spacesCache?.drive ?? null;
  }
}

/**
 * Auto-provision a hub's Files storage: create a folder for it inside the
 * "RIM — Spaces" container drive and map the hub to it (folder-scoped), so a
 * Space gets working, isolated storage with no manual Google Console step —
 * the automation the drive-per-hub model couldn't offer (the service account
 * can't create Shared Drives; it CAN create folders in one it manages).
 *
 * Idempotent and non-clobbering: a hub that already has ANY drive mapping
 * (auto-provisioned OR a manually-mapped own drive for a sensitive team) is
 * left untouched. Only an unmapped hub is provisioned. Best-effort at call
 * sites — a provisioning failure never blocks hub creation; the hub can be
 * provisioned later from the admin edit page.
 */
export async function provisionHubSpaceStorage(
  hub: { id: string; name: string; googleDriveId: string | null; googleRootFolderId: string | null },
  actorUserId: string,
): Promise<
  | { ok: true; driveId: string; rootFolderId: string; alreadyMapped: boolean }
  | { ok: false; error: string }
> {
  if (!googleConfigured()) return { ok: false, error: "Google Files isn't configured." };
  // Respect an existing mapping (auto or manual own-drive) — never clobber it.
  if (hub.googleDriveId) {
    return {
      ok: true,
      driveId: hub.googleDriveId,
      rootFolderId: hub.googleRootFolderId ?? hub.googleDriveId,
      alreadyMapped: true,
    };
  }
  const container = await resolveSpacesContainerDrive();
  if (!container) {
    return {
      ok: false,
      error: 'The "RIM — Spaces" Shared Drive isn\'t set up yet — create it in Google Drive and add the service account as a Manager.',
    };
  }
  const folder = await createFile({
    name: hub.name,
    mimeType: GOOGLE_MIME.folder,
    parentId: container.id,
  });
  await db.hub.update({
    where: { id: hub.id },
    data: {
      googleDriveId: container.id,
      googleRootFolderId: folder.id,
      googleFilesEnabled: true,
    },
  });
  await logFileAction({
    userId: actorUserId,
    action: "provision-space",
    hubId: hub.id,
    detail: { folderId: folder.id, name: hub.name, containerDriveId: container.id },
  });
  return { ok: true, driveId: container.id, rootFolderId: folder.id, alreadyMapped: false };
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
    canWrite: true,
  };
}

function hubPlace(
  h: {
    id: string;
    slug: string;
    name: string;
    googleDriveId: string | null;
    googleRootFolderId: string | null;
  },
  canWrite: boolean,
): FilesPlace {
  return {
    key: `hub:${h.slug}`,
    kind: "hub",
    hubSlug: h.slug,
    hubId: h.id,
    name: h.name,
    driveId: h.googleDriveId!,
    rootId: h.googleRootFolderId ?? h.googleDriveId!,
    canWrite,
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
      select: {
        ...HUB_PLACE_SELECT,
        // The viewer's own membership row (empty for a GT browsing a hub
        // they haven't joined) — feeds the write gate, never the read gate.
        members: { where: { userId }, select: { status: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const places: FilesPlace[] = [];
  if (community) places.push(communityPlace(community));
  for (const h of hubs) {
    places.push(hubPlace(h, hubWriteAllowed(roles, h.members[0]?.status)));
  }
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
 * A folder-scoped place is one whose root is a FOLDER inside a larger shared
 * Drive (googleRootFolderId set), as opposed to a whole-drive place
 * (Community, or a hub that owns its entire Drive) where rootId === driveId.
 * For a whole-drive place, belonging to the drive is enough; for a
 * folder-scoped place, a file must descend from the place's own root folder —
 * because several Spaces can share one Drive, and the Drive alone can't tell
 * them apart.
 */
export function isFolderScoped(place: FilesPlace): boolean {
  return place.rootId !== place.driveId;
}

/**
 * Does `fileId` live within `rootId`'s subtree? Walks the single-parent chain
 * upward (Shared Drive items have exactly one parent), asking the injected
 * `parentsOf` for each ancestor's parents — pure of Drive specifics so the
 * decision is unit-testable without the live API. Fails CLOSED: reaching the
 * drive root, running out of parents, a cycle, or exhausting maxDepth all
 * return false. This is the heart of Space-to-Space isolation on a shared
 * Drive, so it must never accidentally return true.
 */
export async function fileWithinFolderRoot(opts: {
  fileId: string;
  fileParents: string[] | undefined;
  rootId: string;
  driveId: string;
  parentsOf: (id: string) => Promise<string[] | undefined>;
  maxDepth?: number;
}): Promise<boolean> {
  const { fileId, rootId, driveId } = opts;
  if (fileId === rootId) return true; // the Space's own root folder
  const maxDepth = opts.maxDepth ?? 25;
  const seen = new Set<string>([fileId]);
  let parents = opts.fileParents;
  for (let depth = 0; depth < maxDepth; depth++) {
    const parent = parents?.[0];
    if (!parent) return false; // reached the top without hitting rootId
    if (parent === rootId) return true; // inside the Space's subtree
    if (parent === driveId) return false; // reached the Drive root, above the Space
    if (seen.has(parent)) return false; // cycle guard — fail closed
    seen.add(parent);
    parents = await opts.parentsOf(parent);
  }
  return false; // depth exhausted — fail closed
}

/**
 * Resolve WHICH of a viewer's accessible places owns a given file — the
 * subtree-aware successor to a bare driveId match. A whole-drive place wins
 * on driveId alone; folder-scoped places (which may share one Drive) each get
 * the ancestry check, so a member of Space A can never reach Space B's file
 * merely because both live on the same shared Drive. Null = not authorized.
 */
export async function resolvePlaceForFile(
  places: FilesPlace[],
  file: DriveFile & { parents?: string[]; driveId?: string },
): Promise<FilesPlace | null> {
  const candidates = places.filter((p) => p.driveId === file.driveId);
  if (candidates.length === 0) return null;
  const folderScoped = candidates.filter(isFolderScoped);
  // Fast path — belonging to the Drive is enough — ONLY when the Drive is
  // wholly one place's (Community, an own-Drive hub) with NO folder-scoped
  // Space sharing it. If a folder-scoped Space shares this Drive, a
  // whole-drive match could leak that sibling's file, so we DON'T
  // short-circuit; we fall to the subtree walk and, in that (misconfigured)
  // mix, deny anything not inside a folder-scoped Space rather than granting
  // whole-drive access. The load-bearing invariant that keeps the common
  // case both correct and cheap: folder-scoped Spaces live only on a
  // dedicated container Drive that no place holds whole — enforced at
  // provisioning; a whole-drive Drive (Community, own-Drive hubs) must never
  // also host folder-scoped Spaces.
  if (folderScoped.length === 0) {
    return candidates.find((p) => !isFolderScoped(p)) ?? null;
  }
  // Memoize ancestor lookups across candidate walks — folder-scoped candidates
  // on one shared Drive have overlapping chains, so N candidates shouldn't
  // each re-fetch the same parents.
  const parentCache = new Map<string, string[] | undefined>();
  const parentsOf = async (id: string) => {
    if (!parentCache.has(id)) parentCache.set(id, (await getFile(id)).parents);
    return parentCache.get(id);
  };
  for (const p of folderScoped) {
    const within = await fileWithinFolderRoot({
      fileId: file.id,
      fileParents: file.parents,
      rootId: p.rootId,
      driveId: p.driveId,
      parentsOf,
    });
    if (within) return p;
  }
  return null;
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
  // Subtree-aware: a file on a shared Drive belongs to whichever Space's
  // folder actually contains it, not to every place that shares the Drive.
  const place = await resolvePlaceForFile(places, file);
  if (!place) {
    return { ok: false, status: 404, error: "You don't have access to this file." };
  }
  return { ok: true, data: { viewer, file, place } };
}

export type FileMetaLite = { creatorUserId: string | null; heldAt: Date | null };

/**
 * The READ gate for opening/streaming/reading a file (open, stream, doc
 * reader, the detail page). It's authorizeFileRequest PLUS the draft gate: a
 * held file is readable only by its creator or a moderator (GT/ADMIN), so
 * hiding it from the Finder list actually MEANS private — a same-Space member
 * who happens to have the id can't open it either. Writes keep using
 * authorizeFileWrite (a creator/coordinator must be able to act on a held
 * file). Returns the file's meta alongside, since every read caller needs it
 * (attribution + held display).
 */
export async function authorizeFileRead(
  session: Parameters<typeof filesViewer>[0],
  fileId: string,
): Promise<
  | { ok: true; data: AuthorizedFile & { meta: FileMetaLite | null } }
  | { ok: false; status: number; error: string }
> {
  const gate = await authorizeFileRequest(session, fileId);
  if (!gate.ok) return gate;
  const { viewer } = gate.data;
  const meta = await db.googleFileMeta.findUnique({
    where: { googleFileId: fileId },
    select: { creatorUserId: true, heldAt: true },
  });
  if (meta?.heldAt) {
    const isModerator =
      viewer.roles.includes("GUIDING_TEACHER") || viewer.roles.includes("ADMIN");
    const isCreator = !!meta.creatorUserId && meta.creatorUserId === viewer.userId;
    if (!isCreator && !isModerator) {
      // Same 404 as a file in a Space you can't reach — a held draft simply
      // doesn't exist for anyone but its creator.
      return { ok: false, status: 404, error: "You don't have access to this file." };
    }
  }
  return { ok: true, data: { ...gate.data, meta } };
}

/**
 * Clean a member-supplied file/folder name: strip control characters,
 * collapse whitespace, cap the length (Drive itself allows almost anything —
 * the cap keeps listings readable). Null = nothing usable was entered.
 */
export function sanitizeFileName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
  return name || null;
}

/**
 * Refuse cross-site requests on state-changing Files routes — the same
 * defense the open route uses for its GET-that-mints. Our own client is
 * same-origin ("same-origin"); a hand-typed URL is "none"; only "cross-site"
 * is rejected.
 */
export function isCrossSiteRequest(req: Request): boolean {
  return req.headers.get("sec-fetch-site") === "cross-site";
}

/**
 * Validate a client-supplied destination folder: it must be a real,
 * un-trashed folder living in this place's drive. Returns the folder to use
 * ({ id, name: null } = the place root), or null when the folder isn't in
 * this space — including when it was deleted (a genuine 404 is "not here",
 * not a 502) or sits in Drive's trash (writing into a trashed folder would
 * make the content vanish from every listing). Shared by list/create/move/
 * upload so no route can forget the drive-ownership check.
 */
export async function resolveParentFolder(
  place: FilesPlace,
  folder: string | null | undefined,
): Promise<{ id: string; name: string | null } | null> {
  if (!folder || folder === place.rootId) return { id: place.rootId, name: null };
  const f = await getFileOrNull(folder);
  if (
    !f ||
    f.driveId !== place.driveId ||
    f.mimeType !== GOOGLE_MIME.folder ||
    f.trashed
  ) {
    return null;
  }
  // Folder-scoped place: the destination must live within THIS Space's
  // subtree, not merely on the same shared Drive — else a write could place
  // content in another Space's folder (the same isolation resolvePlaceForFile
  // enforces on reads).
  if (isFolderScoped(place)) {
    const within = await fileWithinFolderRoot({
      fileId: f.id,
      fileParents: f.parents,
      rootId: place.rootId,
      driveId: place.driveId,
      parentsOf: async (id) => (await getFile(id)).parents,
    });
    if (!within) return null;
  }
  return { id: folder, name: f.name };
}

/**
 * The one JSON shape for a file row sent to the Finder client — list, create,
 * and update responses all serialize through here so the client-side FileRow
 * contract can't drift per-route. The RIM-layer fields (createdBy / held /
 * mine) come from GoogleFileMeta via buildFileRows; a bare fileRowJson(f) call
 * (single-file rename/move responses the client re-fetches anyway) leaves them
 * at their harmless defaults.
 */
export interface FileRowJson {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  /** Google's own last-editor name — often anonymous; kept for completeness. */
  modifiedBy: string | null;
  /** RIM's own attribution (resolved member name). null = "Added directly". */
  createdBy: string | null;
  /** A draft: hidden from the Space until shared. */
  held: boolean;
  /** This viewer is the file's creator (drives the "Your drafts" grouping). */
  mine: boolean;
}

export function fileRowJson(
  f: DriveFile,
  extra?: { createdBy?: string | null; held?: boolean; mine?: boolean },
): FileRowJson {
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime ?? null,
    modifiedBy: f.lastModifyingUser?.displayName ?? null,
    createdBy: extra?.createdBy ?? null,
    held: extra?.held ?? false,
    mine: extra?.mine ?? false,
  };
}

/**
 * Annotate a Drive listing with RIM's per-file state (GoogleFileMeta) and
 * filter out other people's drafts. Batched: one meta query + one name query
 * for the whole folder. A held file is returned only to its creator (`mine`)
 * or a moderator (GUIDING_TEACHER/ADMIN); everyone else never sees it —
 * decision: a draft is genuinely private until shared. Creator names resolve
 * to the app's "Nancy L." display; an unknown creator (no meta row — e.g. a
 * file dropped straight into the Drive) stays null so the UI shows a clean
 * placeholder instead of the service-account attribution.
 */
export async function buildFileRows(
  files: DriveFile[],
  viewer: { userId: string; roles: string[] },
): Promise<FileRowJson[]> {
  if (files.length === 0) return [];
  const metas = await db.googleFileMeta.findMany({
    where: { googleFileId: { in: files.map((f) => f.id) } },
    select: { googleFileId: true, creatorUserId: true, heldAt: true },
  });
  const metaById = new Map(metas.map((m) => [m.googleFileId, m]));

  const creatorIds = [
    ...new Set(metas.map((m) => m.creatorUserId).filter((id): id is string => !!id)),
  ];
  const users = creatorIds.length
    ? await db.user.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, firstName: true, lastName: true, preferredName: true },
      })
    : [];
  const nameById = new Map(users.map((u) => [u.id, sessionDisplayName(u, "")]));

  const isModerator =
    viewer.roles.includes("GUIDING_TEACHER") || viewer.roles.includes("ADMIN");

  const rows: FileRowJson[] = [];
  for (const f of files) {
    const m = metaById.get(f.id);
    const held = !!m?.heldAt;
    const mine = !!m?.creatorUserId && m.creatorUserId === viewer.userId;
    // A held file is filtered out of the LISTING for anyone but its creator or
    // a moderator. (Note: this hides it, it doesn't seal it — the open/stream/
    // reader routes don't yet gate on held; a same-Space member holding the
    // file id could still read it. A read-route held gate lands with the
    // Slice-2 detail page. In practice a never-shared draft's id isn't
    // discoverable, since it never appears in a list the non-creator can see.)
    if (held && !mine && !isModerator) continue;
    // createdBy resolution: a known creator with no name resolves to a generic
    // "A member" (still attributed), NOT null — null is reserved for a file
    // with no creator record at all, which the UI renders "Added directly".
    const createdBy = m?.creatorUserId
      ? nameById.get(m.creatorUserId) || "A member"
      : null;
    rows.push(fileRowJson(f, { createdBy, held, mine }));
  }
  return rows;
}

/**
 * May this viewer change a file's RIM state (hold/share, and later re-attribute
 * its creator)? Broader than draft *visibility* (creator + moderator only):
 * the file's creator, a coordinator of its Space, or a GUIDING_TEACHER/ADMIN.
 * A Community file (no hub) has no coordinator, so it's creator + moderator.
 * Runs AFTER authorizeFileWrite has already confirmed baseline write access.
 */
export async function canManageFileMeta(
  viewer: { userId: string; roles: string[] },
  place: FilesPlace,
  meta: { creatorUserId: string | null } | null,
): Promise<boolean> {
  if (viewer.roles.includes("GUIDING_TEACHER") || viewer.roles.includes("ADMIN")) {
    return true;
  }
  if (meta?.creatorUserId && meta.creatorUserId === viewer.userId) return true;
  if (place.hubSlug && (await isHubCoordinator(viewer.userId, place.hubSlug))) return true;
  return false;
}

/** The five reactions a file comment supports (mirrors hub conversations). */
export const FILE_REACTION_EMOJIS = ["👍", "❤️", "🙏", "💡", "😊"] as const;

export interface FileCommentJson {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  /** emoji → the ids of members who reacted with it. */
  reactions: Record<string, string[]>;
}

/**
 * A file's conversation, oldest-first, with author names resolved in one batch
 * (loose authorId → the app's "Nancy L." display). Shared by the detail page's
 * server render and the GET refetch route so the shape can't drift.
 */
export async function listFileComments(googleFileId: string): Promise<FileCommentJson[]> {
  const comments = await db.fileComment.findMany({
    where: { googleFileId },
    orderBy: { createdAt: "asc" },
  });
  if (comments.length === 0) return [];
  const authorIds = [...new Set(comments.map((c) => c.authorId))];
  const users = await db.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, firstName: true, lastName: true, preferredName: true },
  });
  const nameById = new Map(users.map((u) => [u.id, sessionDisplayName(u, "A member")]));
  return comments.map((c) => ({
    id: c.id,
    authorId: c.authorId,
    authorName: nameById.get(c.authorId) ?? "A member",
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    editedAt: c.editedAt ? c.editedAt.toISOString() : null,
    reactions: (c.reactions as Record<string, string[]>) ?? {},
  }));
}

/**
 * May the viewer moderate (delete any comment on) this file's conversation? A
 * comment's own author can always delete it; beyond that it's a Space
 * coordinator or a GUIDING_TEACHER/ADMIN — mirroring hub-reply deletion. This
 * is distinct from canManageFileMeta (which also lets the FILE's creator act):
 * making a file doesn't make you a moderator of everyone's comments on it.
 */
export async function canModerateFileConversation(
  viewer: { userId: string; roles: string[] },
  place: FilesPlace,
): Promise<boolean> {
  if (viewer.roles.includes("GUIDING_TEACHER") || viewer.roles.includes("ADMIN")) {
    return true;
  }
  if (place.hubSlug && (await isHubCoordinator(viewer.userId, place.hubSlug))) return true;
  return false;
}

/**
 * The shared gate for state-changing PER-FILE routes (rename/move/trash —
 * and any Slice 3b+ write): cross-site refusal, the read gate
 * (authorizeFileRequest), the place's write authority, and the browse-anchor
 * protection, in one call — mirroring how authorizeFileRequest centralized
 * the read scaffold so a new write route can't forget a check.
 */
export async function authorizeFileWrite(
  session: Parameters<typeof filesViewer>[0],
  req: Request,
  fileId: string,
): Promise<
  { ok: true; data: AuthorizedFile } | { ok: false; status: number; error: string }
> {
  if (isCrossSiteRequest(req)) {
    return { ok: false, status: 403, error: "Open this from within RIM." };
  }
  const gate = await authorizeFileRequest(session, fileId);
  if (!gate.ok) return gate;
  const { place } = gate.data;
  if (!place.canWrite) {
    return {
      ok: false,
      status: 403,
      error: "You don't have permission to make changes here.",
    };
  }
  // The place's own root (the drive root, or a hub's scoped root folder) is
  // RIM's browse anchor — renaming/moving/trashing it would break the whole
  // Files view. Members never see it as a row; refuse crafted requests.
  if (fileId === place.rootId || fileId === place.driveId) {
    return { ok: false, status: 400, error: "This folder can't be changed." };
  }
  return gate;
}

/**
 * The shared gate for state-changing PER-PLACE routes (create — and Slice
 * 3b's uploads): cross-site refusal, the viewer gate, place resolution, and
 * the place's write authority, in one call.
 */
export async function resolveWritablePlace(
  session: Parameters<typeof filesViewer>[0],
  req: Request,
  placeKey: string,
): Promise<
  | { ok: true; data: { viewer: { userId: string; roles: string[] }; place: FilesPlace } }
  | { ok: false; status: number; error: string }
> {
  if (isCrossSiteRequest(req)) {
    return { ok: false, status: 403, error: "Open this from within RIM." };
  }
  const viewer = filesViewer(session);
  if (!viewer) return { ok: false, status: 401, error: "Please sign in." };
  const place = await resolvePlace(viewer.userId, viewer.roles, placeKey);
  if (!place) {
    return { ok: false, status: 404, error: "You don't have access to these files." };
  }
  if (!place.canWrite) {
    return {
      ok: false,
      status: 403,
      error: "You don't have permission to make changes here.",
    };
  }
  return { ok: true, data: { viewer, place } };
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
