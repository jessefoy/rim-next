/**
 * Postgres-backed fixed-window rate limiter.
 *
 * Used to defend NextAuth's signin + callback endpoints from email-bombing
 * (`signin-email:*` / `signin-ip:*`) and brute-force code-guessing
 * (`verify-ip:*`). Cross-instance enforcement via Neon — Vercel serverless
 * cold-start churn does not dilute the limit. See:
 *   - app/api/auth/[...nextauth]/route.ts — where it's called
 *   - app/api/cron/cleanup-rate-limits/route.ts — daily expired-row cleanup
 *   - prisma/migrate.mjs — `rate_limit_windows_v1` (table creation)
 */

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

export interface RateLimitResult {
  allowed: boolean;
  /** Wall-clock time when the current window expires. */
  resetAt: Date;
  /** Calls remaining in the current window (clamped to [0, max]). */
  remaining: number;
}

/**
 * Check + increment a rate-limit window in one DB call.
 *
 * Three semantic cases handled by a single upsert:
 *   1. No row exists                              → create at count=1
 *   2. Row exists and window has expired          → reset (count=1, new window)
 *   3. Row exists and window still active         → increment count
 *
 * Implementation: raw `INSERT … ON CONFLICT DO UPDATE` so the read-modify-
 * write happens atomically inside Postgres (no race window between
 * findUnique → update). The RETURNING clause gives us the post-write
 * `count` and `expiresAt` in the same round-trip.
 *
 * @param key            Unique identifier for the limit slot. Caller is
 *                       responsible for namespacing (e.g. `signin-email:foo`).
 *                       Email keys MUST be lowercased + trimmed before calling.
 * @param max            Allowed calls per window. The Nth call (where N === max)
 *                       is allowed; the (N+1)th returns `allowed: false`.
 * @param windowSeconds  Window length. Counter resets to 1 on the first call
 *                       after the previous window's `expiresAt`.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const freshExpiresAt = new Date(now.getTime() + windowSeconds * 1000);

  // Atomic UPSERT. The CASE expressions distinguish "fresh window" from
  // "still inside the existing window":
  //   - If the existing row's expiresAt <= NOW(), this is a new window:
  //     reset count to 1 and start a fresh expiresAt.
  //   - Otherwise, increment the existing count and keep the existing
  //     expiresAt (the window is rolling-fixed, not sliding).
  // The id collision shouldn't happen — `key` is the unique constraint —
  // but cuid() in the INSERT path covers the create case.
  const rows = await db.$queryRaw<
    Array<{ count: number; expiresAt: Date }>
  >`
    INSERT INTO "rate_limit_windows" ("id", "key", "count", "windowStart", "expiresAt")
    VALUES (
      ${randomUUID()},
      ${key},
      1,
      NOW(),
      ${freshExpiresAt}
    )
    ON CONFLICT ("key") DO UPDATE SET
      "count"       = CASE
        WHEN "rate_limit_windows"."expiresAt" <= NOW() THEN 1
        ELSE "rate_limit_windows"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "rate_limit_windows"."expiresAt" <= NOW() THEN NOW()
        ELSE "rate_limit_windows"."windowStart"
      END,
      "expiresAt"   = CASE
        WHEN "rate_limit_windows"."expiresAt" <= NOW() THEN ${freshExpiresAt}
        ELSE "rate_limit_windows"."expiresAt"
      END
    RETURNING "count", "expiresAt"
  `;

  // Defensive: a malformed query wouldn't return any rows, in which case
  // we fail OPEN. Rate-limiting that breaks under DB pressure should not
  // also lock everyone out of signing in.
  if (rows.length === 0) {
    return { allowed: true, resetAt: freshExpiresAt, remaining: max };
  }

  const { count, expiresAt } = rows[0];
  const allowed = count <= max;
  const remaining = Math.max(0, max - count);

  return { allowed, resetAt: expiresAt, remaining };
}

/**
 * Best-effort IP extraction for Vercel-hosted requests. Vercel populates
 * `x-forwarded-for` with the client's IP as the first comma-separated
 * entry. Falls back to `"unknown"` if the header is missing — that
 * single key still acts as a global "everything-without-an-IP" bucket,
 * which is fine for defense-in-depth.
 */
export function getRequestIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  return real?.trim() || "unknown";
}
