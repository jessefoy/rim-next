"use client";

import { useState } from "react";
import Link from "next/link";

interface EnrollmentItem {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  courseSubheading: string | null;
  enrolledAt: string;
  completedAt: string | null;
  enrollmentSource: string;
  totalLessons: number;
  completedLessons: number;
  firstLessonSlug: string | null;
  nextLessonSlug: string | null;
}

interface CourseCardProps {
  item: EnrollmentItem;
  section: "inProgress" | "notStarted" | "completed";
  onLeave: (courseSlug: string) => void;
}

function EnrollmentCard({ item, section, onLeave }: CourseCardProps) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const canLeave =
    !item.completedAt &&
    (!item.enrollmentSource || item.enrollmentSource === "SELF");

  const sourceLabel =
    item.enrollmentSource === "ONBOARDING"
      ? "Part of your welcome resources"
      : item.enrollmentSource === "PROGRAM"
      ? "Included with your program registration"
      : null;

  const progressPct =
    item.totalLessons > 0
      ? Math.round((item.completedLessons / item.totalLessons) * 100)
      : 0;

  let ctaHref = `/course/${item.courseSlug}`;
  let ctaLabel = "Revisit →";
  if (section === "inProgress" && item.nextLessonSlug) {
    ctaHref = `/lessons/${item.nextLessonSlug}?course=${item.courseSlug}`;
    ctaLabel = "Continue →";
  } else if (section === "notStarted" && item.firstLessonSlug) {
    ctaHref = `/lessons/${item.firstLessonSlug}?course=${item.courseSlug}`;
    ctaLabel = "Start →";
  }

  async function handleLeave() {
    setLeaving(true);
    try {
      const res = await fetch(`/api/courses/${item.courseSlug}/enroll`, {
        method: "DELETE",
      });
      if (res.ok) {
        onLeave(item.courseSlug);
      }
    } finally {
      setLeaving(false);
      setConfirmLeave(false);
    }
  }

  const completedDateStr = item.completedAt
    ? new Date(item.completedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="mcl-card">
      <div className="mcl-card__body">
        <Link href={`/course/${item.courseSlug}`} className="mcl-card__title">
          {item.courseTitle}
        </Link>

        {section === "inProgress" && (
          <div className="mcl-card__progress-wrap">
            <div className="mcl-card__bar-bg">
              <div
                className="mcl-card__bar"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="mcl-card__progress-label">
              {item.completedLessons} of {item.totalLessons}
            </span>
          </div>
        )}

        {section === "notStarted" && sourceLabel && (
          <p className="mcl-card__source">{sourceLabel}</p>
        )}

        {section === "completed" && completedDateStr && (
          <p className="mcl-card__completed-date">Completed {completedDateStr}</p>
        )}
      </div>

      <div className="mcl-card__actions">
        <Link href={ctaHref} className="mcl-continue-btn">
          {ctaLabel}
        </Link>

        {canLeave && !confirmLeave && (
          <button
            type="button"
            className="mcl-leave-link"
            onClick={() => setConfirmLeave(true)}
          >
            Leave course
          </button>
        )}

        {canLeave && confirmLeave && (
          <div className="mcl-leave-confirm">
            <span className="mcl-leave-confirm__text">
              Remove this course? Your progress will be lost.
            </span>
            <div className="mcl-leave-confirm__actions">
              <button
                type="button"
                className="mcl-leave-confirm__yes"
                onClick={handleLeave}
                disabled={leaving}
              >
                {leaving ? "Removing…" : "Yes, remove"}
              </button>
              <button
                type="button"
                className="mcl-leave-confirm__cancel"
                onClick={() => setConfirmLeave(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyCourseLibrary({
  enrollments,
}: {
  enrollments: EnrollmentItem[];
}) {
  const [items, setItems] = useState(enrollments);

  const inProgress = items.filter(
    (e) => !e.completedAt && e.completedLessons > 0
  );
  const notStarted = items.filter(
    (e) => !e.completedAt && e.completedLessons === 0
  );
  const completed = items.filter((e) => !!e.completedAt).sort((a, b) =>
    b.completedAt! > a.completedAt! ? 1 : -1
  );

  function handleLeave(courseSlug: string) {
    setItems((prev) => prev.filter((i) => i.courseSlug !== courseSlug));
  }

  if (items.length === 0) {
    return (
      <div className="mcl-page">
        <h1 className="mcl-title">My Courses</h1>
        <div className="mcl-empty">
          <p>You haven&apos;t enrolled in any courses yet.</p>
          <Link href="/courses">Browse courses →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mcl-page">
      <h1 className="mcl-title">My Courses</h1>

      {inProgress.length > 0 && (
        <div className="mcl-section">
          <p className="mcl-section__title">In Progress</p>
          {inProgress.map((item) => (
            <EnrollmentCard
              key={item.courseId}
              item={item}
              section="inProgress"
              onLeave={handleLeave}
            />
          ))}
        </div>
      )}

      {notStarted.length > 0 && (
        <div className="mcl-section">
          <p className="mcl-section__title">Not Started</p>
          {notStarted.map((item) => (
            <EnrollmentCard
              key={item.courseId}
              item={item}
              section="notStarted"
              onLeave={handleLeave}
            />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="mcl-section">
          <p className="mcl-section__title">Completed</p>
          {completed.map((item) => (
            <EnrollmentCard
              key={item.courseId}
              item={item}
              section="completed"
              onLeave={handleLeave}
            />
          ))}
        </div>
      )}
    </div>
  );
}
