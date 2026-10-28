import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import SignInCodeForm from "@/components/login/SignInCodeForm";
import { accountForFormerEmail, maskEmail } from "@/lib/formerEmail";
import { codeSendAllowed } from "@/lib/authRateLimits";
import { guideReturnPath } from "@/lib/guideAuth";

// no-referrer: this page can carry a sign-in code in its URL (?code=), which
// must not travel to third-party requests (fonts, images) as a Referer.
export const metadata = {
  title: "Enter Your Code - Rooted In Mindfulness",
  referrer: "no-referrer" as const,
};

// How recently a user must have agreed (and still be unverified) for us
// to treat this code-entry as the continuation of the /join threshold
// ritual. 5 minutes is well above the time it takes to submit /join,
// switch to inbox, and click back — short enough that a returning member
// who joined a long time ago doesn't accidentally get the warm "almost
// there" framing on their normal sign-in.
const POST_JOIN_WINDOW_MS = 5 * 60 * 1000;

/**
 * State-driven detector for "this user just walked through /join."
 * Lives outside the component body so the lint rule that flags
 * Date.now() during render doesn't misfire on a server component.
 */
function isInPostJoinWindow(
  agreedAt: Date | null | undefined,
  emailVerified: Date | null | undefined,
): boolean {
  if (!agreedAt || emailVerified !== null) return false;
  return Date.now() - agreedAt.getTime() < POST_JOIN_WINDOW_MS;
}

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; resent?: string; code?: string; moved?: string; next?: string }>;
}) {
  const { email, resent, code, moved, next } = await searchParams;
  // Sign-in that started on the RIM Guide's Allow page returns there.
  const guideNext = guideReturnPath(next);
  // Arrives from the email's "Sign me in from this device" button. Only a
  // well-formed six-digit code pre-fills the form; the member still taps
  // Sign in, so opening the link alone never uses the code up.
  const prefilledCode = code && /^\d{6}$/.test(code) ? code : undefined;

  // Stateless if a user lands here without an email (bookmark, direct nav).
  if (!email) {
    redirect("/login");
  }

  // Look up the User by email so we can (a) personalize the copy with
  // their firstName, and (b) detect whether they just came through /join
  // (recently-set agreedAt + still-null emailVerified). State-driven —
  // doesn't rely on query params surviving reloads or resends, so the
  // post-/join warmth persists through "send a new code" as long as the
  // user is still inside the 5-minute window.
  // Arrived from /login's moved-address button: `email` is the old address
  // the person typed, and the code went to the account's current address.
  // That address is named only masked (lib/formerEmail.ts); the code form
  // keeps the old one, and the code check maps it back on the server.
  const movedAccount =
    moved === "1" ? await accountForFormerEmail(email).catch(() => null) : null;
  const sentTo = movedAccount ? maskEmail(movedAccount.email) : email;

  const user = await db.user
    .findUnique({
      where: { email: (movedAccount?.email ?? email).toLowerCase() },
      select: { firstName: true, agreedAt: true, emailVerified: true },
    })
    .catch(() => null);

  const isFromJoin = isInPostJoinWindow(user?.agreedAt, user?.emailVerified);

  const firstName = user?.firstName?.trim() || null;

  // A member's first verified sign-in (they agreed on /join or when they
  // registered, and have never entered a code) lands on My Home with "You're
  // all set. Welcome to RIM." (Jesse, 2026-10-13). Members who haven't agreed
  // yet go through /account/welcome, which greets them itself.
  const firstArrival = !!user?.agreedAt && user.emailVerified === null;
  const callbackUrl = guideNext ?? (firstArrival ? "/account/dashboard?welcome=new" : "/account/dashboard");

  async function resendCode(formData: FormData) {
    "use server";
    const e = (formData.get("email") as string | null)?.trim().toLowerCase();
    if (!e) {
      redirect("/login");
    }
    const resendNext = guideReturnPath(formData.get("next") as string | null);
    // Send only to an account's current address: an old address resends to
    // the address it moved to, and an address with no account goes back to
    // sign-in. Fail-safe on a database error, as on /login.
    let current: { id: string } | null = null;
    let movedTo: { email: string } | null = null;
    let lookupFailed = false;
    try {
      current = await db.user.findUnique({ where: { email: e }, select: { id: true } });
      if (!current) movedTo = await accountForFormerEmail(e);
    } catch (err) {
      console.error("[check-email] Account lookup failed", err);
      lookupFailed = true;
    }
    let sendTo = e;
    let former: string | null = null;
    if (!current && !lookupFailed) {
      if (!movedTo) redirect(`/login?notMember=1&email=${encodeURIComponent(e)}`);
      sendTo = movedTo.email;
      former = e;
    }
    if (!(await codeSendAllowed(sendTo))) {
      redirect("/login/error?error=RateLimit");
    }
    // Same redirect-handling pattern as /login: signIn with redirect:false
    // does not throw on email-send failure but returns an error URL.
    let signInResult: string | undefined;
    let signInThrew = false;
    try {
      signInResult = await signIn("resend", { email: sendTo, redirect: false });
    } catch {
      signInThrew = true;
    }
    const sendFailed =
      signInThrew ||
      !signInResult ||
      (typeof signInResult === "string" && /[?&]error=/.test(signInResult));
    if (sendFailed) {
      redirect("/login?error=send-failed");
    }
    redirect(
      (former
        ? `/login/check-email?email=${encodeURIComponent(former)}&moved=1&resent=1`
        : `/login/check-email?email=${encodeURIComponent(e)}&resent=1`) +
        (resendNext ? `&next=${encodeURIComponent(resendNext)}` : ""),
    );
  }

  return (
    /* Session 176: off the Webflow-era classes and onto pp-. The six-box code
       input, the resend action, and the from-/join branching are unchanged. */
    <div className="pp-page pp-page--spine pp-page--column">
      <section className="pp-hero pp-hero--quiet">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Members</p>
          <h1 className="pp-hero__title">
            {prefilledCode
              ? "Your code is ready"
              : isFromJoin
              ? firstName
                ? `Almost there, ${firstName}.`
                : "Almost there."
              : "Enter your code"}
          </h1>
          <p className="pp-hero__body">
            {prefilledCode ? (
              <>
                We&apos;ve filled in the code we sent to{" "}
                <strong className="lg-email">{sentTo}</strong>. Sign in to continue.
              </>
            ) : isFromJoin ? (
              <>
                Two things just arrived in your inbox: your sign-in code, and a short
                welcome letter. Type the code below to enter. Your code expires in 30
                minutes.
              </>
            ) : (
              <>
                We sent a 6-digit code to {movedAccount ? "your new email, " : ""}
                <strong className="lg-email">{sentTo}</strong>. It expires in 30 minutes.
              </>
            )}
          </p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-form">
            {resent && <p className="pp-form__success">A new code has been sent.</p>}

            {/* Six-box code input — client component. Submits a single
                hidden `token` field via GET to /api/auth/callback/resend,
                same NextAuth Email-provider callback that magic-link clicks
                used to hit. */}
            <SignInCodeForm email={email} callbackUrl={callbackUrl} initialCode={prefilledCode} />

            {/* A div, not a p: the resend action is a real <form>, and a form
                inside a <p> is invalid HTML (the browser closes the paragraph
                early and the sentence breaks apart). */}
            <div className="lg-alt">
              Didn&apos;t receive it? Check your spam folder, or{" "}
              <form action={resendCode} className="lg-inline-form">
                <input type="hidden" name="email" value={email} />
                {guideNext && <input type="hidden" name="next" value={guideNext} />}
                <button type="submit" className="lg-linkbtn">
                  send a new code
                </button>
              </form>
              .
            </div>
            <p className="lg-alt lg-alt--quiet">
              Wrong email?{" "}
              <a href="/login">
                Start over
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
