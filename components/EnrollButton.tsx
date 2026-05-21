"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  courseSlug: string;
  initialEnrolled: boolean;
  enrollmentSource?: string; // "SELF" | "PROGRAM" | "ONBOARDING" | "ROLE" | "ADMIN" | null
}

export default function EnrollButton({ courseSlug, initialEnrolled, enrollmentSource }: Props) {
  const router = useRouter();
  const [enrolled, setEnrolled] = useState(initialEnrolled);
  const [loading, setLoading] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only SELF-enrolled members (or old records without source) can leave on their own
  const canLeave = !enrollmentSource || enrollmentSource === "SELF";

  async function handleEnroll() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseSlug}/enroll`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setEnrolled(data.enrolled);
        // Refresh the server component so the landing-view page transitions
        // to the enrolled TOC view (the access-state check sees the new
        // SeriesEnrollment).
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Couldn't enroll. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUnenroll() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseSlug}/enroll`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        setEnrolled(data.enrolled);
        setConfirmLeave(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Couldn't update enrollment. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (enrolled) {
    return (
      <div className="crs-enroll-wrap">
        <span className="crs-enrolled-badge">✓ Enrolled</span>
        {canLeave && !confirmLeave && (
          <button
            type="button"
            className="crs-leave-link"
            onClick={() => setConfirmLeave(true)}
          >
            Leave course
          </button>
        )}
        {!canLeave && (
          <span
            className="crs-leave-link"
            title="Managed by your program registration or role."
            style={{ cursor: "default", textDecoration: "none" }}
          />
        )}
        {canLeave && confirmLeave && (
          <span className="crs-leave-confirm">
            <span>Remove from your library? Your progress will be lost.</span>
            <button
              type="button"
              className="crs-leave-confirm__yes"
              onClick={handleUnenroll}
              disabled={loading}
            >
              {loading ? "Removing…" : "Yes, remove"}
            </button>
            <button
              type="button"
              className="crs-leave-confirm__cancel"
              onClick={() => setConfirmLeave(false)}
            >
              Cancel
            </button>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="crs-enroll-wrap">
      <button
        type="button"
        onClick={handleEnroll}
        disabled={loading}
        className="crs-enroll-btn"
        aria-pressed={false}
      >
        {loading ? "Enrolling…" : "Enroll in this course"}
      </button>
      {error && <p className="crs-enroll-error" role="alert">{error}</p>}
    </div>
  );
}
