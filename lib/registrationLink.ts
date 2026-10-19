import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * A signed key for one registration, carried by the waitlist-approval and
 * dana-reminder emails so a guest who isn't signed in can finish it from the
 * link (/programs/[slug]/register?r=<id>&t=<key>). The id alone is not a key:
 * the registration form returns it to whoever submits, so an unsigned link
 * would show anyone the details of the account behind an email they typed
 * (2026-10-19 review). Only RIM can make the key; nothing else returns it.
 */
function keyFor(registrationId: string): string | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(`registration-resume:${registrationId}`).digest("base64url").slice(0, 32);
}

export function registrationResumeKey(registrationId: string): string | null {
  return keyFor(registrationId);
}

export function registrationResumeKeyValid(registrationId: string, key: string | undefined): boolean {
  const expected = keyFor(registrationId);
  // The key's own shape first: a same-length key with other characters would
  // differ in bytes and make timingSafeEqual throw.
  if (!expected || !key || !/^[A-Za-z0-9_-]{32}$/.test(key)) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(key));
}
