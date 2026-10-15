import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { accountForFormerEmail, maskEmail } from "@/lib/formerEmail";
import { codeSendAllowed } from "@/lib/authRateLimits";

export const metadata = { title: "Sign in - Rooted In Mindfulness" };

/**
 * Send a sign-in code to `email` and continue to the code page. Shared by the
 * sign-in form and the moved-address button, which passes `former` (the old
 * address typed): the code page then names the current address only masked,
 * and the code check maps the old address back to it on the server.
 * redirect() throws NEXT_REDIRECT, so it never sits inside the try/catch.
 */
async function sendCodeAndContinue(email: string, former?: string): Promise<never> {
  if (!(await codeSendAllowed(email))) {
    redirect("/login/error?error=RateLimit");
  }

  // signIn with redirect:false does NOT throw on email-send failure; it
  // returns an error-page URL string. Detect that case by parsing the
  // returned URL's error query param. (It CAN still throw on DB/network
  // failure, so it's wrapped separately.)
  let signInResult: string | undefined;
  let signInThrew = false;
  try {
    signInResult = await signIn("resend", { email, redirect: false });
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
  // The code page needs the email to construct the verification URL.
  redirect(
    former
      ? `/login/check-email?email=${encodeURIComponent(former)}&moved=1`
      : `/login/check-email?email=${encodeURIComponent(email)}`,
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string; notMember?: string; moved?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/account/dashboard");

  const { error, email: prefillEmailRaw, notMember, moved } = await searchParams;
  const errorMessage =
    error === "send-failed"
      ? "We couldn't send the code. Please check your email address and try again."
      : null;

  // /login accepts a pre-filled email from two sources:
  //   1. /join's already-member soft-redirect → "It looks like you already
  //      have an account..." (default message when only ?email= is set)
  //   2. /login's own not-found soft-redirect (this file's handleSignIn
  //      below) → "We don't have an account for that email..." when
  //      ?notMember=1 is set
  // Trim + cap defensively — this value lands in a server-rendered input.
  const prefillEmail =
    typeof prefillEmailRaw === "string"
      ? prefillEmailRaw.trim().slice(0, 256)
      : "";

  const isNotMember = notMember === "1";

  // An address this account used to sign in with (lib/formerEmail.ts): say
  // which address it uses now, and let one button send the code there.
  // Re-resolved here, so a stale link falls back to the plain form.
  let movedTo: string | null = null;
  if (moved === "1" && prefillEmail) {
    try {
      const account = await accountForFormerEmail(prefillEmail);
      movedTo = account ? maskEmail(account.email) : null;
    } catch (err) {
      console.error("[login] Former address lookup failed", err);
    }
  }

  async function handleSignIn(formData: FormData) {
    "use server";
    const email = (formData.get("email") as string | null)?.trim().toLowerCase();
    if (!email) {
      redirect("/login?error=send-failed");
    }

    // Check whether a User with this email exists BEFORE sending a code.
    // If no User exists, the visitor was probably trying to sign in to an
    // account they don't have — instead of dropping a code into the
    // wrong inbox and routing them through the sign-up safety-net at
    // /account/welcome, send them gently to /join via /login's own
    // not-found state.
    //
    // Fail-safe on DB error: if the lookup throws (transient Postgres
    // hiccup, connection limit, etc.), proceed with signIn() anyway. A
    // real member during a DB blip is better served by getting their code
    // than by being falsely told they don't have an account.
    //
    // Privacy note: this does reveal whether a given email has a User row
    // (different page content per email). The leak already exists via the
    // public /api/account/check-email endpoint used by the registration
    // form's pre-fill, and for a community-membership site the UX win is
    // worth the modest disclosure.
    let existing: { id: string } | null = null;
    let lookupFailed = false;
    try {
      existing = await db.user.findUnique({
        where: { email: email! },
        select: { id: true },
      });
    } catch (err) {
      console.error("[login] User existence check failed", err);
      lookupFailed = true;
    }
    if (!existing && !lookupFailed) {
      // Not a current address. If it's one an account used to sign in with,
      // show which address it uses now instead of sending them to /join.
      let movedAccount: { email: string } | null = null;
      try {
        movedAccount = await accountForFormerEmail(email!);
      } catch (err) {
        console.error("[login] Former address lookup failed", err);
      }
      if (movedAccount) {
        redirect(`/login?moved=1&email=${encodeURIComponent(email!)}`);
      }
      redirect(`/login?notMember=1&email=${encodeURIComponent(email!)}`);
    }

    await sendCodeAndContinue(email!);
  }

  // The moved-address button. The current address is looked up again on the
  // server from the old one, never taken from the form, and never shown whole.
  async function handleSendToCurrent(formData: FormData) {
    "use server";
    const former = (formData.get("former") as string | null)?.trim().toLowerCase();
    if (!former) redirect("/login");
    let account: { email: string } | null = null;
    try {
      account = await accountForFormerEmail(former);
    } catch (err) {
      console.error("[login] Former address lookup failed", err);
      redirect("/login?error=send-failed");
    }
    if (!account) redirect(`/login?email=${encodeURIComponent(former)}`);
    await sendCodeAndContinue(account.email, former);
  }

  return (
    /*
     * Session 176: the three /login pages were the last public surface still
     * wearing Webflow-era class names (.section, .container-7-copy, .w-form,
     * .w-input, .link-block-3), re-implemented in custom.css long after the
     * markup they came from stopped existing. The measured result was a
     * near-black #16192c submit against RIM's rim-blue everywhere else, a
     * square 38px input, an h1 at x=420, and inline hex colors — including one
     * pre-flip #135274 teal. The auth logic above is untouched.
     */
    <div className="pp-page pp-page--spine pp-page--column">
      <section className="pp-hero pp-hero--quiet">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Members</p>
          <h1 className="pp-hero__title">Sign in</h1>
          <p className="pp-hero__body">
            Enter your email and we&apos;ll send you a 6-digit code. No password needed.
          </p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-form">
            {movedTo ? (
              <>
                <div className="pp-notice">
                  <p className="pp-notice__body">
                    <strong>Your sign-in email has changed.</strong> We recognize{" "}
                    <strong className="lg-email">{prefillEmail}</strong>, and your RIM
                    account now signs in with{" "}
                    <strong className="lg-email">{movedTo}</strong>. We&apos;ll send your
                    code there. Please use that address from now on.
                  </p>
                </div>
                <form action={handleSendToCurrent}>
                  <input type="hidden" name="former" value={prefillEmail} />
                  <button type="submit" className="pp-btn pp-form__submit">
                    Send my code there <span aria-hidden="true">&rarr;</span>
                  </button>
                </form>
                <p className="lg-alt">
                  <a href="/login">
                    Sign in with a different email <span aria-hidden="true">&rarr;</span>
                  </a>
                </p>
              </>
            ) : (
              <>
              {isNotMember ? (
                <div className="pp-notice">
                  <p className="pp-notice__body">
                    We don&apos;t have an account for{" "}
                    <strong className="lg-email">{prefillEmail || "that email"}</strong>. If
                    you&apos;re new to RIM, you&apos;re warmly welcome.{" "}
                    <a
                      href={`/join${prefillEmail ? `?email=${encodeURIComponent(prefillEmail)}` : ""}`}
                    >
                      Become a member <span aria-hidden="true">&rarr;</span>
                    </a>
                  </p>
                </div>
              ) : prefillEmail && moved !== "1" ? (
                <p className="pp-form__help lg-lead">
                  It looks like you already have an account with us. Sign in to continue.
                </p>
              ) : null}

              {errorMessage && <p className="pp-form__error" role="alert">{errorMessage}</p>}

              <form action={handleSignIn}>
                <div className="pp-form__field">
                  <label htmlFor="email" className="pp-form__label">
                    Email
                  </label>
                  <input
                    className="pp-form__input"
                    maxLength={256}
                    name="email"
                    placeholder="e.g. howard.thurman@gmail.com"
                    type="email"
                    id="email"
                    defaultValue={prefillEmail}
                    required
                  />
                </div>
                <button type="submit" className="pp-btn pp-form__submit">
                  Send code <span aria-hidden="true">&rarr;</span>
                </button>
              </form>

              <p className="lg-alt">
                New to RIM?{" "}
                <a href="/join">
                  Become a member <span aria-hidden="true">&rarr;</span>
                </a>
              </p>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
