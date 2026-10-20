"use client";

import { useEffect } from "react";

/**
 * Bring the element named in the address's #hash into view once it exists
 * (2026-10-19: Updates links to one reply, comment or member). The browser
 * does this by itself only for what is on the page at load; lists drawn on
 * the client arrive a moment later. `ready` turns true when the list is in.
 * The element is marked by CSS :target; give it tabIndex={-1} to take focus.
 */
export function useHashArrival(ready: boolean = true) {
  useEffect(() => {
    if (!ready) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [ready]);
}
