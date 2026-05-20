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
 *
 * Instructions are matched to the user's detected browser + OS. If
 * detection misses, generic prose covers the case. No safety-hatch
 * disclosure to other platforms — that was decided session 120.
 */

import { useEffect, useState } from "react";
import { detectPlatform, type Platform } from "@/lib/detectPlatform";

interface Props {
  onRefresh?: () => void;
}

export default function Recovery({ onRefresh }: Props) {
  const [platform, setPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

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
          Your camera and microphone are currently blocked for this site.
          {platform ? ` Here's how to fix it on ${platformName(platform)}:` : " Here's how to fix it:"}
        </p>

        <RecoverySteps platform={platform} />

        <button type="button" className="gr-card__cta" onClick={handleRefresh}>
          Refresh page
        </button>

        <p className="gr-card__hint">
          If your camera or microphone is currently in use by another app
          (like Zoom), close that app first, then refresh.
        </p>
      </div>
    </div>
  );
}

function platformName(platform: Platform): string {
  const { browser, os } = platform;
  if (browser === "safari" && os === "macos") return "Safari for Mac";
  if (browser === "safari" && os === "ios") return "Safari for iPhone";
  if (browser === "safari" && os === "ipados") return "Safari for iPad";
  if (browser === "chrome" && os === "android") return "Chrome on Android";
  if (browser === "chrome") return "Chrome";
  if (browser === "edge") return "Edge";
  if (browser === "firefox") return "Firefox";
  return "this browser";
}

function RecoverySteps({ platform }: { platform: Platform | null }) {
  // Pre-detection (one tick on mount): render nothing so the screen doesn't
  // flash generic steps before swapping to matched copy.
  if (!platform) return null;

  const { browser, os } = platform;

  if (browser === "safari" && os === "macos") {
    return (
      <ol className="gr-card__steps">
        <li>Click <strong>Safari</strong> in the menu bar at the top of your screen</li>
        <li>Choose <strong>Settings for This Website…</strong></li>
        <li>Set <strong>Camera</strong> to <strong>Allow</strong></li>
        <li>Set <strong>Microphone</strong> to <strong>Allow</strong></li>
        <li>Click <strong>Refresh page</strong> below</li>
      </ol>
    );
  }

  if (browser === "safari" && os === "ios") {
    return (
      <ol className="gr-card__steps">
        <li>Tap the <strong>AA</strong> icon at the left of the address bar</li>
        <li>Tap <strong>Website Settings</strong></li>
        <li>Set <strong>Camera</strong> to <strong>Allow</strong></li>
        <li>Set <strong>Microphone</strong> to <strong>Allow</strong></li>
        <li>Tap <strong>Refresh page</strong> below</li>
      </ol>
    );
  }

  if (browser === "safari" && os === "ipados") {
    return (
      <ol className="gr-card__steps">
        <li>Tap the <strong>ᴬA</strong> icon in the address bar</li>
        <li>Tap <strong>Website Settings</strong></li>
        <li>Set <strong>Camera</strong> to <strong>Allow</strong></li>
        <li>Set <strong>Microphone</strong> to <strong>Allow</strong></li>
        <li>Tap <strong>Refresh page</strong> below</li>
      </ol>
    );
  }

  if (browser === "chrome" && os === "android") {
    return (
      <ol className="gr-card__steps">
        <li>Tap the <strong>padlock</strong> at the left of the address bar</li>
        <li>Tap <strong>Permissions</strong></li>
        <li>Set <strong>Camera</strong> and <strong>Microphone</strong> to <strong>Allow</strong></li>
        <li>Tap <strong>Refresh page</strong> below</li>
      </ol>
    );
  }

  if (browser === "chrome" || browser === "edge") {
    return (
      <ol className="gr-card__steps">
        <li>Click the small <strong>camera</strong> or <strong>padlock</strong> icon at the left of the address bar</li>
        <li>Find this site&apos;s <strong>Camera</strong> and <strong>Microphone</strong> settings</li>
        <li>Set both to <strong>Allow</strong></li>
        <li>Click <strong>Refresh page</strong> below</li>
      </ol>
    );
  }

  if (browser === "firefox") {
    return (
      <ol className="gr-card__steps">
        <li>Click the <strong>shield</strong> or <strong>padlock</strong> at the left of the address bar</li>
        <li>Find this site&apos;s <strong>Camera</strong> and <strong>Microphone</strong> permissions</li>
        <li>Remove the block, or set both to <strong>Allow</strong></li>
        <li>Click <strong>Refresh page</strong> below</li>
      </ol>
    );
  }

  // Unrecognized — generic prose. Kept short so it doesn't look like a wall.
  return (
    <p className="gr-card__body">
      Click the small icon at the left of the address bar (a camera,
      padlock, or settings icon, depending on your browser), find this
      site&apos;s camera and microphone settings, set both to <strong>Allow</strong>,
      and click <strong>Refresh page</strong> below.
    </p>
  );
}
