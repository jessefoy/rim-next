"use client";

/**
 * DashboardAutoRefresh
 *
 * Invisible component that schedules an automatic server-component refresh
 * when the next state-transition epoch is reached:
 *   - `liveStartEpochs`     — each "Later Today" session's Live Now opens
 *   - `earlyOpenEpochs`     — each session the viewer is hosting/teaching
 *                             enters its 10-minute setup window
 *
 * Both arrays are plain epoch ms (timezone-agnostic). We schedule a single
 * setTimeout for the soonest upcoming epoch across both sets; router.refresh()
 * re-fetches the server component and the row's state flips naturally. The
 * component re-mounts with fresh props from the new render, so chains carry
 * the page through every subsequent transition without polling.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  liveStartEpochs: number[];
  earlyOpenEpochs?: number[];
}

export default function DashboardAutoRefresh({ liveStartEpochs, earlyOpenEpochs = [] }: Props) {
  const router = useRouter();

  useEffect(() => {
    const all = [...liveStartEpochs, ...earlyOpenEpochs];
    if (all.length === 0) return;

    const now = Date.now();
    const upcoming = all.filter((t) => t > now).sort((a, b) => a - b);
    if (upcoming.length === 0) return;

    // Fire 2 seconds after the window opens — small buffer for server clock drift
    const delay = upcoming[0] - now + 2000;
    const timer = setTimeout(() => router.refresh(), delay);
    return () => clearTimeout(timer);
  }, [liveStartEpochs, earlyOpenEpochs, router]);

  return null;
}
