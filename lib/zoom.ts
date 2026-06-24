/**
 * Zoom Server-to-Server OAuth + REST helpers — server-only.
 *
 * Backs the "RIM orchestrates, Zoom is the room" migration: RIM provisions Zoom
 * meetings for two licensed "pool" seats (zoom.host@ / zoom.host2@) via the
 * "RIM Sessions" S2S app. No SDK — plain `fetch` against Zoom's REST API, so no
 * new dependency. Credentials come from Vercel env (never committed).
 *
 * Slice 1a (this file's first cut): the token + a generic API helper + user
 * lookup — enough for the /admin/zoom-test connection check. Meeting
 * provisioning (create / get-fresh-start_url / add-registrant / delete) lands in
 * the next slice, once the connection + seat licenses are verified live.
 */

const ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID!;
const CLIENT_ID = process.env.ZOOM_OAUTH_CLIENT_ID!;
const CLIENT_SECRET = process.env.ZOOM_OAUTH_CLIENT_SECRET!;

const OAUTH_URL = "https://zoom.us/oauth/token";
const API_BASE = "https://api.zoom.us/v2";

/**
 * In-memory access-token cache. S2S tokens last ~1h; this persists across
 * requests on a warm serverless instance and is simply refetched on cold start.
 * A small concurrent-cold-start double-fetch is harmless (Zoom issues a fresh
 * token each call).
 */
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Fetch (or reuse) an account-credentials access token for the RIM Sessions app.
 * Throws with Zoom's response body on failure so the diagnostic can surface it.
 */
export async function getZoomAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(
    `${OAUTH_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(ACCOUNT_ID)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom token request failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

/**
 * Authenticated call against the Zoom REST API. Returns parsed JSON (or
 * `undefined` for empty 204 responses). Throws with the response body on a
 * non-2xx so callers/diagnostics see Zoom's actual error.
 */
export async function zoomApi<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getZoomAccessToken();
  // Only set a JSON content-type when there's actually a body — a content-type
  // on a bodyless GET is malformed and some gateways reject it. (Matters once
  // this helper backs the provisioning POST/PATCH/DELETE calls.)
  const hasBody = init.body != null;
  const res = await fetch(`${API_BASE}${path}`, {
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
      `Zoom API ${init.method ?? "GET"} ${path} failed (${res.status}): ${body}`,
    );
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Zoom user `type`: the seats must be 2 (Licensed) or group meetings cap at 40 min. */
export const ZOOM_USER_TYPE: Record<number, string> = {
  1: "Basic",
  2: "Licensed",
  3: "On-prem",
};

export interface ZoomUser {
  id: string;
  email: string;
  /** 1 = Basic, 2 = Licensed, 3 = On-prem. */
  type: number;
  first_name?: string;
  last_name?: string;
  /** "active" | "pending" | "inactive" — "pending" means the activation email wasn't accepted. */
  status?: string;
}

/** Look up a Zoom user by userId or email (used to resolve + verify the pool seats). */
export async function getZoomUser(idOrEmail: string): Promise<ZoomUser> {
  return zoomApi<ZoomUser>(`/users/${encodeURIComponent(idOrEmail)}`);
}
