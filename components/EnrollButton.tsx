"use client";

import { useState } from "react";

interface Props {
  courseSlug: string;
  initialEnrolled: boolean;
}

export default function EnrollButton({ courseSlug, initialEnrolled }: Props) {
  const [enrolled, setEnrolled] = useState(initialEnrolled);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const method = enrolled ? "DELETE" : "POST";
      const res = await fetch(`/api/courses/${courseSlug}/enroll`, { method });
      if (res.ok) {
        const data = await res.json();
        setEnrolled(data.enrolled);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`crs-enroll-btn${enrolled ? " crs-enroll-btn--enrolled" : ""}`}
      aria-pressed={enrolled}
    >
      {enrolled ? "✓ Enrolled" : "Enroll in this series"}
    </button>
  );
}
