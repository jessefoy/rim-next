"use client";

/**
 * ViewToggle — Speaker / Gallery segmented control for the page header.
 *
 * Zoom places this top-right. Gallery is the default. Speaker view focuses
 * one participant (active speaker if nothing else is pinned). Choice
 * persists in localStorage under `rim-livekit-view`.
 */

export type SessionView = "speaker" | "gallery";

interface Props {
  view: SessionView;
  onChange: (view: SessionView) => void;
}

export default function ViewToggle({ view, onChange }: Props) {
  return (
    <div className="vs-view-toggle" role="radiogroup" aria-label="View">
      <button
        type="button"
        role="radio"
        aria-checked={view === "speaker"}
        className={`vs-view-toggle__btn${view === "speaker" ? " vs-view-toggle__btn--active" : ""}`}
        onClick={() => onChange("speaker")}
      >
        Speaker
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={view === "gallery"}
        className={`vs-view-toggle__btn${view === "gallery" ? " vs-view-toggle__btn--active" : ""}`}
        onClick={() => onChange("gallery")}
      >
        Gallery
      </button>
    </div>
  );
}
