"use client";

/**
 * FilesBrowser — the Finder (RIM_GoogleWorkspace.md, Slice 2).
 *
 * One component, two doors: the system-wide /account/files window (places
 * sidebar: Community + team drives) and the per-hub Files tab (locked to that
 * hub's drive). Live view of the Shared Drive — folders-first rows, breadcrumb
 * path, drill-down on phones. Reading opens inside RIM; editing opens the real
 * Google editor in a new tab via the gated open route.
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
import {
  File,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { GOOGLE_MIME } from "@/lib/google/mime";
import { relativeDate } from "@/lib/relativeDate";

export interface FilesPlaceLink {
  key: string;
  name: string;
}

interface FileRow {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  modifiedBy: string | null;
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
  // The trail a click intends, carried across the router navigation (names
  // aren't in the URL). Consumed by the load effect when it matches folderId.
  const pendingTrail = useRef<Crumb[] | null>(null);
  // Guards out-of-order responses when someone clicks fast.
  const requestSeq = useRef(0);

  const activePlace = places.find((p) => p.key === placeKey) ?? places[0];

  function buildUrl(nextPlaceKey: string, nextFolderId: string | null): string {
    const params = new URLSearchParams();
    if (showPlaces && nextPlaceKey !== defaultKey) params.set("place", nextPlaceKey);
    if (nextFolderId) params.set("folder", nextFolderId);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setFiles(null);
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
    const kind = fileKind(row.mimeType);
    if (kind.open === "folder") return openFolder(row);
    if (kind.open === "reader") {
      const back = buildUrl(placeKey, folderId);
      router.push(`/account/files/doc/${row.id}?from=${encodeURIComponent(back)}`);
      return;
    }
    const href =
      kind.open === "stream" ? `/api/files/stream/${row.id}` : `/api/files/open/${row.id}`;
    window.open(href, "_blank", "noopener");
  }

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

        {files !== null && files.length > 0 && (
          <ul className="gf-list">
            {files.map((row) => {
              const kind = fileKind(row.mimeType);
              const Icon = kind.icon;
              return (
                <li key={row.id}>
                  <button className="gf-row" onClick={() => openFile(row)}>
                    <Icon
                      size={18}
                      strokeWidth={1.75}
                      className={`gf-row__icon${kind.open === "folder" ? " gf-row__icon--folder" : ""}`}
                      aria-hidden="true"
                    />
                    <span className="gf-row__name">{row.name}</span>
                    <span className="gf-row__kind">{kind.label}</span>
                    <span className="gf-row__meta">
                      {row.modifiedTime ? `Updated ${relativeDate(row.modifiedTime)}` : ""}
                      {row.modifiedBy ? ` · ${row.modifiedBy}` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
