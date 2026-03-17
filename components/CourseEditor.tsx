"use client";

/**
 * CourseEditor — create and edit Series.
 * CSS prefix: th-
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import FormattedEditor from "@/components/FormattedEditor";

interface Lesson {
  id: string;
  titleInternal: string;
  titleDisplayed: string;
  slug: string;
}

interface CourseLesson {
  lessonId: string;
  sortOrder: number;
  groupLabel: string; // section header before this lesson; "" = none
  lesson: Lesson;
}

interface CourseData {
  id?: string;
  title: string;
  slug: string;
  subheading: string;
  description: any; // Tiptap JSON
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
  const [description, setDescription] = useState<any>(initialData?.description ?? null);
  const [accessLevel, setAccessLevel] = useState<"MEMBERS" | "REGISTRATION_REQUIRED">(
    initialData?.accessLevel ?? "MEMBERS"
  );
  const [hideFromMemberProfile, setHideFromMemberProfile] = useState(initialData?.hideFromMemberProfile ?? false);
  const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? "");
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  // Lesson manager
  const [lessons, setLessons] = useState<CourseLesson[]>(
    initialData?.lessons?.map((cl) => ({ ...cl, groupLabel: cl.groupLabel ?? "" })) ?? []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Lesson[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Inline lesson creation
  const [showNewLessonForm, setShowNewLessonForm] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [creatingLesson, setCreatingLesson] = useState(false);

  // Auto-generate slug from title
  useEffect(() => {
    if (!isEditing && !slugTouched && title) {
      setSlug(slugify(title));
    }
  }, [title, isEditing, slugTouched]);

  // Lesson search (add existing)
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
      { lessonId: lesson.id, sortOrder: prev.length, groupLabel: "", lesson },
    ]);
    setSearchQuery("");
    setSearchResults([]);
  }

  function removeLesson(lessonId: string) {
    setLessons((prev) => prev.filter((l) => l.lessonId !== lessonId));
  }

  function updateGroupLabel(lessonId: string, value: string) {
    setLessons((prev) =>
      prev.map((l) => (l.lessonId === lessonId ? { ...l, groupLabel: value } : l))
    );
  }

  function handleDragStart(idx: number) { setDragIdx(idx); }

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

  function handleDragEnd() { setDragIdx(null); }

  // Create a new lesson inline and add it to this series
  async function handleCreateLesson() {
    if (!newLessonTitle.trim() || creatingLesson) return;
    setCreatingLesson(true);
    setError("");
    try {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleInternal: newLessonTitle.trim(),
          titleDisplayed: newLessonTitle.trim(),
          slug: slugify(newLessonTitle.trim()),
          accessLevel: "MEMBERS",
        }),
      });
      if (res.ok) {
        const newLesson = await res.json();
        setLessons((prev) => [
          ...prev,
          { lessonId: newLesson.id, sortOrder: prev.length, groupLabel: "", lesson: newLesson },
        ]);
        setNewLessonTitle("");
        setShowNewLessonForm(false);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create lesson");
      }
    } catch {
      setError("Network error");
    } finally {
      setCreatingLesson(false);
    }
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
        // Include groupLabel per lesson
        payload.lessonOrder = lessons.map((l) => ({
          id: l.lessonId,
          groupLabel: l.groupLabel || null,
        }));
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
      <div className="th-editor__header">
        <h2 className="th-editor__title">{isEditing ? "Edit Series" : "New Series"}</h2>
        {isEditing && slug && (
          <a href={`/course/${slug}`} target="_blank" rel="noopener noreferrer" className="th-link th-link--view">
            View series page →
          </a>
        )}
      </div>

      {error && <div className="th-msg th-msg--error">{error}</div>}
      {success && <div className="th-msg th-msg--success">Saved</div>}

      <div className="th-form">
        <label className="th-field">
          <span className="th-field__label">Series Title</span>
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

        <div className="th-field">
          <span className="th-field__label">Description</span>
          <FormattedEditor
            value={description}
            onChange={setDescription}
            placeholder="A brief description of this series…"
            minHeight={200}
          />
        </div>

        <fieldset className="th-field">
          <legend className="th-field__label">Who can access this series?</legend>
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

      {/* ── Lesson Manager (edit mode) ── */}
      {isEditing && (
        <div className="th-lessons">
          <h3 className="th-lessons__title">Lessons</h3>
          <p className="th-lessons__help">
            Drag to reorder. Add a section label above any lesson to create a visual divider on the series page.
          </p>

          {lessons.length === 0 ? (
            <p className="th-empty">No lessons yet — create one below or search to add an existing one.</p>
          ) : (
            <div className="th-lessons__list">
              {lessons.map((cl, i) => (
                <div key={cl.lessonId} className="th-lessons__group">
                  {/* Section label input — optional, shown above lesson row */}
                  <input
                    type="text"
                    placeholder="Section label (optional — e.g. Week 1)"
                    value={cl.groupLabel}
                    onChange={(e) => updateGroupLabel(cl.lessonId, e.target.value)}
                    className="th-lessons__group-input"
                    aria-label="Section label"
                  />
                  {/* Lesson row */}
                  <div
                    className={`th-lessons__item${dragIdx === i ? " th-lessons__item--dragging" : ""}`}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDragEnd={handleDragEnd}
                  >
                    <span className="th-lessons__handle" title="Drag to reorder">☰</span>
                    <span className="th-lessons__name">{cl.lesson.titleInternal}</span>
                    <a
                      href={`/lessons/${cl.lesson.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="th-link th-link--sm"
                    >
                      View →
                    </a>
                    <a
                      href={`/account/hub/${hubSlug}/lessons/${cl.lesson.slug}`}
                      className="th-link th-link--sm"
                    >
                      Edit ↗
                    </a>
                    <button
                      type="button"
                      className="th-btn th-btn--danger th-btn--small"
                      onClick={() => removeLesson(cl.lessonId)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Create new lesson inline ── */}
          <div className="th-lessons__new">
            {!showNewLessonForm ? (
              <button
                type="button"
                className="th-btn th-btn--primary th-btn--small"
                onClick={() => setShowNewLessonForm(true)}
              >
                + New Lesson
              </button>
            ) : (
              <div className="th-lessons__new-form">
                <input
                  type="text"
                  placeholder="Lesson title…"
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateLesson(); if (e.key === "Escape") { setShowNewLessonForm(false); setNewLessonTitle(""); } }}
                  className="th-input"
                  autoFocus
                />
                <div className="th-lessons__new-actions">
                  <button
                    type="button"
                    className="th-btn th-btn--primary th-btn--small"
                    onClick={handleCreateLesson}
                    disabled={creatingLesson || !newLessonTitle.trim()}
                  >
                    {creatingLesson ? "Creating…" : "Create & Add"}
                  </button>
                  <button
                    type="button"
                    className="th-btn th-btn--small"
                    onClick={() => { setShowNewLessonForm(false); setNewLessonTitle(""); }}
                  >
                    Cancel
                  </button>
                </div>
                <p className="th-muted">The lesson will be added to this series. Use Edit ↗ to add content.</p>
              </div>
            )}
          </div>

          {/* ── Add existing lesson by search ── */}
          <div className="th-lessons__add">
            <p className="th-lessons__add-label">Or add an existing lesson:</p>
            <input
              type="text"
              placeholder="Search lessons…"
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
          {saving ? "Saving…" : isEditing ? "Save Series" : "Create Series"}
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
