import "server-only";
import { createSign } from "node:crypto";

/**
 * Google service-account auth — server-only.
 *
 * Backs "RIM orchestrates, Google is the file cabinet" (RIM_GoogleWorkspace.md):
 * one service account (rim-files@…iam.gserviceaccount.com) is RIM's only Google
 * identity, a Manager member of each RIM Shared Drive. No SDK — we mint the
 * RS256 JWT with node:crypto and exchange it for an access token via plain
 * `fetch`, mirroring lib/zoom.ts (no new dependency). Credentials come from
 * Vercel env and must never reach the browser or logs.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
/** Full Drive scope: the SA reads/writes only what its Shared Drive membership allows. */
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

export function googleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
}

/**
 * Read + validate the two credential env vars, with actionable errors. The
 * private key arrives with literal `\n` sequences when pasted from the JSON
 * key file — un-escape them here so callers never worry about it.
 */
function getCredentials(): { email: string; privateKey: string } {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "Google is not configured: set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in Vercel (values come from the service account's JSON key file — see RIM_GoogleWorkspace.md §7).",
    );
  }
  const privateKey = rawKey.replace(/\\n/g, "\n");
  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY doesn't look like a private key — paste the JSON key file's private_key value exactly, including the BEGIN/END lines and \\n sequences.",
    );
  }
  return { email, privateKey };
}

/** base64url without padding, per RFC 7515. */
function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * In-memory access-token cache (tokens last ~1h) — persists across requests on
 * a warm serverless instance, refetched on cold start. Same shape as
 * lib/zoom.ts; a concurrent double-fetch is harmless.
 */
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Fetch (or reuse) a Drive-scoped access token for the RIM Files service
 * account. Throws with Google's response body on failure so the diagnostic can
 * surface the real error (never the key material).
 */
export async function getGoogleAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const { email, privateKey } = getCredentials();

  const nowSec = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: email,
      scope: DRIVE_SCOPE,
      aud: TOKEN_URL,
      iat: nowSec,
      exp: nowSec + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = b64url(signer.sign(privateKey));
  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token request failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  // Guard the TTL: a missing/odd expires_in must degrade to a short-lived
  // cache entry, not a NaN that silently disables caching forever.
  const ttlMs = Number.isFinite(data.expires_in)
    ? data.expires_in * 1000
    : 5 * 60_000;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + ttlMs,
  };
  return data.access_token;
}
