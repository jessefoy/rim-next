"use client";

import { useEffect } from "react";

/**
 * Re-applies an incoming hash after this route hydrates. Next's client-side
 * navigation can try the native anchor before a dynamic server page has
 * committed its target, which intermittently leaves the visitor at the top.
 */
export default function HashTargetScroller() {
  useEffect(() => {
    let frame = 0;
    let cancelled = false;
    let generation = 0;
    let settleTimers: number[] = [];

    const targetFromHash = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return null;

      try {
        return document.getElementById(decodeURIComponent(hash));
      } catch {
        return document.getElementById(hash);
      }
    };

    const scrollToHash = () => {
      const target = targetFromHash();
      if (!target) return false;

      target.scrollIntoView({ block: "start", behavior: "auto" });
      return true;
    };

    const findAndScroll = () => {
      cancelAnimationFrame(frame);
      settleTimers.forEach(window.clearTimeout);
      settleTimers = [];
      const activeGeneration = ++generation;
      let attempts = 0;

      const tryScroll = () => {
        if (cancelled || activeGeneration !== generation) return;

        if (scrollToHash()) {
          // Next may still perform its own route scroll after the target first
          // appears. Reassert briefly, then release normal scrolling entirely.
          settleTimers = [
            window.setTimeout(scrollToHash, 120),
            window.setTimeout(scrollToHash, 420),
          ];
          return;
        }

        if (attempts++ < 120) frame = requestAnimationFrame(tryScroll);
      };

      // Give the route transition one paint before checking for its target.
      frame = requestAnimationFrame(tryScroll);
    };

    findAndScroll();
    window.addEventListener("hashchange", findAndScroll);
    window.addEventListener("pageshow", findAndScroll);

    // Web fonts can alter section heights after the first successful scroll.
    void document.fonts?.ready.then(() => {
      if (!cancelled) requestAnimationFrame(scrollToHash);
    });

    return () => {
      cancelled = true;
      generation += 1;
      cancelAnimationFrame(frame);
      settleTimers.forEach(window.clearTimeout);
      window.removeEventListener("hashchange", findAndScroll);
      window.removeEventListener("pageshow", findAndScroll);
    };
  }, []);

  return null;
}
