"use client";

/** The sign-in list's Print button (2026-10-23). */
export default function PrintButton() {
  return (
    <button type="button" className="vol-save-btn" onClick={() => window.print()}>
      Print
    </button>
  );
}
