import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Login — Rooted In Mindfulness" };

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/account/dashboard");

  async function handleSignIn(formData: FormData) {
    "use server";
    await signIn("resend", {
      email: formData.get("email") as string,
      redirectTo: "/account/dashboard",
    });
  }

  return (
    <div className="section background-white">
      <div className="container-7-copy">
        <div className="login-box">
          <div className="w-form">
            <form action={handleSignIn} className="form-container-4">
              <h1 className="form-header">Join or sign in</h1>
              <p style={{ marginBottom: "1.5rem", color: "#666", fontSize: "0.95rem" }}>
                Enter your email and we&apos;ll send you a link — whether you&apos;re new or
                returning, it works the same way. No password needed.
              </p>
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
              <input type="submit" className="link-block-3 w-button" value="Send Magic Link →" />
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
