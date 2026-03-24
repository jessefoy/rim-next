"use client";

/**
 * LessonListClient — lesson library with standalone / in-series sections.
 * CSS prefix: th-
 */

import { useState } from "react";
import Link from "next/link";

interface LessonRow {
  id: string;
  titleInternal: string;
  titleDisplayed: string;
  slug: string;
  series: { title: string; slug: string }[];
}

interface Props {
  basePath?: string;
  seriesBasePath?: string;
  lessons: LessonRow[];
}

function LessonTableRow({ lesson, basePath, seriesBasePath }: { lesson: LessonRow; basePath: string; seriesBasePath: string }) {
  return (
    <tr>
      <td>
        <Link href={`${basePath}/${lesson.slug}`} className="th-link">
          {lesson.titleInternal}
        </Link>
      </td>
      <td className="th-table__muted">{lesson.titleDisplayed}</td>
      <td>
        {lesson.series.length > 0
          ? lesson.series.map((s) => (
              <Link key={s.slug} href={`${seriesBasePath}/${s.slug}`} className="th-link th-link--sm" style={{ marginRight: 8 }}>
                {s.title}
              </Link>
            ))
          : <span className="th-badge th-badge--muted">Standalone</span>
        }
      </td>
      <td>
        <Link href={`${basePath}/${lesson.slug}`} className="th-link">
          Edit
        </Link>
      </td>
    </tr>
  );
}

function LessonTable({ lessons, basePath, seriesBasePath }: { lessons: LessonRow[]; basePath: string; seriesBasePath: string }) {
  return (
    <table className="th-table">
      <thead>
        <tr>
          <th>Internal Title</th>
          <th>Displayed Title</th>
          <th>Series</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {lessons.map((l) => <LessonTableRow key={l.id} lesson={l} basePath={basePath} seriesBasePath={seriesBasePath} />)}
      </tbody>
    </table>
  );
}

export default function LessonListClient({ basePath = "/tools/learning/lessons", seriesBasePath = "/tools/learning", lessons }: Props) {
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? lessons.filter((l) => l.titleInternal.toLowerCase().includes(filter.toLowerCase()))
    : lessons;

  const standalone = filtered.filter((l) => l.series.length === 0);
  const inSeries   = filtered.filter((l) => l.series.length > 0);

  return (
    <div className="th-list">
      <div className="th-list__header">
        <h2 className="th-list__title">All Lessons</h2>
        <Link href={`${basePath}/new`} className="th-btn th-btn--primary">
          New Lesson
        </Link>
      </div>

      <input
        type="text"
        placeholder="Search by title…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="th-input th-list__search"
      />

      {filtered.length === 0 ? (
        <p className="th-empty">
          {filter ? "No lessons match your search." : "No lessons yet. Create one from within a series, or use New Lesson above."}
        </p>
      ) : (
        <>
          {standalone.length > 0 && (
            <div className="th-list-section">
              <h3 className="th-list-section__title">Standalone Teachings</h3>
              <p className="th-list-section__desc">Not part of any series — shareable as individual lessons.</p>
              <LessonTable lessons={standalone} basePath={basePath} seriesBasePath={seriesBasePath} />
            </div>
          )}

          {inSeries.length > 0 && (
            <div className="th-list-section">
              <h3 className="th-list-section__title">In a Series</h3>
              <LessonTable lessons={inSeries} basePath={basePath} seriesBasePath={seriesBasePath} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
