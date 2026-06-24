"use client";

/**
 * Admin diagnostic control for a Zoom self-test endpoint. Reused for both the
 * primitives round-trip and the DB-backed orchestration test — pass the endpoint
 * + copy via props. Calls the admin-gated route and renders each step.
 */

import { useState } from "react";

type Step = { name: string; ok: boolean; detail: string };
type Result = { ok: boolean; steps: Step[] };

export default function ZoomSelfTest({
  endpoint,
  title,
  blurb,
}: {
  endpoint: string;
  title: string;
  blurb: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Self-test failed");
      setResult(data as Result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid var(--rim-bg-accent)",
        borderRadius: 10,
        padding: "16px 18px",
        marginTop: 24,
      }}
    >
      <div
        style={{
          fontSize: "var(--text-label)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--rim-mid)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <p style={{ fontSize: "var(--text-small)", color: "var(--rim-mid)", marginBottom: 12 }}>
        {blurb}
      </p>
      <button onClick={run} disabled={loading} className="btn">
        {loading ? "Running…" : "Run test"}
      </button>
      {error && (
        <p style={{ fontSize: "var(--text-ui)", color: "var(--color-error)", marginTop: 12 }}>
          {error}
        </p>
      )}
      {result && (
        <div style={{ marginTop: 14 }}>
          {result.steps.map((s, i) => (
            <div
              key={i}
              style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 6 }}
            >
              <span
                style={{
                  color: s.ok ? "var(--color-success)" : "var(--color-error)",
                  fontWeight: 700,
                }}
              >
                {s.ok ? "✓" : "✗"}
              </span>
              <span style={{ fontSize: "var(--text-ui)", minWidth: 170, fontWeight: 600 }}>
                {s.name}
              </span>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--rim-mid)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {s.detail}
              </span>
            </div>
          ))}
          <p
            style={{
              fontSize: "var(--text-ui)",
              fontWeight: 600,
              marginTop: 8,
              color: result.ok ? "var(--color-success)" : "var(--color-warning)",
            }}
          >
            {result.ok ? "✓ Works end-to-end." : "Some steps failed — see details above."}
          </p>
        </div>
      )}
    </div>
  );
}
