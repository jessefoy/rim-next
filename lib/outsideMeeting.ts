/**
 * Outside meeting rooms (2026-10-14, Jesse).
 *
 * Most online programs meet in RIM's Zoom: /session/[slug]/enter creates the
 * occurrence's meeting on a pool seat and shows hosts the Claim-Host code. A
 * few meet in someone else's room: Recovery Dharma's national room, or a
 * facilitator's own Zoom that she also shares with another group. For those,
 * `Program.outsideMeetingUrl` holds the link, and the door forwards to it after
 * its usual gates (sign-in or guest link, the time window, registration or
 * Open entry). RIM creates no meeting, takes no seat and shows no host code.
 *
 * Who reaches the outside room is three settings working together:
 *   - members through RIM (always: My Home's Join goes through the door);
 *   - the guest link (`isOpenAccess`), a RIM address to share with people
 *     who have no RIM account;
 *   - `outsideMeetingPublic`, a Join button on the public program page that
 *     goes through the door (session times hold; the link is never printed).
 *     Never on a program that takes registrations.
 *
 * Dependency-free so the editor, the routes and the pages share one rule.
 */

export type MeetingProvider = "zoom" | "meet" | "teams" | "other";

type ProgramRoom = {
  programFormat: string | null;
  outsideMeetingUrl?: string | null;
};

const MAX_URL_LENGTH = 500;

/**
 * Validate a link typed into the editor. Empty means "no outside room". Only
 * https links are accepted: the door sends people straight to whatever is
 * saved, so a javascript: or http: link must never be stored.
 */
export function cleanOutsideMeetingUrl(
  input: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== "string") return { ok: false, error: "The meeting link must be text." };
  const raw = input.trim();
  if (!raw) return { ok: true, value: null };
  if (raw.length > MAX_URL_LENGTH) {
    return { ok: false, error: "That meeting link is too long. Copy the invite link from Zoom or Google Meet and paste it again." };
  }
  if (/\s/.test(raw)) {
    return { ok: false, error: "A meeting link has no spaces. Paste only the link itself, starting with https://." };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "That doesn't look like a meeting link. It should start with https://." };
  }
  if (url.protocol !== "https:" || !url.hostname.includes(".")) {
    return { ok: false, error: "The meeting link must start with https://." };
  }
  if (url.username || url.password) {
    return { ok: false, error: "That doesn't look like a meeting link. It should start with https://." };
  }
  return { ok: true, value: url.toString() };
}

/** Which service a link belongs to, from its address. */
export function providerForUrl(url: string): MeetingProvider {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "other";
  }
  const on = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (on("zoom.us") || on("zoom.com") || on("zoomgov.com")) return "zoom";
  if (host === "meet.google.com") return "meet";
  if (on("teams.microsoft.com") || on("teams.live.com")) return "teams";
  return "other";
}

/** The outside room's link, when the program meets online in one; else null.
 *  Checked again here, so a value written by any other path (an import, a
 *  hand edit) can never send someone to an unsafe address. */
export function outsideRoomUrl(p: ProgramRoom): string | null {
  if (p.programFormat !== "virtual" && p.programFormat !== "hybrid") return null;
  if (!p.outsideMeetingUrl) return null;
  const check = cleanOutsideMeetingUrl(p.outsideMeetingUrl);
  return check.ok ? check.value : null;
}

/** The service a program meets on: RIM's own rooms are Zoom. */
export function meetingProvider(p: ProgramRoom): MeetingProvider {
  const url = outsideRoomUrl(p);
  return url ? providerForUrl(url) : "zoom";
}

const SERVICE_NAME: Record<MeetingProvider, string | null> = {
  zoom: "Zoom",
  meet: "Google Meet",
  teams: "Microsoft Teams",
  other: null,
};

/** "Zoom", "Google Meet", "Microsoft Teams", or null for another service. */
export function meetingServiceName(p: ProgramRoom): string | null {
  return SERVICE_NAME[meetingProvider(p)];
}

/** "Join on Zoom" / "Join on Google Meet" / "Join online". */
export function joinOnlineLabel(p: ProgramRoom): string {
  const name = meetingServiceName(p);
  return name ? `Join on ${name}` : "Join online";
}

/** "Online on Zoom" / "Online on Google Meet" / "Online". */
export function onlinePlaceLabel(p: ProgramRoom): string {
  const name = meetingServiceName(p);
  return name ? `Online on ${name}` : "Online";
}

/** "on Zoom" / "on Google Meet" / "online", for the middle of a sentence. */
export function onlinePhrase(p: ProgramRoom): string {
  const name = meetingServiceName(p);
  return name ? `on ${name}` : "online";
}
