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
