import "server-only";
import { timingSafeEqual } from "crypto";

/**
 * The RIM Guide connector's address key (2026-10-27): the connector lives at
 * /api/guide-mcp/<GUIDE_CONNECTOR_KEY>, so only RIM's Claude workspace knows
 * where it is. Each person also signs in (lib/guideAuth.ts); the key alone
 * opens nothing.
 */
export function keyMatches(given: string): boolean {
  const expected = process.env.GUIDE_CONNECTOR_KEY?.trim();
  if (!expected || expected.length < 24) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
