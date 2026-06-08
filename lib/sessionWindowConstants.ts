/**
 * Session-entry timing — the single source of truth, shared by:
 *   - the server token gate          (lib/sessionWindow.ts)
 *   - the member dashboard's tiers    (app/account/(authenticated)/dashboard/page.tsx)
 *   - the Scheduler "Enter room" link (components/HubScheduleClient.tsx)
 *
 * Keep this module free of server-only imports (no db, no next/server, no
 * "server-only") so the client bundle can import it too. Plain numbers only.
 *
 * The model (session 141):
 *   EARLY_OPEN_MIN       — earliest anyone can enter. The gate opens here, the
 *                          assigned host/teacher gets their dashboard "Enter as
 *                          host" prep window here, and the Scheduler "Enter
 *                          room" link appears here. 30 min before start —
 *                          host prep + emergency entry.
 *   MEMBER_JOIN_MIN      — when a regular member's dashboard flips to "Join
 *                          now". 10 min before start. Dashboard-only: the gate
 *                          itself opens at EARLY_OPEN_MIN for everyone, so this
 *                          tier is a UX guideline, not a hard boundary.
 *   LATE_GRACE_MIN       — how long after the session's end the room stays
 *                          reachable (stragglers / wrap-up). 30 min.
 *   FALLBACK_DURATION_MIN — assumed session length when a program has no
 *                          endDatetime. 90 min.
 */
export const EARLY_OPEN_MIN = 30;
export const MEMBER_JOIN_MIN = 10;
export const LATE_GRACE_MIN = 30;
export const FALLBACK_DURATION_MIN = 90;
