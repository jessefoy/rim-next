import { handlers } from "@/auth";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, getRequestIp } from "@/lib/rateLimit";

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
 * Defense-in-depth choice (session 131): Postgres-backed instead of
 * Upstash/in-memory. Cross-instance enforcement on Vercel without a new
 * external service. Sign-in volume at RIM is low enough that the ~5–10ms
 * DB round-trip is negligible. See lib/rateLimit.ts.
 *
 * Thresholds tuned for RIM's audience — a typing-error retry should never
 * trip them, but a determined attacker is throttled hard. Adjust here as
 * traffic patterns dictate.
 */

// Email-send window: 5 attempts per email per 10 minutes.
// Real-user pattern: 1 send, maybe 1 retry. 5 leaves slack for "typed wrong
// email, retried, hit spam folder, requested again" without locking out.
const EMAIL_MAX = 5;

// Email-send IP window: 20 per IP per 10 minutes.
// Lets a shared-IP office (corporate gateway, sangha center) sign in several
// users in a row; throttles a botnet hammering distinct addresses.
const IP_SEND_MAX = 20;

// Code-verify IP window: 20 per IP per 10 minutes.
// At 20/10min, exhausting 1M six-digit codes takes ~350 days — versus
// instant without a limit. Combined with the 30-min code expiry this
// makes a single-code brute force economically dead.
const IP_VERIFY_MAX = 20;

const WINDOW_SECONDS = 10 * 60;

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
        `signin-email:${email}`,
        EMAIL_MAX,
        WINDOW_SECONDS,
      );
      if (!emailCheck.allowed) {
        return rateLimitResponse(req.url);
      }
    }

    // Per-IP check.
    const ipCheck = await checkRateLimit(
      `signin-ip:${ip}`,
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
      `verify-ip:${ip}`,
      IP_VERIFY_MAX,
      WINDOW_SECONDS,
    );
    if (!ipCheck.allowed) {
      return rateLimitResponse(req.url);
    }
  }

  return handlers.POST(req);
}
