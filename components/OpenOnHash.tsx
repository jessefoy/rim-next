"use client";

import { useEffect } from "react";

/**
 * Open the <details> named in the address's #hash (2026-10-22: each of the
 * eight words on /care is a closed item, and a link to /care#calm should
 * land on Calm opened). Runs on arrival, on hashchange, and on a click of a
 * same-page link to the hash already in the address, which fires no
 * hashchange. The browser scrolls to the element itself; this only opens it.
 */
export default function OpenOnHash() {
  useEffect(() => {
    function openId(raw: string) {
      let id = raw;
      try {
        id = decodeURIComponent(raw);
      } catch {
        // A malformed hash (#%E0) names nothing; leave the page as it is.
      }
      const el = id ? document.getElementById(id) : null;
      if (el instanceof HTMLDetailsElement) el.open = true;
    }
    const fromHash = () => openId(window.location.hash.slice(1));
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href^="#"]');
      if (link) openId(link.getAttribute("href")!.slice(1));
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      document.removeEventListener("click", onClick);
    };
  }, []);
  return null;
}
