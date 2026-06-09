"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * One-time dashboard recognition for a pre-staged host who's just onboarded
 * (session 143, backlog 2026-06-08-003). A coordinator can stage a host —
 * assign their role and build their schedule — before they ever log in; when
 * they finally do, everything is already attached but nothing points them to
 * it. This panel is that signpost: calm, one dominant action, dismissible.
 *
 * Shown only while User.hostWelcomeSeenAt is null. Both following the link and
 * dismissing mark it seen (best-effort POST), so it never nags.
 */
export default function HostWelcomePanel({ scheduleHref }: { scheduleHref: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  async function markSeen() {
    // Best-effort: the panel is a one-time courtesy, not load-bearing. If the
    // write fails the worst case is the member sees it once more next visit.
    try {
      await fetch("/api/account/host-welcome-seen", { method: "POST" });
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="db-host-welcome" role="status">
      <p className="db-host-welcome__title">Welcome — you&apos;re set up to host.</p>
      <p className="db-host-welcome__text">
        Your hosting schedule is already in place. Have a look whenever you&apos;re
        ready — there&apos;s nothing you need to do right now.
      </p>
      <div className="db-host-welcome__actions">
        <Link
          href={scheduleHref}
          className="db-host-welcome__cta"
          onClick={() => { void markSeen(); }}
        >
          View your hosting schedule →
        </Link>
        <button
          type="button"
          className="db-host-welcome__dismiss"
          onClick={() => { setHidden(true); void markSeen(); }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
