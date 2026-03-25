/**
 * LiveKit server utilities — token generation and room management.
 * Server-only (uses API secret).
 */

import { AccessToken } from "livekit-server-sdk";

const API_KEY = process.env.LIVEKIT_API_KEY!;
const API_SECRET = process.env.LIVEKIT_API_SECRET!;

/**
 * Generate a JWT token for a user to join a LiveKit room.
 *
 * @param userId   — unique user ID (used as identity)
 * @param userName — display name shown in the room
 * @param roomName — the room to join (created on-demand by LiveKit)
 * @param isHost   — if true, grants roomAdmin (mute, remove, etc.)
 */
export async function createRoomToken(
  userId: string,
  userName: string,
  roomName: string,
  isHost: boolean,
): Promise<string> {
  const token = new AccessToken(API_KEY, API_SECRET, {
    identity: userId,
    name: userName,
    ttl: "6h",
  });
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: isHost,
    canUpdateOwnMetadata: true,
  });
  return token.toJwt();
}

/**
 * Generate a room name for a program session.
 * Recurring programs reuse the same room each week.
 * One-time programs include the date.
 */
export function roomNameForProgram(slug: string, sessionDate?: string): string {
  if (sessionDate) {
    // Include date for specificity: "essential-dharma-study-2026-03-25"
    const d = sessionDate.slice(0, 10);
    return `${slug}-${d}`;
  }
  return slug;
}
