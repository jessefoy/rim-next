import "server-only";
import { getGoogleAccessToken } from "./auth";

/**
 * Google Drive REST helpers — server-only, the thin primitives under RIM's
 * Files system (RIM_GoogleWorkspace.md). Every call runs as the RIM Files
 * service account; its power comes solely from Shared Drive membership, so
 * these helpers can only ever see/touch RIM's own drives.
 *
 * Design rules honored here:
 *  - All Shared Drive calls carry supportsAllDrives/includeItemsFromAllDrives
 *    (without them the Drive API silently ignores Shared Drive content).
 *  - Errors throw with Google's actual response body so diagnostics and logs
 *    show the real reason (never credentials).
 *  - No caller-supplied IDs are trusted here — authorization (hub membership →
 *    mapped drive) happens in the route layer before these run.
 */

const API_BASE = "https://www.googleapis.com/drive/v3";

/**
 * Retry/backoff at the single choke point every Files surface flows through
 * (promised for member-facing traffic in RIM_GoogleWorkspace.md §6, Slice 2).
 * Up to 3 attempts on 429/5xx or a network error, with a small backoff — a
 * transient Drive blip must not become "We couldn't load these files" across
 * every hub at once.
 */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, attempt === 1 ? 300 : 900));
    }
    try {
      const res = await fetch(url, init);
      if (RETRYABLE_STATUS.has(res.status) && attempt < 2) continue;
      return res;
    } catch (e) {
      lastError = e; // network-level failure — retry
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Drive request failed after retries");
}

/** Authenticated Drive API call. Returns parsed JSON, or undefined on 204. */
export async function driveApi<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getGoogleAccessToken();
  const hasBody = init.body != null;
  const res = await fetchWithRetry(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Drive API ${init.method ?? "GET"} ${path} failed (${res.status}): ${body}`,
    );
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Authenticated Drive call returning the raw Response — for streaming file
 * bodies (alt=media) and text exports, where JSON parsing doesn't apply.
 */
export async function driveApiRaw(path: string): Promise<Response> {
  const token = await getGoogleAccessToken();
  const res = await fetchWithRetry(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive API GET ${path} failed (${res.status}): ${body}`);
  }
  return res;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface SharedDrive {
  id: string;
  name: string;
}

/** Google Docs/Sheets/Slides + folder MIME types the app branches on. */
export const GOOGLE_MIME = {
  folder: "application/vnd.google-apps.folder",
  doc: "application/vnd.google-apps.document",
  sheet: "application/vnd.google-apps.spreadsheet",
  slides: "application/vnd.google-apps.presentation",
} as const;

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  /** Display name of the last modifier (Google-side attribution, best-effort). */
  lastModifyingUser?: { displayName?: string };
  /** Opens the file in Google's own UI (editor for Docs/Sheets/Slides). */
  webViewLink?: string;
  size?: string;
}

/** The file fields every listing/read surface needs — keep in one place. */
export const FILE_FIELDS =
  "id,name,mimeType,modifiedTime,lastModifyingUser(displayName),webViewLink,size";

/**
 * Escape a value for a single-quoted Drive query literal. Backslashes first,
 * then quotes — an ID ending in a backslash must not swallow the closing
 * quote. (IDs are admin config, but the stored value is arbitrary text.)
 */
function qEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// ── Shared drives ────────────────────────────────────────────────────────────

/**
 * List the Shared Drives the service account is a member of — this is how the
 * admin mapping UI discovers drives without anyone copying IDs. Page-capped:
 * 300 drives is absurd headroom for RIM, and an unbounded loop inside one
 * serverless invocation is the real risk.
 */
export async function listSharedDrives(): Promise<SharedDrive[]> {
  const drives: SharedDrive[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  do {
    const params = new URLSearchParams({ pageSize: "100", fields: "nextPageToken,drives(id,name)" });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await driveApi<{ drives?: SharedDrive[]; nextPageToken?: string }>(
      `/drives?${params}`,
    );
    drives.push(...(page.drives ?? []));
    pageToken = page.nextPageToken;
    pages += 1;
  } while (pageToken && pages < 3);
  return drives;
}

// ── Files ────────────────────────────────────────────────────────────────────

/**
 * List the children of a folder (or a Shared Drive's root — pass the drive id
 * as `parentId`). Folders sort first, then by name, matching the Finder feel.
 * Page-capped at ~1,000 items per listing; if a real folder ever exceeds
 * that, Slice 2+ should add true pagination to the browser rather than
 * letting one render burn unbounded sequential round-trips.
 */
export async function listFiles(
  driveId: string,
  parentId?: string,
): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  do {
    const params = new URLSearchParams({
      q: `'${qEscape(parentId ?? driveId)}' in parents and trashed = false`,
      corpora: "drive",
      driveId,
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
      orderBy: "folder,name",
      pageSize: "200",
      fields: `nextPageToken,files(${FILE_FIELDS})`,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await driveApi<{ files?: DriveFile[]; nextPageToken?: string }>(
      `/files?${params}`,
    );
    files.push(...(page.files ?? []));
    pageToken = page.nextPageToken;
    pages += 1;
  } while (pageToken && pages < 5);
  return files;
}

/**
 * Fetch one file's metadata, including its parents + owning drive — the
 * fields the route layer needs to verify a file actually belongs to a hub's
 * mapped drive before acting on it.
 */
export async function getFile(
  fileId: string,
): Promise<DriveFile & { parents?: string[]; driveId?: string }> {
  const params = new URLSearchParams({
    supportsAllDrives: "true",
    fields: FILE_FIELDS + ",parents,driveId",
  });
  return driveApi<DriveFile & { parents?: string[]; driveId?: string }>(
    `/files/${encodeURIComponent(fileId)}?${params}`,
  );
}

/**
 * Create a file (Google Doc/Sheet/Slides/folder by MIME type) inside a Shared
 * Drive folder. Returns the created file with its webViewLink.
 */
export async function createFile(opts: {
  name: string;
  mimeType: string;
  parentId: string;
}): Promise<DriveFile> {
  const params = new URLSearchParams({
    supportsAllDrives: "true",
    fields: FILE_FIELDS,
  });
  return driveApi<DriveFile>(`/files?${params}`, {
    method: "POST",
    body: JSON.stringify({
      name: opts.name,
      mimeType: opts.mimeType,
      parents: [opts.parentId],
    }),
  });
}

/**
 * Set "anyone with the link can edit" on a file — the link-as-key model
 * (RIM_GoogleWorkspace.md: RIM is the gate; the link is only handed to members
 * RIM authorizes). This is also the operation the org's "distributing content
 * outside" policy could refuse — the diagnostic probes exactly this.
 */
export async function setAnyoneWithLinkEditor(fileId: string): Promise<void> {
  const params = new URLSearchParams({ supportsAllDrives: "true" });
  await driveApi(`/files/${encodeURIComponent(fileId)}/permissions?${params}`, {
    method: "POST",
    body: JSON.stringify({ type: "anyone", role: "writer" }),
  });
}

/**
 * Export a Google Doc as HTML (the in-app read path — members read inside
 * RIM with zero Google literacy; see lib/google/docHtml.ts for the calm-down
 * transform before rendering).
 */
export async function exportDocHtml(fileId: string): Promise<string> {
  const res = await driveApiRaw(
    `/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent("text/html")}`,
  );
  return res.text();
}

/**
 * Idempotent link-as-key mint: ensure "anyone with the link can edit" exists
 * on a file, upgrading a viewer-role link if present. Called just-in-time
 * when RIM hands out an open/edit link, so files created directly in Drive
 * (which lack the permission) work too. Files only — Google doesn't support
 * anyone-with-link on Shared Drive folders.
 */
export async function ensureAnyoneWithLinkEditor(fileId: string): Promise<void> {
  const params = new URLSearchParams({
    supportsAllDrives: "true",
    fields: "permissions(id,type,role)",
  });
  const existing = await driveApi<{
    permissions?: { id: string; type: string; role: string }[];
  }>(`/files/${encodeURIComponent(fileId)}/permissions?${params}`);
  const anyone = existing.permissions?.find((p) => p.type === "anyone");
  if (anyone?.role === "writer") return;
  if (anyone) {
    const patchParams = new URLSearchParams({ supportsAllDrives: "true" });
    await driveApi(
      `/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(anyone.id)}?${patchParams}`,
      { method: "PATCH", body: JSON.stringify({ role: "writer" }) },
    );
    return;
  }
  try {
    await setAnyoneWithLinkEditor(fileId);
  } catch (e) {
    // Two members opening the same fresh file concurrently can both reach the
    // create — tolerate the loser if the permission now exists either way.
    const recheck = await driveApi<{
      permissions?: { type: string; role: string }[];
    }>(`/files/${encodeURIComponent(fileId)}/permissions?${params}`);
    const now = recheck.permissions?.find((p) => p.type === "anyone");
    if (!now) throw e;
  }
}

/**
 * PERMANENT, unrecoverable delete — diagnostic cleanup ONLY. App-facing
 * deletion must use trashFile (Drive trash, ~30-day recovery) per
 * RIM_GoogleWorkspace.md. The alarming name is deliberate: both functions
 * take a bare fileId and typecheck interchangeably.
 */
export async function permanentlyDeleteFile(fileId: string): Promise<void> {
  const params = new URLSearchParams({ supportsAllDrives: "true" });
  await driveApi(`/files/${encodeURIComponent(fileId)}?${params}`, {
    method: "DELETE",
  });
}

/** Move a file to Drive's trash (recoverable ~30 days — the app-facing delete). */
export async function trashFile(fileId: string): Promise<void> {
  const params = new URLSearchParams({ supportsAllDrives: "true" });
  await driveApi(`/files/${encodeURIComponent(fileId)}?${params}`, {
    method: "PATCH",
    body: JSON.stringify({ trashed: true }),
  });
}
