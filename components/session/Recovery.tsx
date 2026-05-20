"use client";

/**
 * Recovery — denied-state screen. The user reached this either because
 * Permissions API returned "denied" on Greenroom mount (most often the
 * "Never for this Website" case on Safari) or because the Continue click
 * threw NotAllowedError / NotReadableError / NotFoundError.
 *
 * Refresh is the only reliable path on Safari — its Permissions API does
 * not reliably re-detect after a settings change without a page reload.
 * No "I've fixed it" button.
 */

import { useState } from "react";

interface Props {
  onRefresh?: () => void;
}

export default function Recovery({ onRefresh }: Props) {
  const [showOther, setShowOther] = useState(false);

  function handleRefresh() {
    if (onRefresh) {
      onRefresh();
      return;
    }
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  return (
    <div className="gr-screen">
      <div className="gr-card">
        <h1 className="gr-card__title">Let&apos;s get you back in.</h1>
        <p className="gr-card__body">
          Your camera and microphone are currently blocked for this site. Here&apos;s
          how to fix it on Safari for Mac:
        </p>

        <ol className="gr-card__steps">
          <li>Click <strong>Safari</strong> in the menu bar at the top of your screen</li>
          <li>Choose <strong>Settings for This Website…</strong></li>
          <li>Set <strong>Camera</strong> to <strong>Allow</strong></li>
          <li>Set <strong>Microphone</strong> to <strong>Allow</strong></li>
          <li>Click <strong>Refresh page</strong> below</li>
        </ol>

        <button type="button" className="gr-card__cta" onClick={handleRefresh}>
          Refresh page
        </button>

        <p className="gr-card__hint">
          If your camera or microphone is currently in use by another app
          (like Zoom), close that app first, then refresh.
        </p>

        <div className="gr-remember">
          <button
            type="button"
            className="gr-remember__toggle"
            onClick={() => setShowOther((v) => !v)}
            aria-expanded={showOther}
          >
            {showOther ? "Hide" : "Using a different browser? Show instructions →"}
          </button>
          {showOther && (
            <div className="gr-remember__panel">
              <p className="gr-remember__intro">Safari on iPhone or iPad:</p>
              <ol className="gr-remember__steps">
                <li>Tap the <strong>AA</strong> icon on the left side of the address bar</li>
                <li>Tap <strong>Website Settings</strong></li>
                <li>Set <strong>Camera</strong> and <strong>Microphone</strong> to <strong>Allow</strong></li>
                <li>Refresh the page</li>
              </ol>
              <p className="gr-remember__intro" style={{ marginTop: 16 }}>Chrome, Firefox, Edge, and others:</p>
              <p className="gr-remember__plain">
                Click the small icon on the left side of the address bar
                (a camera, lock, or settings icon, depending on your browser),
                find this site&apos;s camera and microphone settings, set both to <strong>Allow</strong>,
                and refresh the page.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
