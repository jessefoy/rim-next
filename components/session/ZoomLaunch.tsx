"use client";

/**
 * Brief "Opening Zoom…" screen that forwards the member to their Zoom join link.
 * Used by /session/[slug]/enter for the member path — a client redirect handles
 * the external Zoom URL reliably (and `replace` keeps /enter out of history so
 * Back doesn't bounce them through it again).
 */

import { useEffect } from "react";

export default function ZoomLaunch({ url, programName }: { url: string; programName: string }) {
  useEffect(() => {
    window.location.replace(url);
  }, [url]);

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        textAlign: "center",
        padding: 24,
      }}
    >
      <p style={{ fontFamily: "var(--font-serif)", fontSize: "var(--text-h3)", fontWeight: 400 }}>
        Opening {programName} in Zoom…
      </p>
      <p style={{ fontSize: "var(--text-ui)", color: "var(--rim-mid)" }}>
        If it doesn&rsquo;t open automatically,{" "}
        <a href={url} style={{ color: "var(--rim-blue)", fontWeight: 600 }}>
          click here to join
        </a>
        .
      </p>
    </div>
  );
}
