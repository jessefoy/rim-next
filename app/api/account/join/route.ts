import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { accountForFormerEmail } from "@/lib/formerEmail";
import { signIn } from "@/auth";
import { sendJoinWelcomeEmail } from "@/lib/email";
import { toProperName } from "@/lib/nameCase";
import { enrollMemberInOnboardingSeries } from "@/lib/enrollment";
import { looksAutomated, BOT_RETRY_MESSAGE } from "@/lib/botCheck";
import { checkRateLimit, getRequestIp } from "@/lib/rateLimit";
import {
  EMAIL_MAX,
  IP_SEND_MAX,
  WINDOW_SECONDS,
  signinEmailKey,
  signinIpKey,
} from "@/lib/authRateLimits";

/**
 * POST /api/account/join
 *
 * The threshold endpoint for the /join page. Distinct from /login:
 *   - /login is the existing-member door — type your email, get a code, sign in.
 *   - /join is the new-member door — name + email + community agreements first.
 *     After this endpoint runs, NextAuth's verifyRequest page handles the
 *     code-entry step the same way as any other sign-in.
 *
 * Flow:
 *   1. Validate name + email + agreement checkbox.
 *   2. If a member with this email already exists AND has agreedToTerms,
 *      gently route them to /login (no point creating a duplicate threshold).
 *   3. A new address creates the User with names + agreedToTerms: true + agreedAt.
 *      An existing account that hasn't agreed (pre-staged, or imported from the
 *      old site) is not touched: the person hasn't proved the address is
 *      theirs yet, and anyone could type it (2026-10-19 audit). They agree on
 *      /account/welcome after signing in, as they would arriving from /login.
 *   4. Trigger signIn("resend", …) so NextAuth issues the 6-digit code email.
 *      The auth.ts sendVerificationRequest branches on emailVerified — since
 *      the user has NOT yet completed a verification at this point, they
 *      receive the warm "Welcome to Rooted In Mindfulness" template, not
 *      the routine returning-member one. (Branching on agreedToTerms would
 *      misclassify them since /join sets that to true before the code is
 *      sent.)
 *   5. In after(), for a new address only, send the warm welcome letter and enroll them in the
 *      onboarding course series.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  // Before anything is written or sent: a bot would get a code email and a
  // welcome letter at a fake address (lib/botCheck.ts). A person caught by
  // mistake is asked to try again.
  if (looksAutomated(raw)) {
    console.warn("[account/join] automated sign-up refused");
    return NextResponse.json({ error: BOT_RETRY_MESSAGE }, { status: 400 });
  }
  const firstName = toProperName(typeof raw.firstName === "string" ? raw.firstName : "");
  const lastName = toProperName(typeof raw.lastName === "string" ? raw.lastName : "");
  const phone = typeof raw.phone === "string" ? raw.phone.trim() : "";
  const emailRaw = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  const agreed = raw.agreedToTerms === true;

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "Please enter your first and last name." },
      { status: 400 },
    );
  }

  // Minimal email shape check — Resend will reject anything malformed downstream
  // anyway; this catches typos before we touch the DB.
  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  if (!agreed) {
    return NextResponse.json(
      { error: "Please confirm the community care agreements to join." },
      { status: 400 },
    );
  }

  // Rate-limit BEFORE any DB writes or signIn — same keys + thresholds as the
  // NextAuth catch-all at /api/auth/signin/resend, so an attacker can't double
  // their budget by alternating between /join and /login. The /join door
  // sends two emails (sign-in code + welcome letter), so it's actually
  // higher-cost than /login per request — sharing the budget keeps abuse
  // potential equivalent.
  const ip = getRequestIp(request);
  const emailCheck = await checkRateLimit(
    signinEmailKey(emailRaw),
    EMAIL_MAX,
    WINDOW_SECONDS,
  );
  if (!emailCheck.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please try again later.", rateLimited: true },
      { status: 429 },
    );
  }
  const ipCheck = await checkRateLimit(
    signinIpKey(ip),
    IP_SEND_MAX,
    WINDOW_SECONDS,
  );
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please try again later.", rateLimited: true },
      { status: 429 },
    );
  }

  // If a fully-joined member already exists at this email, route them to
  // /login instead of duplicating the threshold ritual. We tell the client
  // gently — no error, no shame; they're already in.
  const existing = await db.user.findUnique({
    where: { email: emailRaw },
    select: { id: true, agreedToTerms: true },
  });
  if (existing?.agreedToTerms) {
    return NextResponse.json(
      {
        ok: true,
        alreadyMember: true,
        message: "It looks like you already have an account. Sign in to continue.",
      },
      { status: 200 },
    );
  }

  // A former sign-in address (lib/formerEmail.ts) belongs to an account that
  // now signs in with another address: never make a second account from it.
  // The client goes to /login's "your sign-in email has changed" page.
  if (!existing && (await accountForFormerEmail(emailRaw))) {
    return NextResponse.json({ ok: true, moved: true }, { status: 200 });
  }

  // Only a brand-new address is written here. An existing account keeps its
  // name, phone and agreement until its owner signs in and agrees on the
  // Welcome page, which also sends the welcome-back letter and enrolls them.
  const now = new Date();
  const user = existing
    ? null
    : await db.user.create({
        data: {
          email: emailRaw,
          firstName,
          lastName,
          phone: phone || null,
          agreedToTerms: true,
          agreedAt: now,
          isLegacyUnclaimed: false,
        },
        select: { id: true },
      });

  // Trigger the NextAuth sign-in code flow. redirect:false so we keep control
  // of the response (the page navigates the client to /login/check-email).
  // The Resend provider's sendVerificationRequest fires inside signIn() and
  // delivers the 6-digit code email. emailVerified is null at this point
  // (a new account, or an existing one not yet verified), so the
  // WARM sign-in-code-new-user template fires — see auth.ts:38.
  //
  // Defensive pattern mirrors app/login/page.tsx: signIn with redirect:false
  // does NOT always throw on email-send failure — it can also return an
  // error-page URL string. Both surfaces must be handled.
  let signInResult: unknown;
  let signInThrew = false;
  try {
    signInResult = await signIn("resend", { email: emailRaw, redirect: false });
  } catch (err) {
    console.error("[account/join] signIn threw", err);
    signInThrew = true;
  }
  const sendFailed =
    signInThrew ||
    !signInResult ||
    (typeof signInResult === "string" && /[?&]error=/.test(signInResult));
  if (sendFailed) {
    return NextResponse.json(
      { error: "We couldn't send the code. Please try again in a moment." },
      { status: 500 },
    );
  }

  // Welcome letter + onboarding series — fire-and-forget via after() per the
  // session 96 / 131 pattern (Vercel tears the function down once the
  // response is committed; after() keeps the work alive).
  // Only a new address gets join-welcome and the onboarding series here; an
  // existing account gets them (or welcome-back) from the Welcome page.
  if (!user) {
    // An existing account: the Welcome page after sign-in does the rest.
    return NextResponse.json({ ok: true, email: emailRaw });
  }
  const newUserId = user.id;

  after(async () => {
    try {
      await sendJoinWelcomeEmail({ to: emailRaw, firstName });
    } catch (err) {
      console.error("[account/join] welcome email failed", err);
    }
  });

  after(async () => {
    try {
      await enrollMemberInOnboardingSeries(newUserId);
    } catch (err) {
      console.error("[account/join] enrollMemberInOnboardingSeries failed", err);
    }
  });

  return NextResponse.json({ ok: true, email: emailRaw });
}
