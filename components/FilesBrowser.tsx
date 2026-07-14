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
 * The client only ever sends a place KEY and folder id — drive resolution and
 * authorization live server-side (lib/googleFiles.ts).
 *
 * CSS prefix: gf-
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { relativeDate } from "@/lib/relativeDate";

export interface FilesPlaceLink {
  key: string;
  name: string;
  kind: "community" | "hub";
}

interface FileRow {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  modifiedBy: string | null;
}

interface Props {
  places: FilesPlaceLink[];
  initialPlaceKey: string;
  /** Cold-load folder (from the URL); its name comes back with the listing. */
  initialFolderId?: string | null;
  /** Show the places sidebar (the /account/files window). Hub tabs hide it. */
  showPlaces: boolean;
  /** The page's own path — keeps the URL shareable and feeds reader back-links. */
  basePath: string;
}

const MIME = {
  folder: "application/vnd.google-apps.folder",
  doc: "application/vnd.google-apps.document",
  sheet: "application/vnd.google-apps.spreadsheet",
  slides: "application/vnd.google-apps.presentation",
};

type OpenMode = "folder" | "reader" | "stream" | "google";

function fileKind(mime: string): { icon: LucideIcon; label: string; open: OpenMode } {
  if (mime === MIME.folder) return { icon: Folder, label: "Folder", open: "folder" };
  if (mime === MIME.doc) return { icon: FileText, label: "Document", open: "reader" };
  if (mime === MIME.sheet) return { icon: FileSpreadsheet, label: "Spreadsheet", open: "google" };
  if (mime === MIME.slides) return { icon: Presentation, label: "Presentation", open: "google" };
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
  initialFolderId = null,
  showPlaces,
  basePath,
}: Props) {
  const router = useRouter();
  const [placeKey, setPlaceKey] = useState(initialPlaceKey);
  // Breadcrumb trail below the place root. On a cold load into a subfolder
  // only that folder is known (parents aren't walked) — the root crumb still
  // returns to the top.
  const [trail, setTrail] = useState<{ id: string; name: string }[]>([]);
  const [files, setFiles] = useState<FileRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Guards out-of-order responses when someone clicks fast.
  const requestSeq = useRef(0);

  const activePlace = places.find((p) => p.key === placeKey) ?? places[0];

  const syncUrl = useCallback(
    (nextPlaceKey: string, folderId: string | null) => {
      const params = new URLSearchParams();
      if (showPlaces && nextPlaceKey !== places[0]?.key) params.set("place", nextPlaceKey);
      if (folderId) params.set("folder", folderId);
      const qs = params.toString();
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    },
    [router, basePath, showPlaces, places],
  );

  const load = useCallback(
    async (
      nextPlaceKey: string,
      folderId: string | null,
      nextTrail: { id: string; name: string }[] | "from-response",
    ) => {
      const seq = ++requestSeq.current;
      setFiles(null);
      setError(null);
      try {
        const params = new URLSearchParams({ place: nextPlaceKey });
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
        if (nextTrail === "from-response") {
          setTrail(folderId && data.folderName ? [{ id: folderId, name: data.folderName }] : []);
        } else {
          setTrail(nextTrail);
        }
      } catch {
        if (seq === requestSeq.current) {
          setError("We couldn't load these files. Please try again.");
          setFiles([]);
        }
      }
    },
    [],
  );

  useEffect(() => {
    load(initialPlaceKey, initialFolderId, "from-response");
    // Initial load only — subsequent navigation calls load() directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openPlace(key: string) {
    setPlaceKey(key);
    syncUrl(key, null);
    load(key, null, []);
  }

  function openFolder(row: FileRow) {
    const nextTrail = [...trail, { id: row.id, name: row.name }];
    syncUrl(placeKey, row.id);
    load(placeKey, row.id, nextTrail);
  }

  function openCrumb(index: number) {
    // index -1 = the place root.
    const nextTrail = index < 0 ? [] : trail.slice(0, index + 1);
    const folderId = nextTrail.length ? nextTrail[nextTrail.length - 1].id : null;
    syncUrl(placeKey, folderId);
    load(placeKey, folderId, nextTrail);
  }

  function currentUrl(): string {
    const params = new URLSearchParams();
    if (showPlaces && placeKey !== places[0]?.key) params.set("place", placeKey);
    const folderId = trail.length ? trail[trail.length - 1].id : null;
    if (folderId) params.set("folder", folderId);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  function openFile(row: FileRow) {
    const kind = fileKind(row.mimeType);
    if (kind.open === "folder") return openFolder(row);
    if (kind.open === "reader") {
      router.push(`/account/files/doc/${row.id}?from=${encodeURIComponent(currentUrl())}`);
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
            <button
              className="btn"
              onClick={() =>
                load(placeKey, trail.length ? trail[trail.length - 1].id : null, trail)
              }
            >
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
