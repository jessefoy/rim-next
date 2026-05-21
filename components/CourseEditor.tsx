"use client";

/**
 * CourseEditor — create and edit Series.
 * CSS prefix: th-
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { isHtmlString, renderBlockNoteHtml } from "@/lib/renderRichContent";

const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div style={{ minHeight: 100 }} /> },
);
import ManualHelpIcon from "@/components/ManualHelpIcon";
import SlugField from "@/components/SlugField";

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

// Flat list item — either a section divider or a lesson
type ListItem =
  | { type: "section"; uid: string; label: string }
  | { type: "lesson"; lessonId: string; lesson: Lesson };

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "HOST",         label: "Host" },
  { value: "HOST_MANAGER", label: "Host Manager" },
  { value: "TEACHER",      label: "Teacher" },
  { value: "REGISTRAR",    label: "Registrar" },
  { value: "ADMIN",        label: "Admin" },
];

interface CourseData {
  id?: string;
  title: string;
  slug: string;
  subheading: string;
  description: any; // Tiptap JSON
  // Orthogonal-flag access model (session 123).
  allowSelfEnroll: boolean;
  selfEnrollDanaRequired: boolean;
  accessRestrictionMessage: string;
  requiredRoles: string[];
  // Landing-page content
  heroImage: string;
  pullQuote: string;
  pullQuoteSource: string;
  danaText: string;
  // Existing flags
  isOnboarding: boolean;
  publishOnPublicCatalog: boolean;
  hideFromMemberProfile: boolean;
  isActive: boolean;
  lessons?: CourseLesson[];
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
  const [description, setDescription] = useState<string>(() => {
    const v = initialData?.description;
    if (isHtmlString(v)) return v;
    return renderBlockNoteHtml(v) || "";
  });
  // ── Orthogonal-flag access controls (session 123) ──
  const [allowSelfEnroll, setAllowSelfEnroll] = useState(
    initialData?.allowSelfEnroll ?? false
  );
  const [selfEnrollDanaRequired, setSelfEnrollDanaRequired] = useState(
    initialData?.selfEnrollDanaRequired ?? false
  );
  const [accessRestrictionMessage, setAccessRestrictionMessage] = useState(
    initialData?.accessRestrictionMessage ?? ""
  );
  const [requiredRoles, setRequiredRoles] = useState<string[]>(
    initialData?.requiredRoles ?? []
  );
  const [roleGateOn, setRoleGateOn] = useState(
    (initialData?.requiredRoles?.length ?? 0) > 0
  );

  // ── Landing-page content ──
  const [heroImage, setHeroImage] = useState(initialData?.heroImage ?? "");
  const [pullQuote, setPullQuote] = useState(initialData?.pullQuote ?? "");
  const [pullQuoteSource, setPullQuoteSource] = useState(
    initialData?.pullQuoteSource ?? ""
  );
  const [danaText, setDanaText] = useState(initialData?.danaText ?? "");
  const [isOnboarding, setIsOnboarding] = useState(initialData?.isOnboarding ?? false);
  const [publishOnPublicCatalog, setPublishOnPublicCatalog] = useState(
    initialData?.publishOnPublicCatalog ?? false
  );
  const [hideFromMemberProfile, setHideFromMemberProfile] = useState(
    initialData?.hideFromMemberProfile ?? false
  );
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  const [completionNote, setCompletionNote] = useState(initialData?.completionNote ?? "");

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
      // Orthogonal-flag payload (session 123). The API derives the legacy
      // accessLevel from these on write, so we don't need to send it.
      const payload: Record<string, unknown> = {
        title,
        slug,
        subheading,
        description,
        // Access model
        allowSelfEnroll,
        selfEnrollDanaRequired: allowSelfEnroll && selfEnrollDanaRequired,
        requiredRoles: roleGateOn ? requiredRoles : [],
        accessRestrictionMessage: accessRestrictionMessage.trim() || null,
        // Landing-page content
        heroImage: heroImage.trim() || null,
        pullQuote: pullQuote.trim() || null,
        pullQuoteSource: pullQuoteSource.trim() || null,
        danaText: danaText.trim() || null,
        // Existing flags
        isOnboarding,
        publishOnPublicCatalog,
        hideFromMemberProfile,
        isActive,
        completionNote: completionNote.trim() || null,
      };

      if (isEditing) {
        payload.lessonOrder = listToLessonOrder(items);
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
          <RimTiptapEditor
            value={description}
            onChange={setDescription}
            placeholder="A brief description of this series…"
            variant="message"
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

        <div className="th-section-break" />

        {/* ── Landing-page content ──
            Surfaces on /course/[slug] when a visitor lands without being
            enrolled. Mirrors the Program landing fields so the two offering
            types feel like peers. */}
        <h3 className="th-form__group-heading">Landing page</h3>
        <p className="th-form__group-hint">
          Shown on <code>/course/[slug]</code> to non-enrolled visitors. All optional;
          a course with no hero image falls back to the default Bodhi-Leaves background.
        </p>

        <label className="th-field">
          <span className="th-field__label">Hero image URL</span>
          <span className="th-field__help">
            Background image for the landing hero. Paste a full URL — image upload
            arrives in a later pass.
          </span>
          <input
            type="text"
            value={heroImage}
            onChange={(e) => setHeroImage(e.target.value)}
            className="th-input"
            placeholder="https://…"
          />
        </label>

        <label className="th-field">
          <span className="th-field__label">Pull quote</span>
          <span className="th-field__help">A short quote shown as a float-up card between the hero and description.</span>
          <textarea
            value={pullQuote}
            onChange={(e) => setPullQuote(e.target.value)}
            className="th-input th-input--textarea"
            rows={2}
            placeholder="e.g. The mind is everything. What you think, you become."
          />
        </label>

        <label className="th-field">
          <span className="th-field__label">Pull quote source</span>
          <input
            type="text"
            value={pullQuoteSource}
            onChange={(e) => setPullQuoteSource(e.target.value)}
            className="th-input"
            placeholder="e.g. The Buddha"
          />
        </label>

        <label className="th-field">
          <span className="th-field__label">Dana text</span>
          <span className="th-field__help">
            The dana ask shown in the "About this course" block on the landing.
            Mirrors the same field on Programs.
          </span>
          <textarea
            value={danaText}
            onChange={(e) => setDanaText(e.target.value)}
            className="th-input th-input--textarea"
            rows={3}
            placeholder="e.g. This course is offered freely. Dana — generosity — is welcomed."
          />
        </label>

        <div className="th-section-break" />

        {/* ── Access model ──
            Orthogonal flags (session 123). The legacy "Who can access?"
            radio group was replaced by these checkboxes; the API derives
            a legacy accessLevel value from them on save. */}
        <h3 className="th-form__group-heading">Access</h3>
        <p className="th-form__group-hint">
          Each control is independent. Combine them to express different course shapes
          (free for all, dana-required, role-locked, bundled with a live program, etc.).
          See the <a href="/admin/manual/course-hub" target="_blank" rel="noopener noreferrer" className="th-link th-link--sm">Course Hub manual chapter</a> for examples.
        </p>

        <label className="th-checkbox">
          <input
            type="checkbox"
            checked={allowSelfEnroll}
            onChange={(e) => setAllowSelfEnroll(e.target.checked)}
          />
          Members can self-enroll
          <span className="th-checkbox__hint">
            Shows an "Enroll" button on the course landing page. Leave off for
            courses that are only available through a live program registration
            or admin grant.
          </span>
        </label>

        {allowSelfEnroll && (
          <label className="th-checkbox" style={{ marginLeft: 24 }}>
            <input
              type="checkbox"
              checked={selfEnrollDanaRequired}
              onChange={(e) => setSelfEnrollDanaRequired(e.target.checked)}
            />
            Require dana before enrolling
            <span className="th-checkbox__hint">
              Self-enrollment routes through Stripe Checkout before granting access.
              Use the Dana text field above to describe the offering.
            </span>
          </label>
        )}

        <label className="th-checkbox">
          <input
            type="checkbox"
            checked={roleGateOn}
            onChange={(e) => {
              setRoleGateOn(e.target.checked);
              if (!e.target.checked) setRequiredRoles([]);
            }}
          />
          Restrict to specific roles
          <span className="th-checkbox__hint">
            Only members holding at least one selected role can see or enroll in
            this course. Admin always bypasses.
          </span>
        </label>

        {roleGateOn && (
          <div className="th-roles-select">
            <p className="th-field__hint">Eligible roles:</p>
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

        <label className="th-field">
          <span className="th-field__label">Access restriction message</span>
          <span className="th-field__help">
            Friendly message shown to visitors who can&rsquo;t enroll (no role, no live cohort
            open, manual-grant-only). Leave blank to use a derived default.
          </span>
          <textarea
            value={accessRestrictionMessage}
            onChange={(e) => setAccessRestrictionMessage(e.target.value)}
            className="th-input th-input--textarea"
            rows={2}
            placeholder="e.g. This course is offered to teacher trainees. If you're considering training, get in touch."
          />
        </label>

        <label className="th-checkbox">
          <input
            type="checkbox"
            checked={isOnboarding}
            onChange={(e) => setIsOnboarding(e.target.checked)}
          />
          Auto-enroll new members (onboarding series)
        </label>

        <label className="th-checkbox">
          <input
            type="checkbox"
            checked={publishOnPublicCatalog}
            onChange={(e) => setPublishOnPublicCatalog(e.target.checked)}
          />
          Show on the public /courses catalog
          <span className="th-checkbox__hint">
            Off for onboarding, internal training, and role-assigned courses.
          </span>
        </label>

        <div className="th-section-break" />

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
