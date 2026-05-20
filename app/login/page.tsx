import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Sign in — Rooted In Mindfulness" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/account/dashboard");

  const { error } = await searchParams;
  const errorMessage =
    error === "send-failed"
      ? "We couldn't send the code. Please check your email address and try again."
      : null;

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
              <h1 className="form-header">Join or sign in</h1>
              <p style={{ marginBottom: "1.5rem", color: "#666", fontSize: "0.95rem" }}>
                Enter your email and we&apos;ll send you a 6-digit code — whether you&apos;re new or
                returning, it works the same way. No password needed.
              </p>
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
                  required
                />
              </div>
              <input type="submit" className="link-block-3 w-button" value="Send code →" />
            </form>
          </div>
          <div style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.9rem", color: "#666" }}>
            New to RIM? You&apos;ll set up your name and a brief community welcome after your first sign-in.
          </div>
        </div>
      </div>
    </div>
  );
}
