"use client";

import { useState } from "react";

interface Props {
  lessonSlug: string;
  courseSlug?: string;
  initialCompleted: boolean;
  courseCompletionNote?: string | null;
  /** When true (questionsRequired + not all correct), the button is disabled with a hint */
  locked?: boolean;
}

export default function MarkCompleteButton({
  lessonSlug,
  courseSlug,
  initialCompleted,
  courseCompletionNote,
  locked = false,
}: Props) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [loading, setLoading] = useState(false);
  const [seriesCompleted, setSeriesCompleted] = useState(false);
  const [completionNote, setCompletionNote] = useState<string | null>(courseCompletionNote ?? null);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/lessons/${lessonSlug}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug }),
      });
      if (res.ok) {
        const data = await res.json();
        setCompleted(data.completed);
        if (data.seriesCompleted) {
          setSeriesCompleted(true);
          if (data.completionNote) setCompletionNote(data.completionNote);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  if (seriesCompleted) {
    return (
      <div className="lp-series-complete">
        <p className="lp-series-complete__msg">
          You&apos;ve completed this series. Take a moment to let that land.
        </p>
        {completionNote && (
          <p className="lp-series-complete__note">{completionNote}</p>
        )}
      </div>
    );
  }

  if (locked) {
    return (
      <div className="ls-complete-locked">
        <button
          type="button"
          disabled
          className="lp-complete-btn lp-complete-btn--locked"
        >
          Mark as complete
        </button>
        <p className="ls-complete-locked__hint">
          Answer all reflection questions correctly to complete this lesson.
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`lp-complete-btn${completed ? " lp-complete-btn--done" : ""}`}
      aria-pressed={completed}
    >
      {completed ? "✓ Marked complete" : "Mark as complete"}
    </button>
  );
}
