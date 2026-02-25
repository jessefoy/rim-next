export const metadata = { title: "Sign In Error — Rooted In Mindfulness" };

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const error = searchParams?.error;
  let message = "An error occurred during sign in. Please try again.";
  if (error === "Verification") {
    message = "The magic link has expired or has already been used. Please request a new one.";
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
