import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import SignInCodeForm from "@/components/login/SignInCodeForm";

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
            We sent a 6-digit code to <strong>{email}</strong>. It expires in 30 minutes.
          </p>

          {resent && (
            <p style={{ color: "#2a7b6f", fontSize: "0.9rem", marginBottom: "1rem" }}>
              A new code has been sent.
            </p>
          )}

          {/* Six-box code input — client component. Submits a single
              hidden `token` field via GET to /api/auth/callback/resend,
              same NextAuth Email-provider callback that magic-link clicks
              used to hit. */}
          <SignInCodeForm email={email} callbackUrl="/account/dashboard" />

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
