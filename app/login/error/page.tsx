export const metadata = { title: "Sign In Error — Rooted In Mindfulness" };

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  let message = "An error occurred during sign in. Please try again.";
  if (error === "Verification") {
    message = "That code is invalid or has expired. Please request a new one.";
  } else if (error === "RateLimit") {
    message =
      "You've made several sign-in attempts in a short time. Please wait a few minutes, then try again.";
  }

  return (
    <div className="section background-white">
      <div className="container-7-copy">
        <div className="login-box" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
          <h1 className="form-header">Sign in error</h1>
          <p style={{ color: "#555", lineHeight: "1.7", marginBottom: "1.5rem" }}>{message}</p>
          <a href="/login" className="link-block-3 w-button" style={{ display: "inline-block" }}>
            Try Again →
          </a>
        </div>
      </div>
    </div>
  );
}
