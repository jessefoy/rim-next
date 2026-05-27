import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Sign in — Rooted In Mindfulness" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/account/dashboard");

  const { error, email: prefillEmailRaw } = await searchParams;
  const errorMessage =
    error === "send-failed"
      ? "We couldn't send the code. Please check your email address and try again."
      : null;

  // Allow /join to soft-redirect already-joined members here with their email
  // pre-filled, so they don't have to retype. Trim + cap defensively — this
  // value lands in a server-rendered input attribute.
  const prefillEmail =
    typeof prefillEmailRaw === "string"
      ? prefillEmailRaw.trim().slice(0, 256)
      : "";

  async function handleSignIn(formData: FormData) {
    "use server";
    const email = (formData.get("email") as string | null)?.trim();
    if (!email) {
      redirect("/login?error=send-failed");
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
    redirect(`/login/check-email?email=${encodeURIComponent(email)}`);
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
              {prefillEmail && (
                <p style={{ marginBottom: "1rem", color: "#666", fontSize: "0.9rem" }}>
                  It looks like you already have an account with us. Sign in to continue.
                </p>
              )}
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
