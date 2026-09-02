import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import SignInCodeForm from "@/components/login/SignInCodeForm";

export const metadata = { title: "Enter Your Code — Rooted In Mindfulness" };

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
  searchParams: Promise<{ email?: string; resent?: string }>;
}) {
  const { email, resent } = await searchParams;

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
  const user = await db.user
    .findUnique({
      where: { email: email.toLowerCase() },
      select: { firstName: true, agreedAt: true, emailVerified: true },
    })
    .catch(() => null);

  const isFromJoin = isInPostJoinWindow(user?.agreedAt, user?.emailVerified);

  const firstName = user?.firstName?.trim() || null;

  async function resendCode(formData: FormData) {
    "use server";
    const e = (formData.get("email") as string | null)?.trim();
    if (!e) {
      redirect("/login");
    }
    // Same redirect-handling pattern as /login: signIn with redirect:false
    // does not throw on email-send failure but returns an error URL.
    let signInResult: string | undefined;
    let signInThrew = false;
    try {
      signInResult = await signIn("resend", { email: e, redirect: false });
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
    redirect(`/login/check-email?email=${encodeURIComponent(e!)}&resent=1`);
  }

  return (
    /* Session 176: off the Webflow-era classes and onto pp-. The six-box code
       input, the resend action, and the from-/join branching are unchanged. */
    <div className="pp-page">
      <section className="pp-hero pp-hero--flat pp-hero--short">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Members</p>
          <h1 className="pp-hero__title">
            {isFromJoin
              ? firstName
                ? `Almost there, ${firstName}.`
                : "Almost there."
              : "Enter your code"}
          </h1>
          <p className="pp-hero__body">
            {isFromJoin ? (
              <>
                Two things just arrived in your inbox: your sign-in code, and a short
                welcome letter. Type the code below to enter. Your code expires in 30
                minutes.
              </>
            ) : (
              <>
                We sent a 6-digit code to <span className="lg-email">{email}</span>. It
                expires in 30 minutes.
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
            <SignInCodeForm email={email} callbackUrl="/account/dashboard" />

            {/* A div, not a p: the resend action is a real <form>, and a form
                inside a <p> is invalid HTML (the browser closes the paragraph
                early and the sentence breaks apart). */}
            <div className="lg-alt">
              Didn&apos;t receive it? Check your spam folder, or{" "}
              <form action={resendCode} className="lg-inline-form">
                <input type="hidden" name="email" value={email} />
                <button type="submit" className="pp-link lg-linkbtn">
                  send a new code
                </button>
              </form>
              .
            </div>
            <p className="lg-alt lg-alt--quiet">
              Wrong email?{" "}
              <a href="/login" className="pp-link">
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
