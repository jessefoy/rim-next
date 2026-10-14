"use client";

/**
 * Brief "Opening Zoom…" screen that forwards the member to their Zoom join link.
 * Used by /session/[slug]/enter for the member path — a client redirect handles
 * the external Zoom URL reliably (and `replace` keeps /enter out of history so
 * Back doesn't bounce them through it again). An outside room may be on another
 * service (Google Meet, Teams, or one we don't name): `service` is its name, or
 * null for "the meeting".
 */

import { useEffect } from "react";

export default function ZoomLaunch({
  url,
  programName,
  service = "Zoom",
}: {
  url: string;
  programName: string;
  service?: string | null;
}) {
  useEffect(() => {
    window.location.replace(url);
  }, [url]);

  return (
    <main className="zoom-launch">
      <div className="zoom-launch__panel">
        <p className="zoom-launch__eyebrow">{service ? `Connecting you to ${service}` : "Connecting you"}</p>
        <h1>Joining {programName}</h1>
        <p>{service ? `${service} should open automatically in a moment.` : "The meeting should open automatically in a moment."}</p>
        <a href={url} className="zoom-launch__fallback">{service ? `Open ${service} manually` : "Open the meeting manually"}</a>
      </div>
    </main>
  );
}
