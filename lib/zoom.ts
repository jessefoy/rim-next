/**
 * Zoom Server-to-Server OAuth + REST helpers — server-only.
 *
 * Backs the "RIM orchestrates, Zoom is the room" migration: RIM provisions Zoom
 * meetings for two licensed "pool" seats (zoom.host@ / zoom.host2@) via the
 * "RIM Sessions" S2S app. No SDK — plain `fetch` against Zoom's REST API, so no
 * new dependency. Credentials come from Vercel env (never committed).
 *
 * Contents: S2S access token (cached) + a generic REST helper, user lookup,
 * meeting provisioning (create / get-fresh-host-link / add-registrant / delete),
 * and the pool-seat host-key setter for own-name hosting.
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
    // Bounded: seat provisioning calls Zoom while holding RIM's seat lock, so
    // a stalled request must fail (and show "couldn't reach Zoom") rather than
    // hold everyone else's entry behind it.
    signal: init.signal ?? AbortSignal.timeout(10_000),
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

// ── Meeting provisioning (Slice 1b) ──────────────────────────────────────────
// One Zoom meeting per session occurrence, created just-in-time on a free pool
// seat. RIM keeps the orchestration; these are the thin Zoom primitives.

export interface CreateMeetingOptions {
  /** The pool seat that will own/host the meeting (Zoom userId or email). */
  seatUserId: string;
  topic: string;
  /** ISO 8601 start time. */
  startTime: string;
  durationMinutes: number;
  /** Defaults to America/Chicago (RIM's timezone). */
  timezone?: string;
  /** When true, auto-records audio-only to the cloud (per-session record flag). */
  recordToCloud?: boolean;
}

export interface ZoomMeeting {
  /** Numeric meeting id. */
  id: number;
  host_id: string;
  topic: string;
  /** Host-launch link (carries a ZAK, expires ~2h from CREATION) — fetch fresh just-in-time. */
  start_url: string;
  /** The standard join link everyone uses (no per-person registration). */
  join_url: string;
  start_time?: string;
  duration?: number;
  /** Meeting settings (partial) — approval_type 2 = no registration form. */
  settings?: { approval_type?: number };
  /** "waiting" | "started" (people are in it) | "finished". */
  status?: string;
}

/**
 * Create a scheduled meeting on a pool seat. RIM defaults: camera off + muted on
 * entry (the greenroom feel), join-before-host on (people gather before a host
 * claims), no registration (approval_type 2: everyone uses the standard join
 * link and types their own name), telephony + VoIP audio (enables dial-in), and
 * cloud recording when requested (audio-only is a seat-level Zoom setting).
 */
export async function createMeeting(opts: CreateMeetingOptions): Promise<ZoomMeeting> {
  return zoomApi<ZoomMeeting>(
    `/users/${encodeURIComponent(opts.seatUserId)}/meetings`,
    {
      method: "POST",
      body: JSON.stringify({
        topic: opts.topic,
        type: 2, // scheduled
        start_time: opts.startTime,
        duration: opts.durationMinutes,
        timezone: opts.timezone ?? "America/Chicago",
        settings: {
          host_video: false,
          participant_video: false,
          join_before_host: true,
          mute_upon_entry: true,
          waiting_room: false,
          approval_type: 2, // no registration — everyone joins via the standard link, by name
          audio: "both", // VoIP + dial-in
          auto_recording: opts.recordToCloud ? "cloud" : "none",
        },
      }),
    },
  );
}

/**
 * Fetch a meeting. Zoom regenerates `start_url` (with a fresh ~2h ZAK) on every
 * GET, so this is how we mint the just-in-time no-login host link at click time.
 */
export async function getMeeting(meetingId: number | string): Promise<ZoomMeeting> {
  return zoomApi<ZoomMeeting>(`/meetings/${encodeURIComponent(String(meetingId))}`);
}

export interface RegistrantResult {
  registrant_id: string;
  id: number;
  /** The per-person join link that carries the registrant's name into the room. */
  join_url: string;
}

/**
 * Add a registrant so a member joins under their real name with no Zoom account.
 * Returns that registrant's unique `join_url`.
 */
export async function addMeetingRegistrant(
  meetingId: number | string,
  registrant: { email: string; firstName: string; lastName?: string },
): Promise<RegistrantResult> {
  return zoomApi<RegistrantResult>(`/meetings/${encodeURIComponent(String(meetingId))}/registrants`, {
    method: "POST",
    body: JSON.stringify({
      email: registrant.email,
      first_name: registrant.firstName,
      last_name: registrant.lastName ?? "",
    }),
  });
}

/** Turn cloud auto-recording on or off for an existing meeting (PATCH settings only). */
export async function setMeetingAutoRecording(
  meetingId: number | string,
  recordToCloud: boolean,
): Promise<void> {
  await zoomApi(`/meetings/${encodeURIComponent(String(meetingId))}`, {
    method: "PATCH",
    body: JSON.stringify({ settings: { auto_recording: recordToCloud ? "cloud" : "none" } }),
  });
}

/** Delete a meeting (teardown on format change / program delete / occurrence cancel). */
export async function deleteMeeting(meetingId: number | string): Promise<void> {
  await zoomApi(`/meetings/${encodeURIComponent(String(meetingId))}`, { method: "DELETE" });
}

// Per-process cache so we don't re-PATCH a seat's host key on every host entry.
const hostKeyEnsured = new Set<string>();

/**
 * Ensure a pool seat's 6-digit host key is set to `hostKey`, so a host who
 * joined under their own name can "Claim Host" with it. Idempotent + cached per
 * process. PATCH sets only host_key (partial update). The owning seat's host key
 * is what Zoom's Claim-Host prompt checks for that seat's meetings.
 */
export async function ensureSeatHostKey(userId: string, hostKey: string): Promise<void> {
  const cacheKey = `${userId}:${hostKey}`;
  if (hostKeyEnsured.has(cacheKey)) return;
  await zoomApi(`/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({ host_key: hostKey }),
  });
  hostKeyEnsured.add(cacheKey);
}
