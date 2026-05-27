/**
 * Shared rate-limit constants for every door that issues a sign-in code.
 *
 * Both surfaces — POST /api/auth/signin/resend (the NextAuth catch-all) and
 * POST /api/account/join (the /join threshold endpoint) — must use the SAME
 * key namespaces and SAME thresholds. If they diverge, an attacker doubles
 * their per-window budget by alternating between the two doors.
 *
 * Tuning happens here, in one place.
 *
 * Per-area engineering reference: RIM_Auth.md.
 */

/** Email-send window — 5 attempts per email per 10 minutes. */
export const EMAIL_MAX = 5;

/** Email-send IP window — 20 per IP per 10 minutes. */
export const IP_SEND_MAX = 20;

/** Code-verify IP window — 20 per IP per 10 minutes. */
export const IP_VERIFY_MAX = 20;

export const WINDOW_SECONDS = 10 * 60;

/**
 * Canonical key namespace for per-email send limits. Both /api/auth/signin/resend
 * and /api/account/join use this, so the email budget is shared across doors.
 * Caller is responsible for lowercasing + trimming the email.
 */
export function signinEmailKey(email: string): string {
  return `signin-email:${email}`;
}

/**
 * Canonical key namespace for per-IP send limits.
 */
export function signinIpKey(ip: string): string {
  return `signin-ip:${ip}`;
}

/**
 * Canonical key namespace for per-IP code-verify limits.
 */
export function verifyIpKey(ip: string): string {
  return `verify-ip:${ip}`;
}
