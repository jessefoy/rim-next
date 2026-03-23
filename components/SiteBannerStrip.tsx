"use client";

/**
 * SiteBannerStrip — site-wide admin broadcast banner.
 * CSS prefix: sb-
 *
 * Renders a single muted bar above dashboard content.
 * Members can dismiss individually.
 * Body is BlockNote JSON, pre-rendered to HTML on the server.
 */

import { useState } from "react";

interface Props {
  banner: { id: string; bodyHtml: string } | null;
}

export default function SiteBannerStrip({ banner }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (!banner || dismissed) return null;

  async function dismiss() {
    setDismissed(true);
    await fetch("/api/site-banner/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bannerId: banner!.id }),
    });
  }

  return (
    <div className="sb-strip">
      <div
        className="sb-strip__body"
        dangerouslySetInnerHTML={{ __html: banner.bodyHtml }}
      />
      <button className="sb-strip__dismiss" onClick={dismiss} aria-label="Dismiss banner">
        ✕
      </button>
    </div>
  );
}
