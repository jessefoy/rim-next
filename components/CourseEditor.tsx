"use client";

/**
 * CourseEditor — create and edit Series.
 * CSS prefix: th-
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import RimProseEditor from "@/components/RimProseEditor";
import ManualHelpIcon from "@/components/ManualHelpIcon";
import SlugField from "@/components/SlugField";

interface Lesson {
  id: string;
  titleInternal: string;
  titleDisplayed: string;
  slug: string;
  releaseDate?: string | null;       // fixed-date release (Lesson.releaseDate)
  releaseDelayDays?: number | null;  // per-lesson interval override (Lesson.releaseDelayDays)
}

interface CourseLesson {
  lessonId: string;
  sortOrder: number;
  groupLabel: string; // section header before this lesson; "" = none
  lesson: Lesson;
}

// Flat list item — either a section divider or a lesson
type ListItem =
  | { type: "section"; uid: string; label: string }
  | { type: "lesson"; lessonId: string; lesson: Lesson };

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "HOST",         label: "Host" },
  { value: "HOST_MANAGER", label: "Host Manager" },
  { value: "TEACHER",      label: "Teacher" },
  { value: "REGISTRAR",    label: "Registrar" },
  { value: "SUPPORT",      label: "Support" },
  { value: "ADMIN",        label: "Admin" },
];

interface CourseData {
  id?: string;
  title: string;
  slug: string;
  subheading: string;
  description: any; // Tiptap JSON
  accessLevel: "ALL_MEMBERS" | "REGISTRATION_REQUIRED" | "ROLE_REQUIRED";
  requiredRoles: string[];
  isOnboarding: boolean;
  hideFromMemberProfile: boolean;
  isActive: boolean;
  lessons?: CourseLesson[];
  dripEnabled?: boolean;
  dripIntervalDays?: number | null;
  hideLockedLessons?: boolean;
  completionNote?: string | null;
}

interface Props {
  basePath?: string;
  lessonBasePath?: string;
  initialData?: CourseData;
  isEditing: boolean;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Convert CourseLesson[] (with groupLabel) → flat ListItem[] */
function courseLessonsToList(cls: CourseLesson[]): ListItem[] {
  const items: ListItem[] = [];
  let uid = 0;
  for (const cl of cls) {
    if (cl.groupLabel) {
      items.push({ type: "section", uid: `s-${uid++}`, label: cl.groupLabel });
    }
    items.push({ type: "lesson", lessonId: cl.lessonId, lesson: cl.lesson });
  }
  return items;
}

/** Convert flat ListItem[] back to lessonOrder payload for the API */
function listToLessonOrder(
  items: ListItem[]
): { id: string; groupLabel: string | null }[] {
  const result: { id: string; groupLabel: string | null }[] = [];
  let pendingSection: string | null = null;
  for (const item of items) {
    if (item.type === "section") {
      pendingSection = item.label || null;
    } else {
      result.push({ id: item.lessonId, groupLabel: pendingSection });
      pendingSection = null; // only first lesson after section gets the label
    }
  }
  return result;
}

export default function CourseEditor({ basePath = "/tools/learning", lessonBasePath = "/tools/learning/lessons", initialData, isEditing }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [subheading, setSubheading] = useState(initialData?.subheading ?? "");
  const [description, setDescription] = useState<any>(initialData?.description ?? null);
  const [accessLevel, setAccessLevel] = useState<"ALL_MEMBERS" | "REGISTRATION_REQUIRED" | "ROLE_REQUIRED">(
    initialData?.accessLevel ?? "ALL_MEMBERS"
  );
  const [requiredRoles, setRequiredRoles] = useState<string[]>(
    initialData?.requiredRoles ?? []
  );
  const [isOnboarding, setIsOnboarding] = useState(initialData?.isOnboarding ?? false);
  const [hideFromMemberProfile, setHideFromMemberProfile] = useState(
    initialData?.hideFromMemberProfile ?? false
  );
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  const [completionNote, setCompletionNote] = useState(initialData?.completionNote ?? "");

  // Drip / scheduled release
  const [dripEnabled, setDripEnabled] = useState(initialData?.dripEnabled ?? false);
  const [hideLockedLessons, setHideLockedLessons] = useState(initialData?.hideLockedLessons ?? false);
  // Infer mode: if dripEnabled is true but dripIntervalDays is null, we're in fixed-date mode
  const [dripMode, setDripMode] = useState<"interval" | "fixed">(
    initialData?.dripEnabled && initialData?.dripIntervalDays == null ? "fixed" : "interval"
  );
  const [dripIntervalDays, setDripIntervalDays] = useState(
    String(initialData?.dripIntervalDays ?? "7")
  );
  // Fixed-date mode: per-lesson release dates (stored on Lesson.releaseDate)
  const [lessonReleaseDates, setLessonReleaseDates] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    initialData?.lessons?.forEach((cl) => {
      const rd = cl.lesson.releaseDate;
      if (rd) map[cl.lessonId] = (rd as string).slice(0, 10);
    });
    return map;
  });
  // Interval mode: per-lesson delay override (stored on Lesson.releaseDelayDays)
  const [lessonDelayDays, setLessonDelayDays] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    initialData?.lessons?.forEach((cl) => {
      if (cl.lesson.releaseDelayDays != null) {
        map[cl.lessonId] = String(cl.lesson.releaseDelayDays);
      }
    });
    return map;
  });

  // Flat list of sections + lessons
  const [items, setItems] = useState<ListItem[]>(() =>
    courseLessonsToList(
      initialData?.lessons?.map((cl) => ({ ...cl, groupLabel: cl.groupLabel ?? "" })) ?? []
    )
  );

  // Lesson search (add existing)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Lesson[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const uidCounter = useRef(100);

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
          const existingIds = new Set(
            items.filter((i) => i.type === "lesson").map((i) => (i as any).lessonId)
          );
          setSearchResults(data.filter((l: Lesson) => !existingIds.has(l.id)));
        }
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [searchQuery, items]);

  function addLesson(lesson: Lesson) {
    setItems((prev) => [...prev, { type: "lesson", lessonId: lesson.id, lesson }]);
    setSearchQuery("");
    setSearchResults([]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function addSection() {
    const uid = `s-${uidCounter.current++}`;
    setItems((prev) => [...prev, { type: "section", uid, label: "" }]);
  }

  function updateSectionLabel(uid: string, value: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.type === "section" && item.uid === uid ? { ...item, label: value } : item
      )
    );
  }

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setItems((prev) => {
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
          accessLevel: "ALL_MEMBERS",
        }),
      });
      if (res.ok) {
        const newLesson = await res.json();
        setItems((prev) => [
          ...prev,
          { type: "lesson", lessonId: newLesson.id, lesson: newLesson },
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
        requiredRoles: accessLevel === "ROLE_REQUIRED" ? requiredRoles : [],
        isOnboarding,
        hideFromMemberProfile,
        isActive,
        dripEnabled,
        dripIntervalDays: dripEnabled && dripMode === "interval" ? (parseInt(dripIntervalDays) || 7) : null,
        hideLockedLessons: dripEnabled ? hideLockedLessons : false,
        completionNote: completionNote.trim() || null,
      };

      if (isEditing) {
        payload.lessonOrder = listToLessonOrder(items);
        if (dripEnabled && dripMode === "fixed") {
          payload.lessonReleaseDates = lessonReleaseDates;
        }
        if (dripEnabled && dripMode === "interval") {
          payload.lessonDelayDays = lessonDelayDays;
        }
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
        router.push(`${basePath}/${created.slug}`);
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
        <ManualHelpIcon manualSlug="course-hub" />
        {isEditing && slug && (
          <a
            href={`/course/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="th-link th-link--view"
          >
            View series page →
          </a>
        )}
      </div>

      {error && <div className="th-msg th-msg--error">{error}</div>}
      {success && <div className="th-msg th-msg--success">Saved</div>}

      <div className="th-card">
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

        <SlugField
          value={slug}
          onChange={(v) => { setSlug(v); setSlugTouched(true); }}
          isEditing={isEditing}
          warnText="Changing the slug will break existing links to this series."
        />

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
          <RimProseEditor
            value={description}
            onChange={setDescription}
            placeholder="A brief description of this series…"
            minHeight={200}
          />
        </div>

        <label className="th-field">
          <span className="th-field__label">Completion note</span>
          <span className="th-field__help">Shown to members when they finish every lesson in this series. Optional — a sentence or two is enough.</span>
          <textarea
            value={completionNote}
            onChange={(e) => setCompletionNote(e.target.value)}
            className="th-input th-input--textarea"
            rows={3}
            placeholder="e.g. You've completed this series. Take time to rest in what you've discovered."
          />
        </label>

        <fieldset className="th-field">
          <legend className="th-field__label">Who can access this series?</legend>
          <label className="th-radio">
            <input
              type="radio"
              checked={accessLevel === "ALL_MEMBERS"}
              onChange={() => { setAccessLevel("ALL_MEMBERS"); setRequiredRoles([]); }}
            />
            All Members
          </label>
          <label className="th-radio">
            <input
              type="radio"
              checked={accessLevel === "REGISTRATION_REQUIRED"}
              onChange={() => { setAccessLevel("REGISTRATION_REQUIRED"); setRequiredRoles([]); }}
            />
            Registration Required
          </label>
          <label className="th-radio">
            <input
              type="radio"
              checked={accessLevel === "ROLE_REQUIRED"}
              onChange={() => setAccessLevel("ROLE_REQUIRED")}
            />
            Role Required
          </label>
          {accessLevel === "ROLE_REQUIRED" && (
            <div className="th-roles-select">
              <p className="th-field__hint">Members with any of these roles can access this series:</p>
              {ROLE_OPTIONS.map((opt) => (
                <label key={opt.value} className="th-checkbox th-checkbox--sm">
                  <input
                    type="checkbox"
                    checked={requiredRoles.includes(opt.value)}
                    onChange={(e) => {
                      setRequiredRoles((prev) =>
                        e.target.checked
                          ? [...prev, opt.value]
                          : prev.filter((r) => r !== opt.value)
                      );
                    }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <label className="th-checkbox">
          <input
            type="checkbox"
            checked={isOnboarding}
            onChange={(e) => setIsOnboarding(e.target.checked)}
          />
          Auto-enroll new members (onboarding series)
        </label>

        {/* ── Release Schedule ── */}
        <fieldset className="th-field">
          <legend className="th-field__label">Release Schedule</legend>
          <label className="th-checkbox">
            <input
              type="checkbox"
              checked={dripEnabled}
              onChange={(e) => setDripEnabled(e.target.checked)}
            />
            Release lessons on a schedule
          </label>

          {dripEnabled && (
            <div className="th-drip-options">
              <label className="th-radio">
                <input
                  type="radio"
                  checked={dripMode === "interval"}
                  onChange={() => setDripMode("interval")}
                />
                Interval — set a delay per lesson below
              </label>
              {dripMode === "interval" && (
                <p className="th-field__hint" style={{ marginLeft: 24 }}>
                  Default interval (used when no per-lesson override is set):{" "}
                  <input
                    type="number"
                    min="1"
                    value={dripIntervalDays}
                    onChange={(e) => setDripIntervalDays(e.target.value)}
                    className="th-input th-input--inline"
                  />{" "}
                  days
                </p>
              )}
              <label className="th-radio">
                <input
                  type="radio"
                  checked={dripMode === "fixed"}
                  onChange={() => setDripMode("fixed")}
                />
                Fixed dates — set a release date per lesson below
              </label>
              <div className="th-drip-options__divider" />
              <label className="th-checkbox">
                <input
                  type="checkbox"
                  checked={hideLockedLessons}
                  onChange={(e) => setHideLockedLessons(e.target.checked)}
                />
                Hide locked lessons from members until they become available
              </label>
              <p className="th-field__hint" style={{ marginLeft: 24 }}>
                When checked, members only see lessons that are currently available. When unchecked, upcoming lessons are visible with a lock icon and release date.
              </p>
            </div>
          )}
        </fieldset>

        <label className="th-checkbox">
          <input
            type="checkbox"
            checked={hideFromMemberProfile}
            onChange={(e) => setHideFromMemberProfile(e.target.checked)}
          />
          Hide from member profile
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
      </div>

      {/* ── Lesson Manager (edit mode) ── */}
      {isEditing && (
        <div className="th-card">
        <div className="th-lessons" style={{ border: 'none', margin: 0, padding: 0 }}>
          <h3 className="th-lessons__title">Lessons</h3>
          <p className="th-lessons__help">
            Drag rows to reorder. Use{" "}
            <strong>+ Add Section</strong> to insert a labeled divider between lessons.
          </p>

          {items.length === 0 ? (
            <p className="th-empty">
              No lessons yet — create one below or search to add an existing one.
            </p>
          ) : (
            <div className="th-lessons__list">
              {items.map((item, i) =>
                item.type === "section" ? (
                  /* Section divider row */
                  <div
                    key={item.uid}
                    className={`th-section-row${dragIdx === i ? " th-lessons__item--dragging" : ""}`}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDragEnd={handleDragEnd}
                  >
                    <span className="th-lessons__handle" title="Drag to reorder">☰</span>
                    <span className="th-section-row__tag">Section</span>
                    <input
                      type="text"
                      placeholder="Section title (e.g. Week 1)"
                      value={item.label}
                      onChange={(e) => updateSectionLabel(item.uid, e.target.value)}
                      className="th-section-row__input"
                      aria-label="Section title"
                    />
                    <button
                      type="button"
                      className="th-section-row__remove"
                      onClick={() => removeItem(i)}
                      title="Remove section"
                      aria-label="Remove section"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  /* Lesson row */
                  <div
                    key={item.lessonId}
                    className={`th-lessons__item${dragIdx === i ? " th-lessons__item--dragging" : ""}`}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDragEnd={handleDragEnd}
                  >
                    <span className="th-lessons__handle" title="Drag to reorder">☰</span>
                    <span className="th-lessons__name">{item.lesson.titleInternal}</span>
                    {dripEnabled && dripMode === "interval" && (() => {
                      const lessonItems = items.filter((it) => it.type === "lesson");
                      const lessonIdx = lessonItems.findIndex((it) => (it as any).lessonId === item.lessonId);
                      const defaultDelay = lessonIdx <= 0 ? 0 : lessonIdx * (parseInt(dripIntervalDays) || 7);
                      return (
                        <label className="th-drip-delay-label">
                          <span className="th-drip-delay-label__text">Unlock after</span>
                          <input
                            type="number"
                            min="0"
                            placeholder={String(defaultDelay)}
                            className="th-input th-input--inline"
                            value={lessonDelayDays[item.lessonId] ?? ""}
                            onChange={(e) =>
                              setLessonDelayDays((prev) => ({
                                ...prev,
                                [item.lessonId]: e.target.value,
                              }))
                            }
                            aria-label={`Release delay for ${item.lesson.titleInternal}`}
                          />
                          <span className="th-drip-delay-label__text">days</span>
                        </label>
                      );
                    })()}
                    {dripEnabled && dripMode === "fixed" && (
                      <input
                        type="date"
                        className="th-input th-input--date"
                        value={lessonReleaseDates[item.lessonId] ?? ""}
                        onChange={(e) =>
                          setLessonReleaseDates((prev) => ({
                            ...prev,
                            [item.lessonId]: e.target.value,
                          }))
                        }
                        aria-label={`Release date for ${item.lesson.titleInternal}`}
                      />
                    )}
                    <a
                      href={`/lessons/${item.lesson.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="th-link th-link--sm"
                    >
                      View →
                    </a>
                    <a
                      href={`${lessonBasePath}/${item.lesson.slug}`}
                      className="th-link th-link--sm"
                    >
                      Edit ↗
                    </a>
                    <button
                      type="button"
                      className="th-btn th-btn--danger th-btn--small"
                      onClick={() => removeItem(i)}
                    >
                      Remove
                    </button>
                  </div>
                )
              )}
            </div>
          )}

          {/* ── Drip interval preview ── */}
          {dripEnabled && dripMode === "interval" && items.filter((i) => i.type === "lesson").length > 0 && (
            <div className="th-drip-preview">
              {items.filter((i) => i.type === "lesson").map((item, idx) => {
                const lessonId = (item as any).lessonId;
                const override = lessonDelayDays[lessonId];
                const days = override !== undefined && override !== ""
                  ? parseInt(override) || 0
                  : idx * (parseInt(dripIntervalDays) || 7);
                return (
                  <p key={lessonId} className="th-drip-preview__row">
                    Lesson {idx + 1}: {days === 0 ? "available immediately" : `${days} days after enrollment`}
                    {override !== undefined && override !== "" && <span className="th-drip-preview__custom"> (custom)</span>}
                  </p>
                );
              })}
            </div>
          )}

          {/* ── Add section button ── */}
          <div className="th-lessons__add-section">
            <button
              type="button"
              className="th-btn th-btn--ghost th-btn--small"
              onClick={addSection}
            >
              + Add Section
            </button>
          </div>

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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateLesson();
                    if (e.key === "Escape") {
                      setShowNewLessonForm(false);
                      setNewLessonTitle("");
                    }
                  }}
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
                    onClick={() => {
                      setShowNewLessonForm(false);
                      setNewLessonTitle("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
                <p className="th-muted">
                  The lesson will be added to this series. Use Edit ↗ to add content.
                </p>
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
          onClick={() => router.push(basePath)}
          className="th-btn"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
