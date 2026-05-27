import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const metadata = { title: "Sign in — Rooted In Mindfulness" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string; notMember?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/account/dashboard");

  const { error, email: prefillEmailRaw, notMember } = await searchParams;
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
      redirect(`/login?notMember=1&email=${encodeURIComponent(email!)}`);
    }

    // redirect:false so we land here after the email send attempt, then route
    // manually to /login/check-email with the email in the query string. The
    // check-email page needs the email to construct the verification URL
    // when the user submits the 6-digit code.
    //
    // signIn with redirect:false does NOT throw on email-send failure — it
    // returns an error-page URL string. Detect that case by parsing the
    // returned URL's error query param. (Wrap signIn in try/catch separately
    // because it CAN still throw on DB/network failure, and redirect() must
    // never live inside try/catch since it throws NEXT_REDIRECT internally.)
    let signInResult: string | undefined;
    let signInThrew = false;
    try {
      signInResult = await signIn("resend", { email: email!, redirect: false });
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
    redirect(`/login/check-email?email=${encodeURIComponent(email!)}`);
  }

  return (
    <div className="section background-white">
      <div className="container-7-copy">
        <div className="login-box">
          <div className="w-form">
            <form action={handleSignIn} className="form-container-4">
              <h1 className="form-header">Sign in</h1>
              <p style={{ marginBottom: "1.5rem", color: "#666", fontSize: "0.95rem" }}>
                Enter your email and we&apos;ll send you a 6-digit code. No password needed.
              </p>
              {isNotMember ? (
                <div
                  style={{
                    marginBottom: "1.25rem",
                    padding: "12px 14px",
                    background: "#fff8ec",
                    border: "1px solid #f0c98a",
                    borderRadius: "4px",
                    color: "#7a4f00",
                    fontSize: "0.9rem",
                    lineHeight: 1.6,
                  }}
                >
                  We don&apos;t have an account for{" "}
                  <strong>{prefillEmail || "that email"}</strong>. If you&apos;re
                  new to RIM, you&apos;re warmly welcome —{" "}
                  <a
                    href={`/join${prefillEmail ? `?email=${encodeURIComponent(prefillEmail)}` : ""}`}
                    style={{
                      color: "#135274",
                      textDecoration: "underline",
                      textUnderlineOffset: "2px",
                      fontWeight: 600,
                    }}
                  >
                    become a member →
                  </a>
                </div>
              ) : prefillEmail ? (
                <p style={{ marginBottom: "1rem", color: "#666", fontSize: "0.9rem" }}>
                  It looks like you already have an account with us. Sign in to continue.
                </p>
              ) : null}
              {errorMessage && (
                <p style={{ marginBottom: "1rem", color: "#c44", fontSize: "0.9rem" }}>
                  {errorMessage}
                </p>
              )}
              <div className="text-field-wrapper">
                <label htmlFor="email" className="input-label-2">Email</label>
                <input
                  className="input w-input"
                  maxLength={256}
                  name="email"
                  placeholder="e.g. howard.thurman@gmail.com"
                  type="email"
                  id="email"
                  defaultValue={prefillEmail}
                  required
                />
              </div>
              <input type="submit" className="link-block-3 w-button" value="Send code →" />
            </form>
          </div>
          <div style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.9rem", color: "#666" }}>
            New to RIM?{" "}
            <a href="/join" style={{ color: "#39607a", textDecoration: "underline", textUnderlineOffset: "2px" }}>
              Become a member →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
