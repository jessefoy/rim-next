/**
 * Google Workspace MIME types — pure data, client-safe (no `server-only`), so
 * both the server (drive ops, route guards) and the client (FilesBrowser's
 * open-mode routing) key off ONE definition instead of hand-kept copies.
 */
export const GOOGLE_MIME = {
  folder: "application/vnd.google-apps.folder",
  doc: "application/vnd.google-apps.document",
  sheet: "application/vnd.google-apps.spreadsheet",
  slides: "application/vnd.google-apps.presentation",
} as const;

/** True for a Google-native editor file (Doc/Sheet/Slides) — the types that
 *  have a high-fidelity Google `/preview` embed (and no clean HTML export for
 *  Sheets/Slides). Excludes folders and uploaded binaries. */
export function isGoogleEditorMime(mimeType: string): boolean {
  return (
    mimeType === GOOGLE_MIME.doc ||
    mimeType === GOOGLE_MIME.sheet ||
    mimeType === GOOGLE_MIME.slides
  );
}

/**
 * The embeddable Google `/preview` URL for a Google-native file — Google's own
 * pixel-perfect rendering in an iframe (unlike `/edit`, `/preview` is
 * framable). Returns null for non-Google-native types (RIM streams those
 * itself). The file must carry an anyone-with-link permission for an
 * un-signed-in member's browser to load it — the caller mints a reader link.
 */
export function googlePreviewUrl(mimeType: string, fileId: string): string | null {
  const id = encodeURIComponent(fileId);
  if (mimeType === GOOGLE_MIME.doc) return `https://docs.google.com/document/d/${id}/preview`;
  if (mimeType === GOOGLE_MIME.sheet) return `https://docs.google.com/spreadsheets/d/${id}/preview`;
  if (mimeType === GOOGLE_MIME.slides) return `https://docs.google.com/presentation/d/${id}/preview`;
  return null;
}

/**
 * The upload allowlist (Slice 3) — one list so the server's Blob token scope
 * (app/api/files/upload/route.ts's allowedContentTypes) and the client's file
 * picker (FilesBrowser's <input accept>) can't drift into offering a type the
 * server would actually reject, or hiding one it would accept.
 */
export const ALLOWED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/*",
  "audio/*",
  "video/*",
  "text/*",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;
