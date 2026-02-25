export const metadata = { title: "Check Your Email — Rooted In Mindfulness" };

export default function CheckEmailPage() {
  return (
    <div className="section background-white">
      <div className="container-7-copy">
        <div className="login-box" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📬</div>
          <h1 className="form-header">Check your email</h1>
          <p style={{ color: "#555", lineHeight: "1.7", marginBottom: "1.5rem" }}>
            A magic link has been sent to your email address. Click the link to sign in — it&apos;s valid for 24 hours.
          </p>
          <p style={{ color: "#888", fontSize: "0.9rem" }}>
            Didn&apos;t receive it? Check your spam folder, or{" "}
            <a href="/login">try again</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
