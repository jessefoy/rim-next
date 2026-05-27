import { handlers } from "@/auth";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
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

/**
 * Redirect helper for the not-a-member case. Mirrors the /login server
 * action's behavior: lands the user on the warm not-found panel with their
 * email carried through to /join.
 */
function notMemberResponse(reqUrl: string, email: string): Response {
  const url = new URL("/login", reqUrl);
  url.searchParams.set("notMember", "1");
  url.searchParams.set("email", email);
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

    // Membership existence check. The /login server action already does
    // this BEFORE calling signIn() in-process, so form submissions short-
    // circuit there. This catch-all check protects every OTHER path that
    // could trigger a code send via the HTTP endpoint — direct external
    // POSTs, scripted probes, or any future caller. With both checks in
    // place, a User row cannot be created via the /signin/resend → callback
    // chain without the visitor having an existing membership.
    //
    // Fail-safe on DB error: if the lookup throws, fall through to the
    // standard handler. Better to send a code to a real member during a
    // transient DB blip than to lock them out entirely. The
    // (authenticated)/ layout still gates dashboard access on
    // agreedToTerms, so the worst case is one extra User row that the
    // 48h cleanup cron will sweep.
    if (email && email.length > 0) {
      let existing: { id: string } | null = null;
      let lookupFailed = false;
      try {
        existing = await db.user.findUnique({
          where: { email },
          select: { id: true },
        });
      } catch (err) {
        console.error("[auth catch-all] User existence check failed", err);
        lookupFailed = true;
      }
      if (!existing && !lookupFailed) {
        return notMemberResponse(req.url, email);
      }
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
