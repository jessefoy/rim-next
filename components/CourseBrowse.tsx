"use client";

import { useState } from "react";
import Link from "next/link";

interface Course {
  id: string;
  title: string;
  slug: string;
  subheading: string | null;
  accessLevel: string;
  categoryId: string | null;
  categoryName: string | null;
  lessonCount: number;
  teachers: { name: string; slug: string }[];
  enrollment: { enrollmentSource: string; completedAt: string | null } | null;
  completedLessons: number;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  courses: Course[];
  categories: Category[];
  isLoggedIn: boolean;
}

function CourseCard({ course, isLoggedIn }: { course: Course; isLoggedIn: boolean }) {
  const enrolled = !!course.enrollment;
  const isComplete = enrolled && !!course.enrollment?.completedAt;
  const inProgress = enrolled && !isComplete && course.completedLessons > 0;
  const notStarted = enrolled && !isComplete && course.completedLessons === 0;

  return (
    <Link href={`/course/${course.slug}`} className="cls-card">
      {course.categoryName && (
        <p className="cls-card__category">{course.categoryName}</p>
      )}

      <h2 className="cls-card__title">{course.title}</h2>
      {course.subheading && (
        <p className="cls-card__sub">{course.subheading}</p>
      )}

      {course.teachers.length > 0 && (
        <p className="cls-card__teachers">
          {course.teachers.map((t, i) => (
            <span key={t.slug}>
              {i > 0 && ", "}
              {t.name}
            </span>
          ))}
        </p>
      )}

      <div className="cls-card__meta">
        <span className="cls-card__lessons">
          {course.lessonCount} lesson{course.lessonCount !== 1 ? "s" : ""}
        </span>
        {course.accessLevel === "REGISTRATION_REQUIRED" && (
          <span className="cls-card__access-label">Registration required</span>
        )}
      </div>

      {isLoggedIn && enrolled && (
        <div className="cls-card__enroll-state">
          {isComplete && (
            <span className="cls-card__badge cls-card__badge--complete">✓ Completed</span>
          )}
          {inProgress && (
            <span className="cls-card__badge cls-card__badge--progress">
              {course.completedLessons} of {course.lessonCount} complete
            </span>
          )}
          {notStarted && (
            <span className="cls-card__badge cls-card__badge--enrolled">Enrolled</span>
          )}
        </div>
      )}
    </Link>
  );
}

export default function CourseBrowse({ courses, categories, isLoggedIn }: Props) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const displayedCourses = selectedCategoryId
    ? courses.filter((c) => c.categoryId === selectedCategoryId)
    : courses;

  return (
    <div className="cls-page">
      <header className="cls-header">
        <h1 className="cls-title">Courses</h1>
        <p className="cls-subtitle">
          Study and practice resources from Rooted in Mindfulness
        </p>
      </header>

      {categories.length > 0 && (
        <div className="cls-filter-bar">
          <button
            className={`cls-filter-pill${!selectedCategoryId ? " cls-filter-pill--active" : ""}`}
            onClick={() => setSelectedCategoryId(null)}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`cls-filter-pill${selectedCategoryId === cat.id ? " cls-filter-pill--active" : ""}`}
              onClick={() => setSelectedCategoryId(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      <div className="cls-grid">
        {displayedCourses.map((course) => (
          <CourseCard key={course.id} course={course} isLoggedIn={isLoggedIn} />
        ))}
      </div>

      {displayedCourses.length === 0 && (
        <p className="cls-empty">No courses in this category.</p>
      )}
    </div>
  );
}
