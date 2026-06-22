import crypto from "node:crypto";
import { put } from "@vercel/blob";

/**
 * ─── ONLYOFFICE INTEGRATION ───────────────────────────────────────────────
 * Self-hosted OnlyOffice Document Server (infra: RIM_OnlyOffice.md). RIM mints
 * every editing session: it builds a JWT-signed editor config (so the document
 * server trusts the document URL, permissions, and identity), and verifies the
 * JWT-signed save callback the server posts back. The shared secret is the same
 * value as the container's `JWT_SECRET`.
 *
 * Files live in RIM's storage; OnlyOffice fetches each doc through a short-lived
 * token-gated download endpoint and posts edits to the callback — so access
 * control stays in RIM, never in the document server.
 *
 * HS256 is signed/verified with node:crypto (no dependency) — OnlyOffice tokens
 * are plain HS256, so the built-in HMAC is sufficient and avoids adding a lib.
 * ──────────────────────────────────────────────────────────────────────────
 */

const ONLYOFFICE_URL = (process.env.ONLYOFFICE_URL ?? "").trim().replace(/\/$/, "");
const ONLYOFFICE_JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET ?? "";
const BASE_URL = (process.env.NEXTAUTH_URL ?? "http://localhost:3000")
  .trim()
  .replace(/\/$/, "");

/** True only when both the server URL and the shared secret are configured. */
export function onlyOfficeConfigured(): boolean {
  return Boolean(ONLYOFFICE_URL && ONLYOFFICE_JWT_SECRET);
}

/** The browser loads the editor bootstrap script from here. */
export function onlyOfficeApiJsUrl(): string {
  return `${ONLYOFFICE_URL}/web-apps/apps/api/documents/api.js`;
}

/**
 * True if `candidate` is served by the configured document server. The save
 * callback's edited-file URL must originate there — an SSRF guard before RIM
 * fetches it server-side.
 */
export function isDocumentServerUrl(candidate: string): boolean {
  try {
    return (
      Boolean(ONLYOFFICE_URL) &&
      new URL(candidate).origin === new URL(ONLYOFFICE_URL).origin
    );
  } catch {
    return false;
  }
}

/**
 * Deploy-relative base URL from the incoming request (preview-safe). Vercel
 * previews serve on their own domain; building the callback / download / template
 * URLs from the request — not a fixed NEXTAUTH_URL — keeps the save loop on the
 * same deployment the editor was opened from.
 */
export function requestBaseUrl(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return host ? `${proto}://${host}` : BASE_URL;
}

function requireSecret(): string {
  if (!ONLYOFFICE_JWT_SECRET) {
    throw new Error("ONLYOFFICE_JWT_SECRET environment variable is not set");
  }
  return ONLYOFFICE_JWT_SECRET;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Sign a payload as an HS256 JWT (the editor config token + download tokens). */
export function signOnlyOfficeToken(
  payload: Record<string, unknown>,
  expiresInSec = 3600,
): string {
  const secret = requireSecret();
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSec }));
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

/** Verify an HS256 JWT; return its payload, or null if invalid/expired. */
export function verifyOnlyOfficeToken<T = Record<string, unknown>>(
  token: string,
): T | null {
  try {
    const secret = requireSecret();
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${body}`)
      .digest("base64url");
    const got = Buffer.from(sig);
    const want = Buffer.from(expected);
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & {
      exp?: number;
    };
    if (typeof payload.exp === "number" && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// ── Office-type mapping ─────────────────────────────────────────────────────
const CELL = new Set(["xlsx", "xls", "ods", "csv"]);
const SLIDE = new Set(["pptx", "ppt", "odp"]);

export type OnlyOfficeDocType = "word" | "cell" | "slide";

function normalizeExt(fileType: string): string {
  return fileType.toLowerCase().replace(/^\./, "");
}

/** docx → word, xlsx → cell, pptx → slide (defaults to word). */
export function documentTypeForFileType(fileType: string): OnlyOfficeDocType {
  const ext = normalizeExt(fileType);
  if (CELL.has(ext)) return "cell";
  if (SLIDE.has(ext)) return "slide";
  return "word";
}

// ── Blank-file seeding (new office docs) ────────────────────────────────────
const EXT_FOR_OFFICE_FILETYPE: Record<string, string> = {
  DOC: "docx",
  SHEET: "xlsx",
  SLIDE: "pptx",
  FORM: "docx",
};

/** Office-file extension for a `HubDocument.fileType` enum value. */
export function officeExtForFileType(fileType: string): string {
  return EXT_FOR_OFFICE_FILETYPE[fileType] ?? "docx";
}

/**
 * Seed a new OnlyOffice document with a blank office file: fetch the committed
 * blank template (`public/onlyoffice-templates/blank.<ext>`), store it in Blob
 * at the doc's v0 path, and return the blob URL for the doc's `storageKey`.
 */
export async function seedBlankOfficeFile(
  documentId: string,
  fileType: string,
  baseUrl: string = BASE_URL,
): Promise<string> {
  const ext = officeExtForFileType(fileType);
  const res = await fetch(`${baseUrl || BASE_URL}/onlyoffice-templates/blank.${ext}`);
  if (!res.ok) throw new Error(`blank template fetch failed (${res.status}) for .${ext}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const { url } = await put(`hub-docs/${documentId}/v0.${ext}`, buffer, {
    access: "public",
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return url;
}

// ── Download token (OnlyOffice fetches the file *through* RIM) ───────────────
const DOWNLOAD_SCOPE = "onlyoffice-download";

export function verifyDownloadToken(token: string, documentId: string): boolean {
  const payload = verifyOnlyOfficeToken<{ documentId?: string; scope?: string }>(token);
  return Boolean(
    payload && payload.scope === DOWNLOAD_SCOPE && payload.documentId === documentId,
  );
}

// ── Editor config ───────────────────────────────────────────────────────────
export interface EditorConfigInput {
  documentId: string;
  version: number;
  fileType: string; // "docx" | "xlsx" | "pptx" (dot optional)
  title: string;
  canEdit: boolean;
  user: { id: string; name: string };
  lang?: string;
}

/**
 * Build the JWT-signed config handed to `DocsAPI.DocEditor` in the browser.
 *
 * `document.key` is `${id}-${version}` — it MUST change whenever the file
 * changes, or OnlyOffice serves a stale cached copy (the classic integration
 * trap). The save callback bumps `version`, so the next open gets a fresh key.
 *
 * `document.url` and `callbackUrl` point back at RIM (reached by the document
 * server, not the browser) — the download is token-gated, the callback
 * JWT-verified. The token signs the config so the document server trusts it.
 */
export function buildEditorConfig(input: EditorConfigInput, baseUrl: string = BASE_URL) {
  const base = baseUrl || BASE_URL;
  // Short-lived: OnlyOffice fetches the file immediately on editor load, so the
  // embedded download capability shouldn't outlive that by much.
  const downloadToken = signOnlyOfficeToken(
    { documentId: input.documentId, scope: DOWNLOAD_SCOPE },
    300,
  );
  const documentUrl = `${base}/api/onlyoffice/download/${input.documentId}?token=${encodeURIComponent(downloadToken)}`;
  const callbackUrl = `${base}/api/onlyoffice/callback`;

  const config: Record<string, unknown> = {
    documentType: documentTypeForFileType(input.fileType),
    document: {
      fileType: normalizeExt(input.fileType),
      key: `${input.documentId}-${input.version}`,
      title: input.title,
      url: documentUrl,
      permissions: {
        edit: input.canEdit,
        comment: input.canEdit,
        review: input.canEdit,
        fillForms: input.canEdit,
        download: true,
        print: true,
      },
    },
    editorConfig: {
      mode: input.canEdit ? "edit" : "view",
      callbackUrl,
      lang: input.lang ?? "en",
      user: { id: input.user.id, name: input.user.name },
    },
  };

  // OnlyOffice verifies this token against the config it receives.
  const token = signOnlyOfficeToken(config);
  return {
    config: { ...config, token },
    apiJsUrl: onlyOfficeApiJsUrl(),
    documentServerUrl: ONLYOFFICE_URL,
  };
}
