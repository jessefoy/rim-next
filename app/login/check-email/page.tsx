import { signIn } from "@/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Enter Your Code — Rooted In Mindfulness" };

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
    <div className="section background-white">
      <div className="container-7-copy">
        <div className="login-box" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📬</div>
          <h1 className="form-header">Enter your code</h1>
          <p style={{ color: "#555", lineHeight: 1.7, marginBottom: "1.5rem" }}>
            We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.
          </p>

          {resent && (
            <p style={{ color: "#2a7b6f", fontSize: "0.9rem", marginBottom: "1rem" }}>
              A new code has been sent.
            </p>
          )}

          {/* Verification form — GETs the NextAuth Email-provider callback.
              The token is the code the user types; email + callbackUrl come
              along as hidden fields. NextAuth processes the GET, verifies
              the token against the VerificationToken row, sets the session
              cookie, and redirects to callbackUrl. */}
          <form
            method="GET"
            action="/api/auth/callback/resend"
            className="form-container-4"
            style={{ marginBottom: "1.5rem" }}
          >
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="callbackUrl" value="/account/dashboard" />
            <div className="text-field-wrapper">
              <label htmlFor="token" className="input-label-2">6-digit code</label>
              <input
                id="token"
                name="token"
                className="input w-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="123456"
                required
                autoFocus
                style={{
                  fontSize: "1.5rem",
                  letterSpacing: "0.5rem",
                  textAlign: "center",
                  fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                }}
              />
            </div>
            <input type="submit" className="link-block-3 w-button" value="Sign in →" />
          </form>

          <div style={{ marginTop: "1.5rem", fontSize: "0.9rem", color: "#666" }}>
            Didn&apos;t receive it? Check your spam folder, or{" "}
            <form action={resendCode} style={{ display: "inline" }}>
              <input type="hidden" name="email" value={email} />
              <button
                type="submit"
                style={{
                  background: "none",
                  border: "none",
                  color: "#135274",
                  textDecoration: "underline",
                  cursor: "pointer",
                  padding: 0,
                  font: "inherit",
                }}
              >
                send a new code
              </button>
            </form>
            .
          </div>
          <div style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "#888" }}>
            Wrong email? <a href="/login">Start over</a>.
          </div>
        </div>
      </div>
    </div>
  );
}
