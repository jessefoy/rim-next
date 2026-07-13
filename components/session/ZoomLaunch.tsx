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
    <main className="zoom-launch">
      <div className="zoom-launch__panel">
        <p className="zoom-launch__eyebrow">Connecting you to Zoom</p>
        <h1>Joining {programName}</h1>
        <p>Zoom should open automatically in a moment.</p>
        <a href={url} className="zoom-launch__fallback">Open Zoom manually</a>
      </div>
    </main>
  );
}
