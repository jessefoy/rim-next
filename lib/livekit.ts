/**
 * LiveKit server utilities — token generation and room management.
 * Server-only (uses API secret).
 */

import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";

const API_KEY = process.env.LIVEKIT_API_KEY!;
const API_SECRET = process.env.LIVEKIT_API_SECRET!;

export interface TokenPermissions {
  /** Grants mute/remove/end-room capability. True for Session Host and Co-host. */
  roomAdmin: boolean;
  /** Allow screen-share publishing. True for Session Host only. */
  canShareScreen: boolean;
}

/**
 * Generate a JWT token for a user to join a LiveKit room.
 *
 * Permission tiers (see lib/livekitAuth.ts::resolveSessionRole):
 *   Session Host → roomAdmin + canShareScreen
 *   Co-host      → roomAdmin only
 *   Participant  → neither; can publish mic + camera only
 */
export async function createRoomToken(
  userId: string,
  userName: string,
  roomName: string,
  permissions: TokenPermissions,
  metadata?: string,
): Promise<string> {
  const token = new AccessToken(API_KEY, API_SECRET, {
    identity: userId,
    name: userName,
    ttl: "6h",
    metadata,
  });
  const canPublishSources = permissions.canShareScreen
    ? [
        TrackSource.MICROPHONE,
        TrackSource.CAMERA,
        TrackSource.SCREEN_SHARE,
        TrackSource.SCREEN_SHARE_AUDIO,
      ]
    : [TrackSource.MICROPHONE, TrackSource.CAMERA];
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishSources,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: permissions.roomAdmin,
    canUpdateOwnMetadata: true,
  });
  return token.toJwt();
}

/**
 * Display name for a participant in the session room: the given name (honoring
 * a preferredName when set — matching the app's `preferredName || firstName`
 * convention) plus the last name. Falls back to the provided fallback when no
 * name fields are populated. Used for the LiveKit participant `name` (tiles +
 * roster) and the chat sender name, so the room shows full names rather than
 * first name only. The global `session.user.name` stays first-name-only (nav
 * greetings etc.); full names are a session-room display choice.
 */
export function sessionDisplayName(
  u: { firstName?: string | null; lastName?: string | null; preferredName?: string | null } | null | undefined,
  fallback: string,
): string {
  const given = (u?.preferredName || u?.firstName || "").trim();
  const family = (u?.lastName || "").trim();
  const full = [given, family].filter(Boolean).join(" ");
  return full || fallback;
}

/**
 * Per-session room name: `${slug}-${YYYY-MM-DD}`. Every program (drop-ins
 * included) gets a fresh room per occurrence, so chat scopes per session.
 *
 * NOTE: the date suffix is sliced from the ISO `sessionDate`, which is a UTC
 * instant — so for an evening CT session the suffix is the *next* calendar day
 * (an 8 PM CT sit on the 9th → `slug-…-10`). Cosmetic only (logs / the LiveKit
 * console): every caller derives the name from the same canonical sessionDate,
 * so no session is ever split. (Audit TG-3.)
 */
export function roomNameForProgram(slug: string, sessionDate?: string): string {
  if (sessionDate) {
    const d = sessionDate.slice(0, 10);
    return `${slug}-${d}`;
  }
  return slug;
}

/**
 * End a session by deleting the LiveKit room.
 * All participants are immediately disconnected.
 * Requires roomAdmin permission (host/admin).
 */
export async function endRoom(roomName: string): Promise<void> {
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL!;
  // RoomServiceClient needs the HTTP URL, not WebSocket
  const httpUrl = wsUrl.replace("wss://", "https://");
  const svc = new RoomServiceClient(httpUrl, API_KEY, API_SECRET);
  await svc.deleteRoom(roomName);
}
