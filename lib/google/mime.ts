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
