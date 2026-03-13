"use client";

/**
 * CourseEditor — handles both create and edit for courses.
 * CSS prefix: th-
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Lesson {
  id: string;
  titleInternal: string;
  titleDisplayed: string;
  slug: string;
}

interface CourseLesson {
  lessonId: string;
  sortOrder: number;
  lesson: Lesson;
}

interface CourseData {
  id?: string;
  title: string;
  slug: string;
  subheading: string;
  description: string;
  accessLevel: "MEMBERS" | "REGISTRATION_REQUIRED";
  hideFromMemberProfile: boolean;
  sortOrder: string;
  isActive: boolean;
  lessons?: CourseLesson[];
}

interface Props {
  hubSlug: string;
  initialData?: CourseData;
  isEditing: boolean;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function CourseEditor({ hubSlug, initialData, isEditing }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [subheading, setSubheading] = useState(initialData?.subheading ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [accessLevel, setAccessLevel] = useState<"MEMBERS" | "REGISTRATION_REQUIRED">(
    initialData?.accessLevel ?? "MEMBERS"
  );
  const [hideFromMemberProfile, setHideFromMemberProfile] = useState(initialData?.hideFromMemberProfile ?? false);
  const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? "");
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  // Lesson manager state
  const [lessons, setLessons] = useState<CourseLesson[]>(initialData?.lessons ?? []);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Lesson[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Auto-generate slug from title
  useEffect(() => {
    if (!isEditing && !slugTouched && title) {
      setSlug(slugify(title));
    }
  }, [title, isEditing, slugTouched]);

  // Lesson search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/lessons/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          // Filter out lessons already in the course
          const existingIds = new Set(lessons.map((l) => l.lessonId));
          setSearchResults(data.filter((l: Lesson) => !existingIds.has(l.id)));
        }
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [searchQuery, lessons]);

  function addLesson(lesson: Lesson) {
    setLessons((prev) => [
      ...prev,
      { lessonId: lesson.id, sortOrder: prev.length, lesson },
    ]);
    setSearchQuery("");
    setSearchResults([]);
  }

  function removeLesson(lessonId: string) {
    setLessons((prev) => prev.filter((l) => l.lessonId !== lessonId));
  }

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setLessons((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(dragIdx, 1);
      updated.splice(idx, 0, moved);
      return updated;
    });
    setDragIdx(idx);
  }

  function handleDragEnd() {
    setDragIdx(null);
  }

  async function handleSave() {
    setError("");
    setSuccess(false);
    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        title,
        slug,
        subheading,
        description,
        accessLevel,
        hideFromMemberProfile,
        sortOrder: sortOrder ? Number(sortOrder) : null,
        isActive,
      };

      if (isEditing) {
        payload.lessonOrder = lessons.map((l) => l.lessonId);
      }

      const url = isEditing ? `/api/courses/${initialData?.slug}` : "/api/courses";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      if (isEditing) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const created = await res.json();
        router.push(`/account/hub/${hubSlug}/courses/${created.slug}`);
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="th-editor">
      <h2 className="th-editor__title">{isEditing ? "Edit Course" : "New Course"}</h2>

      {error && <div className="th-msg th-msg--error">{error}</div>}
      {success && <div className="th-msg th-msg--success">Saved successfully</div>}

      <div className="th-form">
        <label className="th-field">
          <span className="th-field__label">Course Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="th-input"
            required
          />
        </label>

        <label className="th-field">
          <span className="th-field__label">Slug</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
            className="th-input"
            required
          />
        </label>

        <label className="th-field">
          <span className="th-field__label">Subheading</span>
          <input
            type="text"
            value={subheading}
            onChange={(e) => setSubheading(e.target.value)}
            className="th-input"
          />
        </label>

        <label className="th-field">
          <span className="th-field__label">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="th-textarea"
            rows={6}
          />
        </label>

        <fieldset className="th-field">
          <legend className="th-field__label">Access Level</legend>
          <label className="th-radio">
            <input
              type="radio"
              checked={accessLevel === "MEMBERS"}
              onChange={() => setAccessLevel("MEMBERS")}
            />
            All Members
          </label>
          <label className="th-radio">
            <input
              type="radio"
              checked={accessLevel === "REGISTRATION_REQUIRED"}
              onChange={() => setAccessLevel("REGISTRATION_REQUIRED")}
            />
            Registration Required
          </label>
        </fieldset>

        <label className="th-checkbox">
          <input
            type="checkbox"
            checked={hideFromMemberProfile}
            onChange={(e) => setHideFromMemberProfile(e.target.checked)}
          />
          Hide from member profile
        </label>

        <label className="th-field">
          <span className="th-field__label">Sort Order</span>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="th-input th-input--narrow"
          />
        </label>

        <label className="th-checkbox">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
      </div>

      {/* ── Lesson Manager (edit mode only) ── */}
      {isEditing && (
        <div className="th-lessons">
          <h3 className="th-lessons__title">Lessons</h3>

          {lessons.length === 0 ? (
            <p className="th-empty">No lessons in this course yet.</p>
          ) : (
            <div className="th-lessons__list">
              {lessons.map((cl, i) => (
                <div
                  key={cl.lessonId}
                  className={`th-lessons__item${dragIdx === i ? " th-lessons__item--dragging" : ""}`}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragEnd={handleDragEnd}
                >
                  <span className="th-lessons__handle" title="Drag to reorder">☰</span>
                  <span className="th-lessons__name">{cl.lesson.titleInternal}</span>
                  <button
                    type="button"
                    className="th-btn th-btn--danger th-btn--small"
                    onClick={() => removeLesson(cl.lessonId)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="th-lessons__add">
            <input
              type="text"
              placeholder="Search lessons to add…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="th-input"
            />
            {searching && <p className="th-muted">Searching…</p>}
            {searchResults.length > 0 && (
              <div className="th-lessons__results">
                {searchResults.map((lesson) => (
                  <button
                    key={lesson.id}
                    type="button"
                    className="th-lessons__result"
                    onClick={() => addLesson(lesson)}
                  >
                    {lesson.titleInternal}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="th-actions">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !title || !slug}
          className="th-btn th-btn--primary"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/account/hub/${hubSlug}/courses`)}
          className="th-btn"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
