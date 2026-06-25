/**
 * Session identity helpers — pure, no media-SDK dependency. Shared by the Zoom
 * entry (and formerly the in-browser LiveKit room). Extracted from the old
 * lib/livekit.ts so they survive the LiveKit retirement (session 159).
 */

/**
 * Display name for a participant in a session: the given name (honoring a
 * preferredName when set — matching the app's `preferredName || firstName`
 * convention) plus the last INITIAL — "Nancy L." Falls back to the provided
 * fallback when no name fields are populated. A last initial (not the full
 * surname) keeps a nameplate / roster row legible while staying a real name,
 * not anonymous. The global `session.user.name` stays first-name-only (nav
 * greetings etc.); this is a session display choice.
 */
export function sessionDisplayName(
  u: { firstName?: string | null; lastName?: string | null; preferredName?: string | null } | null | undefined,
  fallback: string,
): string {
  const given = (u?.preferredName || u?.firstName || "").trim();
  const family = (u?.lastName || "").trim();
  const initial = family ? `${family[0].toUpperCase()}.` : "";
  const name = [given, initial].filter(Boolean).join(" ");
  return name || fallback;
}

/**
 * Per-session scope key: `${slug}-${YYYY-MM-DD}`. Used as the SessionBan scope
 * (and historically the LiveKit room name). Every program gets a fresh key per
 * occurrence.
 *
 * NOTE: the date suffix is sliced from the ISO `sessionDate`, a UTC instant — so
 * for an evening CT session the suffix is the *next* calendar day. Cosmetic only
 * (it's a stable scoping key): every caller derives it from the same canonical
 * sessionDate, so no session is ever split. (Audit TG-3.)
 */
export function roomNameForProgram(slug: string, sessionDate?: string): string {
  if (sessionDate) {
    const d = sessionDate.slice(0, 10);
    return `${slug}-${d}`;
  }
  return slug;
}
