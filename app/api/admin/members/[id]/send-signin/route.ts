import { NextRequest, NextResponse } from "next/server";
import { auth, signIn } from "@/auth";
import { db } from "@/lib/db";
import { checkRateLimit, getRequestIp } from "@/lib/rateLimit";
import {
  EMAIL_MAX,
  IP_SEND_MAX,
  WINDOW_SECONDS,
  signinEmailKey,
  signinIpKey,
} from "@/lib/authRateLimits";

/**
 * POST /api/admin/members/[id]/send-signin
 *
 * The admin "send this member a way in" helper — the pastoral counterpart to a
 * password. An ADMIN or REGISTRAR triggers a fresh 6-digit sign-in code to the
 * member's own email (the same signIn("resend") the /join and /login doors
 * use), so a stuck member never needs a recoverable password — there's nothing
 * to recover, and we store no secret. The code goes only to their email on
 * file. A legacy / never-verified account correctly receives the warm
 * sign-in-code-new-user variant (auth.ts branches on emailVerified).
 *
 * Shares the same rate-limit budget as the public sign-in doors, keyed on the
 * TARGET member's email + the admin's IP, so this path can't be used to widen
 * a member's per-window code budget.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const isAdmin = session?.user?.roles?.some((r) => r === "ADMIN");
  const isRegistrar = session?.user?.roles?.some((r) => r === "REGISTRAR");
  if (!isAdmin && !isRegistrar) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const member = await db.user.findUnique({
    where: { id },
    select: { email: true, archivedAt: true },
  });
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }
  if (member.archivedAt) {
    return NextResponse.json(
      { error: "This member is archived — restore them first, then they can sign in." },
      { status: 409 },
    );
  }

  const email = member.email.trim().toLowerCase();

  // Same shared budget as /join + the NextAuth catch-all — keyed on the
  // recipient's email + the admin's IP, so an admin can't widen a member's
  // per-window code budget, and a humane ceiling still applies to repeat clicks.
  const ip = getRequestIp(request);
  const emailCheck = await checkRateLimit(signinEmailKey(email), EMAIL_MAX, WINDOW_SECONDS);
  if (!emailCheck.allowed) {
    return NextResponse.json(
      {
        error:
          "This member has been sent several codes recently. Please wait a few minutes and try again.",
      },
      { status: 429 },
    );
  }
  const ipCheck = await checkRateLimit(signinIpKey(ip), IP_SEND_MAX, WINDOW_SECONDS);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in codes sent from here recently. Please wait a few minutes." },
      { status: 429 },
    );
  }

  // Defensive: signIn with redirect:false can return an error-page URL string
  // instead of throwing (mirrors the /join + /login handling).
  let signInResult: unknown;
  let signInThrew = false;
  try {
    signInResult = await signIn("resend", { email, redirect: false });
  } catch (err) {
    console.error("[admin/send-signin] signIn threw", err);
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

  return NextResponse.json({ ok: true, email });
}
