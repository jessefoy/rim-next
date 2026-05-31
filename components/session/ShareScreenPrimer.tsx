"use client";

/**
 * ShareScreenPrimer — a brief, calm primer shown before the browser's screen-
 * share picker.
 *
 * The picker dialog where you choose a screen / window / tab is the *browser's*
 * own dialog — web security won't let a site restyle or replace it (that's why
 * we can't clone Zoom's custom picker). This primer frames it instead: it tells
 * the user what the next dialog will ask and that they must click Share inside
 * it. The "Choose what to share" button is the user gesture getDisplayMedia
 * requires, so it calls onConfirm (which starts the share) directly.
 *
 * Renders as an upward popover anchored to the Share button, reusing the
 * control-bar popover styling. Closes on outside click or Cancel.
 */

import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Start the share — must run from this click (the gesture getDisplayMedia needs). */
  onConfirm: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export default function ShareScreenPrimer({ open, onClose, onConfirm, anchorRef }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (ref.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="rim-cb-popover rim-cb-popover--share"
      role="dialog"
      aria-label="Share your screen"
    >
      <p className="rim-cb-share__title">Share your screen</p>
      <p className="rim-cb-share__body">
        Next, your browser will ask what to show. Choose your{" "}
        <strong>whole screen</strong>, a single <strong>window</strong>, or a{" "}
        <strong>browser tab</strong> — then click <strong>Share</strong> in that
        dialog. Everyone will see it full-screen.
      </p>
      <div className="rim-cb-share__actions">
        <button type="button" className="rim-cb-share__cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="rim-cb-share__confirm" onClick={onConfirm}>
          Choose what to share
        </button>
      </div>
    </div>
  );
}
