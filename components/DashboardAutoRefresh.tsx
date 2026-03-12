"use client";

/**
 * DashboardAutoRefresh
 *
 * Invisible component that schedules an automatic server-component refresh
 * when the next "Later Today" virtual session enters its Live Now window.
 *
 * The server passes `liveStartEpochs` — plain epoch ms values (timezone-agnostic)
 * representing the exact moment each session's join button should appear.
 * When the earliest upcoming epoch arrives, router.refresh() re-fetches the
 * server component data in-place and the join button appears naturally.
 *
 * No polling. One precise setTimeout per page load. Chains automatically
 * after each refresh (component re-mounts with updated props from new render).
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  /** Epoch ms (Date.getTime()) of each Later Today session's liveStart.
   *  Timezone-agnostic — Date.now() on any client compares correctly. */
  liveStartEpochs: number[];
}

export default function DashboardAutoRefresh({ liveStartEpochs }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (liveStartEpochs.length === 0) return;

    const now = Date.now();
    const upcoming = liveStartEpochs
      .filter((t) => t > now)
      .sort((a, b) => a - b);

    if (upcoming.length === 0) return;

    // Fire 2 seconds after the window opens — small buffer for server clock drift
    const delay = upcoming[0] - now + 2000;
    const timer = setTimeout(() => router.refresh(), delay);
    return () => clearTimeout(timer);
  }, [liveStartEpochs, router]);

  return null;
}
