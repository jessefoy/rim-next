import { handlers } from "@/auth";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, getRequestIp } from "@/lib/rateLimit";
import {
  EMAIL_MAX,
  IP_SEND_MAX,
  IP_VERIFY_MAX,
  WINDOW_SECONDS,
  signinEmailKey,
  signinIpKey,
  verifyIpKey,
} from "@/lib/authRateLimits";

/**
 * NextAuth catch-all route — wraps POST with rate-limiting before
 * delegating to the standard handler. Two surfaces matter:
 *
 *   POST /api/auth/signin/resend     — triggers the sign-in code email send.
 *                                       Limited per-email (anti-bomb) AND
 *                                       per-IP (anti-bot).
 *   POST /api/auth/callback/resend   — verifies a submitted code.
 *                                       Limited per-IP (anti-brute-force).
 *
 * Other auth paths (CSRF, session, signout, provider listing) pass through
 * untouched. GET is also untouched — its endpoints are read-only and don't
 * carry an abuse vector worth limiting.
 *
 * The /join door (POST /api/account/join) also calls signIn() internally and
 * shares the same rate-limit keys via lib/authRateLimits — alternating
 * between /join and /login does NOT double an attacker's budget.
 *
 * Defense-in-depth choice (session 131): Postgres-backed instead of
 * Upstash/in-memory. Cross-instance enforcement on Vercel without a new
 * external service. Sign-in volume at RIM is low enough that the ~5–10ms
 * DB round-trip is negligible. See lib/rateLimit.ts.
 */

/** Redirect helper — keeps the calm error page contract intact. */
function rateLimitResponse(reqUrl: string): Response {
  const url = new URL("/login/error", reqUrl);
  url.searchParams.set("error", "RateLimit");
  return NextResponse.redirect(url, 303);
}

export const GET = handlers.GET;

export async function POST(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // ── Email-send path (signin/resend) ─────────────────────────────────────
  if (path.endsWith("/signin/resend")) {
    const ip = getRequestIp(req);

    // The signin POST body is URL-encoded form data carrying the `email`
    // field. Clone before reading so the original body stream stays
    // intact for NextAuth's handler.
    let email: string | null = null;
    try {
      const form = await req.clone().formData();
      const raw = form.get("email");
      if (typeof raw === "string") {
        email = raw.toLowerCase().trim();
      }
    } catch {
      // Body parse failure — fall through to IP-only limiting. NextAuth
      // will reject the request itself if the body is malformed.
    }

    // Per-email check (skip when we couldn't parse one — IP gate still applies).
    if (email && email.length > 0) {
      const emailCheck = await checkRateLimit(
        signinEmailKey(email),
        EMAIL_MAX,
        WINDOW_SECONDS,
      );
      if (!emailCheck.allowed) {
        return rateLimitResponse(req.url);
      }
    }

    // Per-IP check.
    const ipCheck = await checkRateLimit(
      signinIpKey(ip),
      IP_SEND_MAX,
      WINDOW_SECONDS,
    );
    if (!ipCheck.allowed) {
      return rateLimitResponse(req.url);
    }
  }

  // ── Code-verify path (callback/resend) ─────────────────────────────────
  if (path.endsWith("/callback/resend")) {
    const ip = getRequestIp(req);
    const ipCheck = await checkRateLimit(
      verifyIpKey(ip),
      IP_VERIFY_MAX,
      WINDOW_SECONDS,
    );
    if (!ipCheck.allowed) {
      return rateLimitResponse(req.url);
    }
  }

  return handlers.POST(req);
}
