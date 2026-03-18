"use client";

import { useState } from "react";

interface Props {
  lessonSlug: string;
  courseSlug?: string;
  initialCompleted: boolean;
}

export default function MarkCompleteButton({ lessonSlug, courseSlug, initialCompleted }: Props) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [loading, setLoading] = useState(false);
  const [seriesCompleted, setSeriesCompleted] = useState(false);

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
        if (data.seriesCompleted) setSeriesCompleted(true);
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
