"use client";

import { useEffect, useRef } from "react";

/** The sign-in list's Print button (2026-10-23). Printing, by this button or
 *  the browser's own Print, is kept in the program's History once per visit
 *  (2026-10-25: it was kept when the page loaded, so a visit with no print
 *  counted as one). */
export default function PrintButton({ programSlug }: { programSlug: string }) {
  const recorded = useRef(false);
  useEffect(() => {
    function onPrint() {
      if (recorded.current) return;
      recorded.current = true;
      void fetch(`/api/programs/${programSlug}/sign-in-printed`, { method: "POST", keepalive: true }).catch(() => {});
    }
    window.addEventListener("beforeprint", onPrint);
    return () => window.removeEventListener("beforeprint", onPrint);
  }, [programSlug]);
  return (
    <button type="button" className="vol-save-btn" onClick={() => window.print()}>
      Print
    </button>
  );
}
