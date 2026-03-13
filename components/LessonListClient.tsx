"use client";

/**
 * LessonListClient — lesson list with client-side search.
 * CSS prefix: th-
 */

import { useState } from "react";
import Link from "next/link";

interface LessonRow {
  id: string;
  titleInternal: string;
  titleDisplayed: string;
  slug: string;
  courses: string[];
}

interface Props {
  hubSlug: string;
  lessons: LessonRow[];
}

export default function LessonListClient({ hubSlug, lessons }: Props) {
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? lessons.filter((l) =>
        l.titleInternal.toLowerCase().includes(filter.toLowerCase())
      )
    : lessons;

  return (
    <div className="th-list">
      <div className="th-list__header">
        <h2 className="th-list__title">Lessons</h2>
        <Link href={`/account/hub/${hubSlug}/lessons/new`} className="th-btn th-btn--primary">
          New Lesson
        </Link>
      </div>

      <input
        type="text"
        placeholder="Search by internal title…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="th-input th-list__search"
      />

      {filtered.length === 0 ? (
        <p className="th-empty">
          {filter ? "No lessons match your search." : "No lessons yet. Create your first lesson to get started."}
        </p>
      ) : (
        <table className="th-table">
          <thead>
            <tr>
              <th>Internal Title</th>
              <th>Displayed Title</th>
              <th>Slug</th>
              <th>Courses</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lesson) => (
              <tr key={lesson.id}>
                <td>
                  <Link href={`/account/hub/${hubSlug}/lessons/${lesson.slug}`} className="th-link">
                    {lesson.titleInternal}
                  </Link>
                </td>
                <td>{lesson.titleDisplayed}</td>
                <td className="th-table__muted">{lesson.slug}</td>
                <td className="th-table__muted">
                  {lesson.courses.length > 0 ? lesson.courses.join(", ") : "—"}
                </td>
                <td>
                  <Link href={`/account/hub/${hubSlug}/lessons/${lesson.slug}`} className="th-link">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
