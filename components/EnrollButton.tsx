"use client";

import { useState } from "react";

interface Props {
  courseSlug: string;
  initialEnrolled: boolean;
  enrollmentSource?: string; // "SELF" | "PROGRAM" | "ONBOARDING" | "ROLE" | "ADMIN" | null
}

export default function EnrollButton({ courseSlug, initialEnrolled, enrollmentSource }: Props) {
  const [enrolled, setEnrolled] = useState(initialEnrolled);
  const [loading, setLoading] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Only SELF-enrolled members (or old records without source) can leave on their own
  const canLeave = !enrollmentSource || enrollmentSource === "SELF";

  async function handleEnroll() {
    setLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseSlug}/enroll`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setEnrolled(data.enrolled);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUnenroll() {
    setLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseSlug}/enroll`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        setEnrolled(data.enrolled);
        setConfirmLeave(false);
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
    <button
      type="button"
      onClick={handleEnroll}
      disabled={loading}
      className="crs-enroll-btn"
      aria-pressed={false}
    >
      {loading ? "Enrolling…" : "Enroll in this series"}
    </button>
  );
}
