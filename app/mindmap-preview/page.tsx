"use client";

/**
 * Mind-map proof-of-concept route (Slice 0 — throwaway, unlinked, no-auth).
 *
 * Hardcoded sample data only — safe to view unauthenticated, which also sidesteps
 * the Vercel preview-login gap (backlog 2026-06-24-001). Not in any nav. Remove or
 * promote after the judgment call. See the approved plan: hidden-riding-wombat.md.
 */

import dynamic from "next/dynamic";

const MindMapCanvasPoc = dynamic(() => import("@/components/mindmap/MindMapCanvasPoc"), {
  ssr: false,
  loading: () => <div className="mm-loading">Loading the canvas…</div>,
});

export default function MindMapPreviewPage() {
  return (
    <div className="mm-page">
      <header className="mm-page__head">
        <div>
          <span className="mm-page__eyebrow">Preview · not live</span>
          <h1 className="mm-page__title">Sangha Mind Map</h1>
        </div>
        <p className="mm-page__hint">
          Drag a topic to move it · scroll or pinch to zoom · drag a branch’s left dot onto another
          topic’s right dot to re-parent it · click a topic to open its conversation
        </p>
      </header>
      <MindMapCanvasPoc />
    </div>
  );
}
