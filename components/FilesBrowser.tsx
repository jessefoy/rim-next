"use client";

/**
 * FilesBrowser — the Finder (RIM_GoogleWorkspace.md, Slices 2–3).
 *
 * One component, two doors: the system-wide /account/files window (places
 * sidebar: Community + team drives) and the per-hub Files tab (locked to that
 * hub's drive). Live view of the Shared Drive — folders-first rows, breadcrumb
 * path, drill-down on phones. Reading opens inside RIM; editing opens the real
 * Google editor in a new tab via the gated open route.
 *
 * Writing (Slice 3): a "New" menu (Create document/spreadsheet/presentation,
 * New folder, Upload a file) and a per-row ⋯ menu (Rename, Move, Move to
 * trash). The server decides writability per place (canWrite — Community:
 * every member; hub: ACTIVE membership or GT) so no affordance renders that
 * the API would refuse. Trash is Drive's own trash — recoverable for ~30
 * days; RIM exposes no permanent delete.
 *
 * Uploads always stage in Vercel Blob first (client-direct, up to 500 MB —
 * the same pattern the rest of RIM already uses for images/audio/PDFs), then
 * transfer server-side into Drive; the file never proxies through this
 * component's own request. Because the Drive-side move runs in after() and can
 * take a moment after the browser's upload finishes, the handler POLLS the
 * listing for a few seconds until the file appears, so it shows without a
 * manual refresh (the daily cron backstop + a later refresh cover an unusually
 * slow move).
 *
 * Navigation is URL-driven: the place + folder live in the query string, and a
 * single effect keyed on them does the fetch — so soft navigation (clicking
 * the sidebar Files link, browser back/forward) always resyncs, and every view
 * is shareable. Breadcrumb NAMES (not in the URL) are carried in a pending-ref
 * across a click so the in-session trail (root › A › B) survives; a cold load
 * into a subfolder shows that one folder below root.
 *
 * The client only ever sends a place KEY and folder id — drive resolution and
 * authorization live server-side (lib/googleFiles.ts).
 *
 * CSS prefix: gf-
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { upload } from "@vercel/blob/client";
import {
  File,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  MoreHorizontal,
  Plus,
  Presentation,
  Upload as UploadIcon,
  type LucideIcon,
} from "lucide-react";
import { ALLOWED_UPLOAD_MIME_TYPES, GOOGLE_MIME } from "@/lib/google/mime";
import { relativeDate } from "@/lib/relativeDate";

// The exact same list the server's Blob-token scope enforces (lib/google/
// mime.ts) — the picker can never offer a type the server would reject.
const UPLOAD_ACCEPT = ALLOWED_UPLOAD_MIME_TYPES.join(",");

export interface FilesPlaceLink {
  key: string;
  name: string;
  /** Server-decided: may this viewer create/organize in this place? */
  canWrite: boolean;
}

interface FileRow {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  /** Google's own last-editor (often anonymous) — no longer shown in the row;
   *  reserved for the Slice-2 file detail page. RIM attribution is createdBy. */
  modifiedBy: string | null;
  /** RIM's own attribution (resolved member name); null = added directly. */
  createdBy: string | null;
  /** A draft — held back from the Space until shared. */
  held: boolean;
  /** This viewer created it (drives the "Your drafts" grouping). */
  mine: boolean;
}

interface Crumb {
  id: string;
  name: string;
}

interface Props {
  places: FilesPlaceLink[];
  initialPlaceKey: string;
  /** Show the places sidebar (the /account/files window). Hub tabs hide it. */
  showPlaces: boolean;
  /** The page's own path — keeps the URL shareable and feeds reader back-links. */
  basePath: string;
}

type OpenMode = "folder" | "reader" | "stream" | "google";

type CreateKind = "doc" | "sheet" | "slides" | "folder";

const CREATE_KINDS: { kind: CreateKind; menuLabel: string; title: string }[] = [
  { kind: "doc", menuLabel: "Create document", title: "New document" },
  { kind: "sheet", menuLabel: "Create spreadsheet", title: "New spreadsheet" },
  { kind: "slides", menuLabel: "Create presentation", title: "New presentation" },
  { kind: "folder", menuLabel: "New folder", title: "New folder" },
];

type Dialog =
  | { mode: "create"; kind: CreateKind; title: string }
  | { mode: "rename"; row: FileRow }
  | { mode: "move"; row: FileRow }
  | { mode: "trash"; row: FileRow };

const GENERIC_ERROR = "We couldn't make that change. Please try again.";

function fileKind(mime: string): { icon: LucideIcon; label: string; open: OpenMode } {
  if (mime === GOOGLE_MIME.folder) return { icon: Folder, label: "Folder", open: "folder" };
  if (mime === GOOGLE_MIME.doc) return { icon: FileText, label: "Document", open: "reader" };
  if (mime === GOOGLE_MIME.sheet) return { icon: FileSpreadsheet, label: "Spreadsheet", open: "google" };
  if (mime === GOOGLE_MIME.slides) return { icon: Presentation, label: "Presentation", open: "google" };
  if (mime.startsWith("application/vnd.google-apps"))
    return { icon: File, label: "Google file", open: "google" };
  if (mime === "application/pdf") return { icon: FileText, label: "PDF", open: "stream" };
  if (mime.startsWith("audio/")) return { icon: FileAudio, label: "Audio", open: "stream" };
  if (mime.startsWith("image/")) return { icon: FileImage, label: "Image", open: "stream" };
  if (mime.startsWith("video/")) return { icon: FileVideo, label: "Video", open: "stream" };
  return { icon: File, label: "File", open: "google" };
}

export default function FilesBrowser({
  places,
  initialPlaceKey,
  showPlaces,
  basePath,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The URL is the source of truth for where we are.
  const defaultKey = places[0]?.key ?? initialPlaceKey;
  const placeKey =
    (showPlaces ? searchParams.get("place") : null) ?? initialPlaceKey ?? defaultKey;
  const folderId = searchParams.get("folder");

  const [trail, setTrail] = useState<Crumb[]>([]);
  const [files, setFiles] = useState<FileRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Write-layer state: which menu is open ("new" or a row id), the active
  // dialog, its in-flight + error state.
  const [menuOpen, setMenuOpen] = useState<"new" | string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Upload progress/status, shown as a slim line under the toolbar rather
  // than a modal — it runs alongside browsing, not blocking it.
  const [uploadStatus, setUploadStatus] = useState<
    | { name: string; percentage: number; phase: "sending" | "finishing" }
    | { name: string; error: string }
    | null
  >(null);
  const uploadAbort = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks the CURRENT place/folder for the upload's delayed soft-reload
  // (below): if the member navigates away before the reload fires, its
  // closure would otherwise overwrite whatever folder is now on screen with
  // stale data from where the upload started.
  const currentLocation = useRef({ placeKey, folderId });
  useEffect(() => {
    currentLocation.current = { placeKey, folderId };
  }, [placeKey, folderId]);
  // The trail a click intends, carried across the router navigation (names
  // aren't in the URL). Consumed by the load effect when it matches folderId.
  const pendingTrail = useRef<Crumb[] | null>(null);
  // Guards out-of-order responses when someone clicks fast.
  const requestSeq = useRef(0);

  const activePlace = places.find((p) => p.key === placeKey) ?? places[0];
  const canWrite = activePlace?.canWrite ?? false;

  function buildUrl(nextPlaceKey: string, nextFolderId: string | null): string {
    const params = new URLSearchParams();
    if (showPlaces && nextPlaceKey !== defaultKey) params.set("place", nextPlaceKey);
    if (nextFolderId) params.set("folder", nextFolderId);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    const seq = ++requestSeq.current;
    // A soft reload (after a write action) keeps the current list visible
    // instead of flashing the whole pane back to "Loading files…".
    if (!opts?.soft) setFiles(null);
    setError(null);

    // Resolve the breadcrumb trail for this folder: honor a click's intent,
    // else truncate to an ancestor already in view, else (cold load) show the
    // single folder below root once its name comes back.
    const intended = pendingTrail.current;
    pendingTrail.current = null;

    try {
      const params = new URLSearchParams({ place: placeKey });
      if (folderId) params.set("folder", folderId);
      const res = await fetch(`/api/files/list?${params}`);
      const data = await res.json();
      if (seq !== requestSeq.current) return;
      if (!res.ok) {
        setError(data.error ?? "We couldn't load these files. Please try again.");
        setFiles([]);
        return;
      }
      setFiles(data.files ?? []);
      if (!folderId) {
        setTrail([]);
      } else if (intended && intended[intended.length - 1]?.id === folderId) {
        setTrail(intended);
      } else {
        setTrail(
          data.folderName ? [{ id: folderId, name: data.folderName }] : [],
        );
      }
    } catch {
      if (seq === requestSeq.current) {
        setError("We couldn't load these files. Please try again.");
        setFiles([]);
      }
    }
  }, [placeKey, folderId]);

  // Fetch whenever the place or folder in the URL changes — covers the initial
  // load, folder clicks, place switches, the sidebar Files link, and back/
  // forward. No manual load() calls in handlers; they just navigate.
  useEffect(() => {
    load();
  }, [load]);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setActionError(null);
  }, []);

  // Escape closes an open menu or (when not mid-request) the dialog.
  useEffect(() => {
    if (!menuOpen && !dialog) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setMenuOpen(null);
      if (!busy) closeDialog();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, dialog, busy, closeDialog]);

  function openPlace(key: string) {
    if (key === placeKey) return;
    pendingTrail.current = [];
    router.replace(buildUrl(key, null), { scroll: false });
  }

  function openFolder(row: FileRow) {
    pendingTrail.current = [...trail, { id: row.id, name: row.name }];
    router.replace(buildUrl(placeKey, row.id), { scroll: false });
  }

  function openCrumb(index: number) {
    // index -1 = the place root.
    const nextTrail = index < 0 ? [] : trail.slice(0, index + 1);
    pendingTrail.current = nextTrail;
    const nextFolder = nextTrail.length ? nextTrail[nextTrail.length - 1].id : null;
    router.replace(buildUrl(placeKey, nextFolder), { scroll: false });
  }

  function openFile(row: FileRow) {
    // Folders drill down in place; every other file type opens the detail page
    // (the one home where it's read/previewed, attributed, and discussed) —
    // the page itself decides how to render + whether to reach Google.
    if (fileKind(row.mimeType).open === "folder") return openFolder(row);
    const back = buildUrl(placeKey, folderId);
    router.push(`/account/files/${row.id}?from=${encodeURIComponent(back)}`);
  }

  function openDialog(d: Dialog) {
    setMenuOpen(null);
    setActionError(null);
    setDialog(d);
  }

  /** One write round-trip: busy is always released, success closes + soft-reloads. */
  async function writeRequest(
    url: string,
    init: RequestInit,
  ): Promise<{ ok: boolean; data: { error?: string; openUrl?: string | null } }> {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error ?? GENERIC_ERROR);
        return { ok: false, data };
      }
      return { ok: true, data };
    } catch {
      setActionError(GENERIC_ERROR);
      return { ok: false, data: {} };
    } finally {
      setBusy(false);
    }
  }

  /** Shared by rename/move/trash — one PATCH, then close + refresh in place. */
  async function patchFile(rowId: string, payload: Record<string, unknown>) {
    const { ok } = await writeRequest(`/api/files/${rowId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    if (!ok) return;
    closeDialog();
    load({ soft: true });
  }

  /** Draft toggle — a direct menu/pill action (no dialog). Flips RIM's held
   * state, then refreshes so the file moves into or out of "Your drafts". */
  async function toggleDraft(rowId: string, action: "hold" | "share") {
    setMenuOpen(null);
    const { ok } = await writeRequest(`/api/files/${rowId}`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
    if (ok) load({ soft: true });
  }

  async function performCreate(kind: CreateKind, name: string) {
    // Open the placeholder tab synchronously (inside the user gesture) so
    // Safari doesn't block the editor tab a successful create deserves.
    // NOTE: "noopener" in the features list makes window.open return null,
    // which would strand the blank tab — so sever the opener by hand instead.
    let editorTab: Window | null = null;
    if (kind !== "folder") {
      editorTab = window.open("about:blank", "_blank");
      if (editorTab) editorTab.opener = null;
    }
    const { ok, data } = await writeRequest("/api/files/create", {
      method: "POST",
      body: JSON.stringify({ place: placeKey, folder: folderId, kind, name }),
    });
    if (!ok) {
      editorTab?.close();
      return;
    }
    if (data.openUrl && editorTab) {
      editorTab.location.href = data.openUrl;
    } else if (data.openUrl) {
      // Placeholder was popup-blocked; try a direct open as a fallback.
      window.open(data.openUrl, "_blank", "noopener");
    }
    closeDialog();
    load({ soft: true });
  }

  // One upload at a time in v1 (restraint over tracking a list of concurrent
  // uploads) — true while a real upload is progressing, false once it's
  // done/errored, so the New menu can refuse a second pick mid-flight.
  const uploadInFlight = uploadStatus != null && !("error" in uploadStatus);

  function triggerUpload() {
    if (uploadInFlight) return;
    setMenuOpen(null);
    fileInputRef.current?.click();
  }

  /**
   * A safe, unique Blob pathname — distinct from the file's DISPLAY name
   * (which travels separately via clientPayload and becomes the name Drive
   * shows). Slashes/unicode/odd characters in a member's actual filename
   * must not become the literal Blob URL path.
   */
  function blobPathnameFor(fileName: string): string {
    const safe = fileName.replace(/[^a-zA-Z0-9.-]/g, "-").slice(0, 150) || "file";
    return `google-files/${crypto.randomUUID()}-${safe}`;
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || uploadInFlight) return;

    const controller = new AbortController();
    uploadAbort.current = controller;
    setUploadStatus({ name: file.name, percentage: 0, phase: "sending" });
    // Capture where this upload started — the destination it should land in
    // and reload, regardless of where the member browses to afterward.
    const origin = { placeKey, folderId };

    try {
      await upload(blobPathnameFor(file.name), file, {
        access: "public",
        handleUploadUrl: "/api/files/upload",
        abortSignal: controller.signal,
        clientPayload: JSON.stringify({
          place: origin.placeKey,
          folder: origin.folderId,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
        }),
        onUploadProgress: ({ percentage }) => {
          setUploadStatus({ name: file.name, percentage, phase: "sending" });
        },
      });
      // The bytes are safely in Blob; the Drive-side move runs in after()
      // (usually ~1–3s, but not guaranteed to finish within a single delay).
      // Poll the listing until the file appears so it shows WITHOUT a manual
      // refresh — only while the member is still looking at the folder it lands
      // in, so a late reload can't clobber a folder they've since navigated to.
      setUploadStatus({ name: file.name, percentage: 100, phase: "finishing" });
      const stillAtOrigin = () => {
        const here = currentLocation.current;
        return here.placeKey === origin.placeKey && here.folderId === origin.folderId;
      };
      const pollDelays = [1200, 1800, 2500, 4000, 6000]; // ~15.5s total
      for (const delay of pollDelays) {
        await new Promise((r) => window.setTimeout(r, delay));
        if (controller.signal.aborted || !stillAtOrigin()) break;
        try {
          const params = new URLSearchParams({ place: origin.placeKey });
          if (origin.folderId) params.set("folder", origin.folderId);
          const res = await fetch(`/api/files/list?${params}`);
          const data = await res.json();
          if (res.ok && (data.files ?? []).some((f: { name: string }) => f.name === file.name)) {
            break; // it landed in Drive
          }
        } catch {
          // transient list failure — keep polling
        }
      }
      // Sync the visible list to the final state (shows the file once it landed;
      // the daily cron backstop + a later refresh cover an unusually slow move).
      if (stillAtOrigin()) load({ soft: true });
      setUploadStatus(null);
    } catch (err) {
      if (controller.signal.aborted) {
        setUploadStatus(null);
        return;
      }
      const message = err instanceof Error ? err.message : "The upload didn't go through.";
      setUploadStatus({ name: file.name, error: message });
      window.setTimeout(() => setUploadStatus(null), 4000);
    } finally {
      uploadAbort.current = null;
    }
  }

  // One file/folder row — shared by the "Your drafts" section and the main
  // list so their markup can't drift. A visible "Share with the Space" pill is
  // the dominant action on the viewer's own drafts (one clear next step); the
  // ⋯ menu carries the draft toggle for every other case plus rename/move/trash.
  function renderRow(row: FileRow) {
    const kind = fileKind(row.mimeType);
    const Icon = kind.icon;
    const othersDraft = row.held && !row.mine; // a moderator viewing someone else's draft
    return (
      <li key={row.id} className="gf-item">
        <button className="gf-row" onClick={() => openFile(row)}>
          <Icon
            size={18}
            strokeWidth={1.75}
            className={`gf-row__icon${kind.open === "folder" ? " gf-row__icon--folder" : ""}`}
            aria-hidden="true"
          />
          <span className="gf-row__namecell">
            <span className="gf-row__name">{row.name}</span>
            {othersDraft && <span className="gf-row__tag">Draft</span>}
          </span>
          <span className="gf-row__kind">{kind.label}</span>
          <span className="gf-row__meta">
            {row.modifiedTime ? `Updated ${relativeDate(row.modifiedTime)}` : ""}
            {row.createdBy ? ` · ${row.createdBy}` : ""}
          </span>
        </button>
        {row.held && row.mine && (
          <button
            className="gf-row__share"
            onClick={() => toggleDraft(row.id, "share")}
            disabled={busy}
          >
            Share with the Space
          </button>
        )}
        {canWrite && (
          <div className="gf-menu-wrap">
            <button
              className="gf-item__more"
              aria-label={`Actions for ${row.name}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen === row.id}
              onClick={() => setMenuOpen(menuOpen === row.id ? null : row.id)}
            >
              <MoreHorizontal size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            {menuOpen === row.id && (
              <div className="gf-menu gf-menu--row" role="menu">
                {!row.held && (
                  <button
                    className="gf-menu__item"
                    role="menuitem"
                    onClick={() => toggleDraft(row.id, "hold")}
                  >
                    Hold as draft
                  </button>
                )}
                {othersDraft && (
                  <button
                    className="gf-menu__item"
                    role="menuitem"
                    onClick={() => toggleDraft(row.id, "share")}
                  >
                    Share with the Space
                  </button>
                )}
                <button
                  className="gf-menu__item"
                  role="menuitem"
                  onClick={() => openDialog({ mode: "rename", row })}
                >
                  Rename
                </button>
                <button
                  className="gf-menu__item"
                  role="menuitem"
                  onClick={() => openDialog({ mode: "move", row })}
                >
                  Move…
                </button>
                <button
                  className="gf-menu__item gf-menu__item--danger"
                  role="menuitem"
                  onClick={() => openDialog({ mode: "trash", row })}
                >
                  Move to trash
                </button>
              </div>
            )}
          </div>
        )}
      </li>
    );
  }

  // The viewer's own drafts float to a distinct section at the top; everything
  // else (shared files + any drafts a moderator can see) stays in the main list.
  const myDrafts = files?.filter((f) => f.held && f.mine) ?? [];
  const rest = files?.filter((f) => !(f.held && f.mine)) ?? [];

  return (
    <div className={`gf-browser${showPlaces ? " gf-browser--with-places" : ""}`}>
      {showPlaces && places.length > 1 && (
        <nav className="gf-places" aria-label="File locations">
          {places.map((p) => (
            <button
              key={p.key}
              className={`gf-places__item${p.key === placeKey ? " gf-places__item--active" : ""}`}
              onClick={() => openPlace(p.key)}
            >
              {p.name}
            </button>
          ))}
        </nav>
      )}

      <div className="gf-pane">
        <div className="gf-bar">
          <nav className="gf-crumbs" aria-label="Folder path">
            <button className="gf-crumbs__item" onClick={() => openCrumb(-1)}>
              {activePlace?.name ?? "Files"}
            </button>
            {trail.map((t, i) => (
              <span key={t.id} className="gf-crumbs__seg">
                <span className="gf-crumbs__sep" aria-hidden="true">›</span>
                <button className="gf-crumbs__item" onClick={() => openCrumb(i)}>
                  {t.name}
                </button>
              </span>
            ))}
          </nav>

          {canWrite && (
            <div className="gf-menu-wrap">
              <button
                className="gf-new-btn"
                aria-haspopup="menu"
                aria-expanded={menuOpen === "new"}
                onClick={() => setMenuOpen(menuOpen === "new" ? null : "new")}
              >
                <Plus size={16} strokeWidth={2} aria-hidden="true" />
                New
              </button>
              {menuOpen === "new" && (
                <div className="gf-menu" role="menu">
                  {CREATE_KINDS.map((c) => (
                    <button
                      key={c.kind}
                      className="gf-menu__item"
                      role="menuitem"
                      onClick={() =>
                        openDialog({ mode: "create", kind: c.kind, title: c.title })
                      }
                    >
                      {c.menuLabel}
                    </button>
                  ))}
                  <button
                    className="gf-menu__item"
                    role="menuitem"
                    onClick={triggerUpload}
                    disabled={uploadInFlight}
                    title={uploadInFlight ? "Finish the current upload first" : undefined}
                  >
                    Upload a file
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {canWrite && (
          <input
            ref={fileInputRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            className="gf-visually-hidden"
            onChange={handleFileSelected}
            aria-hidden="true"
            tabIndex={-1}
          />
        )}

        {uploadStatus && (
          <div className="gf-upload-status">
            <UploadIcon size={16} strokeWidth={1.75} aria-hidden="true" />
            {"error" in uploadStatus ? (
              <span className="gf-upload-status__text">
                &ldquo;{uploadStatus.name}&rdquo; — {uploadStatus.error}
              </span>
            ) : (
              <>
                <span className="gf-upload-status__text">
                  {uploadStatus.phase === "finishing"
                    ? `Finishing "${uploadStatus.name}"…`
                    : `Uploading "${uploadStatus.name}"… ${uploadStatus.percentage}%`}
                </span>
                {uploadStatus.phase === "sending" && (
                  <button
                    className="gf-upload-status__cancel"
                    onClick={() => uploadAbort.current?.abort()}
                  >
                    Cancel
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {actionError && !dialog && (
          <p className="gf-notice" role="alert">
            {actionError}
          </p>
        )}

        {files === null && !error && <p className="gf-status">Loading files…</p>}

        {error && (
          <div className="gf-status">
            <p>{error}</p>
            <button className="btn" onClick={() => load()}>
              Try again
            </button>
          </div>
        )}

        {files !== null && !error && files.length === 0 && (
          <p className="gf-status">
            {trail.length ? "This folder is empty." : "No files here yet."}
          </p>
        )}

        {myDrafts.length > 0 && (
          <section className="gf-drafts" aria-label="Your drafts">
            <div className="gf-drafts__head">
              <h2 className="gf-drafts__title">Your drafts</h2>
              <p className="gf-drafts__sub">Only you can see these until you share them.</p>
            </div>
            <ul className="gf-list">{myDrafts.map(renderRow)}</ul>
          </section>
        )}

        {rest.length > 0 && <ul className="gf-list">{rest.map(renderRow)}</ul>}
      </div>

      {/* A quiet backdrop closes any open menu on an outside tap. */}
      {menuOpen && (
        <button
          className="gf-menu-backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(null)}
        />
      )}

      {dialog?.mode === "create" && (
        <NameDialog
          title={dialog.title}
          submitLabel="Create"
          busy={busy}
          error={actionError}
          onCancel={closeDialog}
          onSubmit={(name) => performCreate(dialog.kind, name)}
        />
      )}

      {dialog?.mode === "rename" && (
        <NameDialog
          key={dialog.row.id}
          title="Rename"
          submitLabel="Rename"
          initialValue={dialog.row.name}
          busy={busy}
          error={actionError}
          onCancel={closeDialog}
          onSubmit={(name) => patchFile(dialog.row.id, { action: "rename", name })}
        />
      )}

      {dialog?.mode === "move" && (
        <MovePicker
          placeKey={placeKey}
          placeName={activePlace?.name ?? "Files"}
          row={dialog.row}
          currentFolderId={folderId}
          busy={busy}
          error={actionError}
          onCancel={closeDialog}
          onMove={(target) => patchFile(dialog.row.id, { action: "move", folder: target })}
        />
      )}

      {dialog?.mode === "trash" && (
        <div className="gf-overlay" role="dialog" aria-modal="true" aria-label="Move to trash">
          <div className="gf-dialog">
            <h2 className="gf-dialog__title">Move to trash?</h2>
            <p className="gf-dialog__text">
              {dialog.row.mimeType === GOOGLE_MIME.folder
                ? `"${dialog.row.name}" and everything inside it will move to the trash.`
                : `"${dialog.row.name}" will move to the trash.`}{" "}
              It can be recovered for 30 days.
            </p>
            {actionError && <p className="gf-dialog__error">{actionError}</p>}
            <div className="gf-dialog__actions">
              <button className="gf-dialog__cancel" onClick={closeDialog} disabled={busy}>
                Cancel
              </button>
              <button
                className="gf-dialog__danger"
                onClick={() => patchFile(dialog.row.id, { action: "trash" })}
                disabled={busy}
              >
                {busy ? "Moving…" : "Move to trash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NameDialog({
  title,
  submitLabel,
  initialValue = "",
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  initialValue?: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initialValue);
  const trimmed = name.trim();
  return (
    <div className="gf-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <form
        className="gf-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed && !busy) onSubmit(trimmed);
        }}
      >
        <h2 className="gf-dialog__title">{title}</h2>
        <input
          className="gf-dialog__input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          autoFocus
          maxLength={150}
        />
        {error && <p className="gf-dialog__error">{error}</p>}
        <div className="gf-dialog__actions">
          <button type="button" className="gf-dialog__cancel" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="gf-dialog__submit" disabled={busy || !trimmed}>
            {busy ? "Working…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * A small folders-only browser for choosing a move destination inside the
 * same place. Reuses the list endpoint; the moved item itself is excluded so
 * a folder can't be picked into itself (deeper circularity is refused
 * server-side).
 */
function MovePicker({
  placeKey,
  placeName,
  row,
  currentFolderId,
  busy,
  error,
  onCancel,
  onMove,
}: {
  placeKey: string;
  placeName: string;
  row: FileRow;
  currentFolderId: string | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onMove: (targetFolderId: string | null) => void;
}) {
  const [pickTrail, setPickTrail] = useState<Crumb[]>([]);
  const [folders, setFolders] = useState<FileRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const seq = useRef(0);

  const pickFolderId = pickTrail.length ? pickTrail[pickTrail.length - 1].id : null;
  // Disabled when the destination is where the item already lives.
  const sameLocation = (pickFolderId ?? null) === (currentFolderId ?? null);

  useEffect(() => {
    const mySeq = ++seq.current;
    async function fetchFolders() {
      setFolders(null);
      setLoadError(null);
      try {
        const params = new URLSearchParams({ place: placeKey });
        if (pickFolderId) params.set("folder", pickFolderId);
        const res = await fetch(`/api/files/list?${params}`);
        const data = await res.json();
        if (mySeq !== seq.current) return;
        if (!res.ok) {
          setLoadError(data.error ?? "We couldn't load these folders. Please try again.");
          setFolders([]);
          return;
        }
        setFolders(
          ((data.files ?? []) as FileRow[]).filter(
            (f) => f.mimeType === GOOGLE_MIME.folder && f.id !== row.id,
          ),
        );
      } catch {
        if (mySeq !== seq.current) return;
        setLoadError("We couldn't load these folders. Please try again.");
        setFolders([]);
      }
    }
    fetchFolders();
  }, [placeKey, pickFolderId, row.id]);

  return (
    <div className="gf-overlay" role="dialog" aria-modal="true" aria-label={`Move ${row.name}`}>
      <div className="gf-dialog gf-dialog--move">
        <h2 className="gf-dialog__title">Move &ldquo;{row.name}&rdquo;</h2>
        <nav className="gf-crumbs gf-crumbs--picker" aria-label="Destination path">
          <button className="gf-crumbs__item" onClick={() => setPickTrail([])}>
            {placeName}
          </button>
          {pickTrail.map((t, i) => (
            <span key={t.id} className="gf-crumbs__seg">
              <span className="gf-crumbs__sep" aria-hidden="true">›</span>
              <button
                className="gf-crumbs__item"
                onClick={() => setPickTrail(pickTrail.slice(0, i + 1))}
              >
                {t.name}
              </button>
            </span>
          ))}
        </nav>
        <div className="gf-picker">
          {folders === null && !loadError && <p className="gf-status">Loading…</p>}
          {loadError && <p className="gf-status">{loadError}</p>}
          {folders !== null && folders.length === 0 && !loadError && (
            <p className="gf-status">No folders here.</p>
          )}
          {folders !== null &&
            folders.map((f) => (
              <button
                key={f.id}
                className="gf-picker__folder"
                onClick={() => setPickTrail([...pickTrail, { id: f.id, name: f.name }])}
              >
                <Folder size={16} strokeWidth={1.75} aria-hidden="true" />
                {f.name}
              </button>
            ))}
        </div>
        {error && <p className="gf-dialog__error">{error}</p>}
        <div className="gf-dialog__actions">
          <button className="gf-dialog__cancel" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className="gf-dialog__submit"
            onClick={() => onMove(pickFolderId)}
            disabled={busy || sameLocation}
          >
            {busy ? "Moving…" : "Move here"}
          </button>
        </div>
      </div>
    </div>
  );
}
