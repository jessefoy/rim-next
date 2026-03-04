"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ReactivatePage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = session?.user?.name ?? "there";

  async function handleReactivate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/reactivate", { method: "PATCH" });
      if (!res.ok) throw new Error("Reactivation failed");
      // Refresh session so archivedAt clears
      await update();
      router.push("/account/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="wl-page">
      <div className="wl-container">
        <div className="wl-header">
          <p className="wl-eyebrow">Rooted In Mindfulness</p>
          <h1 className="wl-title">Welcome back, {firstName}.</h1>
          <p className="wl-subtitle">
            Your account was archived. If you&apos;d like to rejoin our community — whether
            you&apos;re returning after time away or simply exploring what&apos;s new — we&apos;d
            love to welcome you back in.
          </p>
        </div>

        <div className="wl-form">
          {error && <p className="wl-error">{error}</p>}
          <button
            className="wl-submit"
            onClick={handleReactivate}
            disabled={loading}
          >
            {loading ? "Reactivating…" : "Reactivate My Account"}
          </button>
          <p className="wl-hint">
            Changed your mind?{" "}
            <a href="/" className="wl-link">
              Return to the home page
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
