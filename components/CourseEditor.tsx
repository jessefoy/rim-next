"use client";

/**
 * CourseEditor — create and edit Courses (Series).
 *
 * Tabbed restructure (session 123, slice 5) mirrors ProgramEditor's
 * pattern so the two editors feel like peers. Eight tabs:
 *
 *   Content    — title, slug, subheading, description, completion note
 *   Lessons    — lesson list manager (edit mode only)
 *   Landing    — hero image, pull quote, dana page note
 *   Categories — assign + inline category CRUD
 *   Access     — self-enroll toggle, role gate, restriction message
 *   Schedule   — placeholder; drip release is the next slice
 *   Dana       — mode picker (none/voluntary/base+dana/fixed) + amounts + message
 *   Visibility — active, public catalog, onboarding, hide from profile, sort
 *
 * CSS prefix: pe- (shared with ProgramEditor) for the chrome; th- still
 * used for the lesson list rows (no need to rename mid-slice).
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { isHtmlString, renderBlockNoteHtml } from "@/lib/renderRichContent";

const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div style={{ minHeight: 100 }} /> },
);
import SlugField from "@/components/SlugField";
import { SaveNote } from "@/components/FormDone";

// ── Types ────────────────────────────────────────────────────────────────────

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

interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder?: number;
  _count?: { courses: number };
}

interface CourseData {
  id?: string;
  title: string;
  slug: string;
  subheading: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  description: any; // Tiptap JSON or legacy BlockNote
  // Orthogonal-flag access model (session 123).
  allowSelfEnroll: boolean;
  accessRestrictionMessage: string;
  requiredRoles: string[];
  // Landing-page content
  heroImage: string;
  pullQuote: string;
  pullQuoteSource: string;
  danaText: string;
  // Category
  categoryId: string;
  // Dana model (session 123, slice 5)
  danaMode: string; // "none" | "voluntary" | "base_plus_dana" | "fixed"
  suggestedDana: string;
  danaBaseAmount: string;
  danaFixedAmount: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  danaMessage: any;
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
  categories?: Category[];
  isEditing: boolean;
}

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "HOST_MANAGER", label: "Scheduling manager" },
  { value: "TEACHER",      label: "Teacher" },
  { value: "REGISTRAR",    label: "Registrar" },
  { value: "ADMIN",        label: "Admin" },
];

const TABS = [
  "Content",
  "Lessons",
  "Landing",
  "Categories",
  "Access",
  "Schedule",
  "Dana",
  "Visibility",
] as const;
type Tab = typeof TABS[number];

const DANA_MODES = [
  { value: "none", label: "None", help: "No dana step. Use for onboarding, role-assigned, or courses that never ask for payment." },
  { value: "voluntary", label: "Voluntary", help: "Pay what you want. A suggested amount can be shown as the default." },
  { value: "base_plus_dana", label: "Base + Dana", help: "Minimum required, optional more on top." },
  { value: "fixed", label: "Fixed", help: "Exact amount. No picker, no extra." },
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Component ────────────────────────────────────────────────────────────────

export default function CourseEditor({
  basePath = "/tools/learning",
  lessonBasePath = "/tools/learning/lessons",
  initialData,
  categories: initialCategories,
  isEditing,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState("");
  // A save that moved the page to a new address carries its answer here.
  useEffect(() => {
    const url = new URL(window.location.href);
    const saved = url.searchParams.get("saved");
    if (!saved) return;
    setSuccess(true);
    setSavedAt(saved);
    url.searchParams.delete("saved");
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);
  const [success, setSuccess] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [tab, setTab] = useState<Tab>("Content");

  // ── Content ──
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [subheading, setSubheading] = useState(initialData?.subheading ?? "");
  const [description, setDescription] = useState<string>(() => {
    const v = initialData?.description;
    if (isHtmlString(v)) return v;
    return renderBlockNoteHtml(v) || "";
  });
  const [completionNote, setCompletionNote] = useState(initialData?.completionNote ?? "");

  // ── Landing ──
  const [heroImage, setHeroImage] = useState(initialData?.heroImage ?? "");
  const [pullQuote, setPullQuote] = useState(initialData?.pullQuote ?? "");
  const [pullQuoteSource, setPullQuoteSource] = useState(initialData?.pullQuoteSource ?? "");
  const [danaText, setDanaText] = useState(initialData?.danaText ?? "");

  // ── Categories ──
  const [categoryId, setCategoryId] = useState(initialData?.categoryId ?? "");
  const [categories, setCategories] = useState<Category[]>(initialCategories ?? []);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  // Deleting a category asks first, and its answer stays on that row.
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<string | null>(null);
  const [deletingCat, setDeletingCat] = useState(false);
  const [deleteCatProblem, setDeleteCatProblem] = useState<{ id: string; msg: string } | null>(null);

  // ── Access ──
  const [allowSelfEnroll, setAllowSelfEnroll] = useState(initialData?.allowSelfEnroll ?? false);
  const [accessRestrictionMessage, setAccessRestrictionMessage] = useState(
    initialData?.accessRestrictionMessage ?? ""
  );
  const [requiredRoles, setRequiredRoles] = useState<string[]>(initialData?.requiredRoles ?? []);
  const [roleGateOn, setRoleGateOn] = useState((initialData?.requiredRoles?.length ?? 0) > 0);

  // ── Dana ──
  const [danaMode, setDanaMode] = useState(initialData?.danaMode ?? "none");
  const [suggestedDana, setSuggestedDana] = useState(initialData?.suggestedDana ?? "");
  const [danaBaseAmount, setDanaBaseAmount] = useState(initialData?.danaBaseAmount ?? "");
  const [danaFixedAmount, setDanaFixedAmount] = useState(initialData?.danaFixedAmount ?? "");
  const [danaMessage, setDanaMessage] = useState<string>(() => {
    const v = initialData?.danaMessage;
    if (isHtmlString(v)) return v;
    return renderBlockNoteHtml(v) || "";
  });

  // ── Visibility ──
  const [isOnboarding, setIsOnboarding] = useState(initialData?.isOnboarding ?? false);
  const [publishOnPublicCatalog, setPublishOnPublicCatalog] = useState(
    initialData?.publishOnPublicCatalog ?? false
  );
  const [hideFromMemberProfile, setHideFromMemberProfile] = useState(
    initialData?.hideFromMemberProfile ?? false
  );
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  // ── Lesson list (edit mode) ──
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

  // ── Unsaved changes (mirrors ProgramEditor's guardedNavigate) ──
  const [dirty, setDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  // Escape closes the leave dialog wherever focus is (2026-10-19 review).
  useEffect(() => {
    if (!pendingNav) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPendingNav(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pendingNav]);

  // An edit after a save: "Saved" no longer describes the page, and there is
  // now something to lose. Searches and the new-category and new-lesson
  // boxes (which save themselves) are marked data-transient.
  function noteEdit(e: React.SyntheticEvent) {
    setSuccess(false);
    if (!(e.target as HTMLElement).closest("[data-transient]")) setDirty(true);
  }

  /** Wrap navigation: with unsaved changes, ask before leaving. */
  function guardedNavigate(href: string) {
    if (dirty) setPendingNav(href);
    else router.push(href);
  }

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Auto-generate slug from title
  useEffect(() => {
    if (!isEditing && !slugTouched && title) {
      setSlug(slugify(title));
    }
  }, [title, isEditing, slugTouched]);

  // Load categories client-side if not pre-loaded (create mode).
  useEffect(() => {
    if (initialCategories) return;
    (async () => {
      try {
        const res = await fetch("/api/courses/categories?all=true");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setCategories(data);
        }
      } catch {
        // non-fatal
      }
    })();
  }, [initialCategories]);

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
            items.filter((i) => i.type === "lesson").map((i) => (i as { type: "lesson"; lessonId: string }).lessonId)
          );
          setSearchResults(data.filter((l: Lesson) => !existingIds.has(l.id)));
        }
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [searchQuery, items]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function addLesson(lesson: Lesson) {
    setDirty(true);
    setItems((prev) => [...prev, { type: "lesson", lessonId: lesson.id, lesson }]);
    setSearchQuery("");
    setSearchResults([]);
  }

  function removeItem(idx: number) {
    setDirty(true);
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function addSection() {
    const uid = `s-${uidCounter.current++}`;
    setDirty(true);
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
    setDirty(true);
  }

  function handleDragEnd() {
    setDragIdx(null);
  }

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
        setDirty(true);
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

  async function handleCreateCategory() {
    const name = newCategoryName.trim();
    if (!name || creatingCategory) return;
    setCreatingCategory(true);
    setCategoryError("");
    try {
      const res = await fetch("/api/courses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const created = await res.json();
        setCategories((prev) =>
          [...prev, { ...created, _count: { courses: 0 } }].sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        );
        setCategoryId(created.id); // auto-select the new category
        setDirty(true); // the course's category changed; it saves with the course
        setNewCategoryName("");
      } else {
        const data = await res.json().catch(() => ({}));
        setCategoryError(data?.error ?? "Failed to create category");
      }
    } catch {
      setCategoryError("Network error");
    } finally {
      setCreatingCategory(false);
    }
  }

  async function handleDeleteCategory(catId: string) {
    if (deletingCat) return;
    setDeleteCatProblem(null);
    setDeletingCat(true);
    try {
      const res = await fetch(`/api/courses/categories?id=${encodeURIComponent(catId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== catId));
        if (categoryId === catId) setCategoryId("");
        setConfirmDeleteCat(null);
      } else {
        const data = await res.json().catch(() => ({}));
        // The server explains a category that still has courses; anything
        // else gets a plain sentence.
        setDeleteCatProblem({
          id: catId,
          msg: res.status === 409 && data?.error
            ? data.error
            : "This category was not deleted. Please try again.",
        });
      }
    } catch {
      setDeleteCatProblem({
        id: catId,
        msg: "This category was not deleted because the connection was lost. Please try again.",
      });
    } finally {
      setDeletingCat(false);
    }
  }

  async function handleSave() {
    setError("");
    setSuccess(false);
    setSaving(true);

    try {
      // Dana fields — coerce to numbers only when relevant for the chosen mode,
      // null out the rest so the DB stays clean.
      const payload: Record<string, unknown> = {
        title,
        slug,
        subheading,
        description,
        // Access
        allowSelfEnroll,
        requiredRoles: roleGateOn ? requiredRoles : [],
        accessRestrictionMessage: accessRestrictionMessage.trim() || null,
        // Category
        categoryId: categoryId || null,
        // Landing
        heroImage: heroImage.trim() || null,
        pullQuote: pullQuote.trim() || null,
        pullQuoteSource: pullQuoteSource.trim() || null,
        danaText: danaText.trim() || null,
        // Dana model
        danaMode,
        suggestedDana:
          (danaMode === "voluntary" || danaMode === "base_plus_dana") && suggestedDana
            ? Number(suggestedDana)
            : null,
        danaBaseAmount:
          danaMode === "base_plus_dana" && danaBaseAmount ? Number(danaBaseAmount) : null,
        danaFixedAmount:
          danaMode === "fixed" && danaFixedAmount ? Number(danaFixedAmount) : null,
        danaMessage: danaMode !== "none" ? danaMessage : null,
        // Derived mirror — kept in sync with danaMode for legacy reads.
        selfEnrollDanaRequired: danaMode !== "none",
        // Existing flags
        isOnboarding,
        publishOnPublicCatalog,
        hideFromMemberProfile,
        isActive,
        completionNote: (completionNote ?? "").trim() || null,
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

      setDirty(false);
      if (isEditing) {
        setSuccess(true);
        setSavedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
        // A saved new address: the page moves to it, or every later save
        // would go to the old one and fail (2026-10-19). The page remounts there,
        // so the answer travels in ?saved= and is read back below.
        if (slug !== initialData?.slug) router.replace(`${basePath}/${slug}?saved=${encodeURIComponent(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }))}`);
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    // An edit after a save: "Saved" no longer describes the page.
    <div className="pe-editor" onChangeCapture={noteEdit} onInputCapture={noteEdit} onClickCapture={(e) => { if ((e.target as HTMLElement).closest("button")) setSuccess(false); }}>
      {/* ── Unsaved changes confirmation (as in ProgramEditor) ── */}
      {pendingNav && (
        <div className="pe-overlay" onClick={() => setPendingNav(null)}>
          <div className="pe-dialog" role="dialog" aria-modal="true" aria-labelledby="ce-leave-text" onClick={(e) => e.stopPropagation()}>
            <p className="pe-dialog__text" id="ce-leave-text">You have unsaved changes. Leave without saving?</p>
            <div className="pe-dialog__actions">
              <button type="button" className="pe-btn pe-btn--primary" onClick={() => setPendingNav(null)} autoFocus>
                Stay on this page
              </button>
              <button
                type="button"
                className="pe-btn"
                onClick={() => { setDirty(false); router.push(pendingNav); }}
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="pe-editor__header">
        <h2 className="pe-editor__title">{isEditing ? "Edit Course" : "New Course"}</h2>
        {isEditing && slug && (
          <a
            href={`/course/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="pe-link pe-link--view"
          >
            View course page →
          </a>
        )}
      </div>


      {/* ── Tab bar ── */}
      <div className="pe-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`pe-tabs__tab${tab === t ? " pe-tabs__tab--active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
         TAB — Content
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === "Content" && (
        <div className="pe-card">
          <div className="pe-form">
            <label className="pe-field">
              <span className="pe-field__label">Course Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="pe-input"
                required
              />
            </label>

            <SlugField
              value={slug}
              onChange={(v) => { setSlug(v); setSlugTouched(true); }}
              isEditing={isEditing}
              warnText="Changing the slug will break existing links to this course."
            />

            <label className="pe-field">
              <span className="pe-field__label">Subheading</span>
              <span className="pe-field__help">A short tagline shown under the title on the landing.</span>
              <input
                type="text"
                value={subheading}
                onChange={(e) => setSubheading(e.target.value)}
                className="pe-input"
              />
            </label>

            <div className="pe-field">
              <span className="pe-field__label">Description</span>
              <span className="pe-field__help">The main body of the course landing page. Mirrors the Program description field.</span>
              <RimTiptapEditor
                value={description}
                onChange={(v) => { setDescription(v); setDirty(true); }}
                placeholder="A description of this course…"
                variant="message"
              />
            </div>

            <label className="pe-field">
              <span className="pe-field__label">Completion Note</span>
              <span className="pe-field__help">Shown to members when they finish every lesson in this course. Optional — a sentence or two is enough.</span>
              <textarea
                value={completionNote ?? ""}
                onChange={(e) => setCompletionNote(e.target.value)}
                className="pe-input pe-input--textarea"
                rows={3}
                placeholder="e.g. You've completed this course. Take time to rest in what you've discovered."
              />
            </label>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
         TAB — Lessons (edit mode only)
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === "Lessons" && (
        <div className="pe-card">
          {!isEditing ? (
            <p className="pe-empty">
              Save the course first, then you can add lessons.
            </p>
          ) : (
            <div className="th-lessons" style={{ border: "none", margin: 0, padding: 0 }}>
              <p className="th-lessons__help">
                Drag rows to reorder. Use <strong>+ Add Section</strong> to insert a labeled
                divider between lessons.
              </p>

              {items.length === 0 ? (
                <p className="th-empty">
                  No lessons yet — create one below or search to add an existing one.
                </p>
              ) : (
                <div className="th-lessons__list">
                  {items.map((item, i) =>
                    item.type === "section" ? (
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

              <div className="th-lessons__add-section">
                <button
                  type="button"
                  className="th-btn th-btn--ghost th-btn--small"
                  onClick={addSection}
                >
                  + Add Section
                </button>
              </div>

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
                      aria-label="New lesson title"
                      data-transient
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
                      The lesson will be added to this course. Use Edit ↗ to add content.
                    </p>
                  </div>
                )}
              </div>

              <div className="th-lessons__add">
                <label className="th-lessons__add-label" htmlFor="ce-lesson-search" style={{ display: "block" }}>Or add an existing lesson:</label>
                <input
                  id="ce-lesson-search"
                  data-transient
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
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
         TAB — Landing
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === "Landing" && (
        <div className="pe-card">
          <div className="pe-form">
            <p className="pe-card__help">
              Shown on <code>/course/[slug]</code> to non-enrolled visitors. Mirrors the
              corresponding fields on Programs. All optional — a course with no hero image
              falls back to the default Bodhi-Leaves background.
            </p>

            <label className="pe-field">
              <span className="pe-field__label">Hero Image URL</span>
              <span className="pe-field__help">
                Background image for the landing hero. Paste a full URL — image upload arrives in a later pass.
              </span>
              <input
                type="text"
                value={heroImage}
                onChange={(e) => setHeroImage(e.target.value)}
                className="pe-input"
                placeholder="https://…"
              />
            </label>

            <label className="pe-field">
              <span className="pe-field__label">Pull Quote</span>
              <span className="pe-field__help">A short quote shown as a float-up card between the hero and description.</span>
              <textarea
                value={pullQuote}
                onChange={(e) => setPullQuote(e.target.value)}
                className="pe-input pe-input--textarea"
                rows={2}
                placeholder="e.g. The mind is everything. What you think, you become."
              />
            </label>

            <label className="pe-field">
              <span className="pe-field__label">Pull Quote Source</span>
              <input
                type="text"
                value={pullQuoteSource}
                onChange={(e) => setPullQuoteSource(e.target.value)}
                className="pe-input"
                placeholder="e.g. The Buddha"
              />
            </label>

            <label className="pe-field">
              <span className="pe-field__label">Dana Page Note</span>
              <span className="pe-field__help">
                Short note about dana shown on the landing&rsquo;s &ldquo;About this course&rdquo;
                block. The rich Dana Message (shown at checkout) lives on the Dana tab.
              </span>
              <textarea
                value={danaText}
                onChange={(e) => setDanaText(e.target.value)}
                className="pe-input pe-input--textarea"
                rows={3}
                placeholder="e.g. This course is offered freely. Dana — generosity — is welcomed."
              />
            </label>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
         TAB — Categories
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === "Categories" && (
        <div className="pe-card">
          <div className="pe-form">
            <label className="pe-field">
              <span className="pe-field__label">Category</span>
              <span className="pe-field__help">
                Which section this course appears under on the public Courses page.
                Courses without a category still appear, just unsorted.
              </span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="pe-select"
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            <div className="pe-field">
              <label className="pe-field__label" htmlFor="ce-new-category">Add a new category</label>
              <span className="pe-field__help">Categories shared with all courses. Empty categories can be deleted; populated ones can&rsquo;t (reassign first).</span>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  id="ce-new-category"
                  data-transient
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateCategory();
                    }
                  }}
                  className="pe-input"
                  placeholder="e.g. Foundations, Wisdom Practices"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="pe-btn pe-btn--small"
                  onClick={handleCreateCategory}
                  disabled={creatingCategory || !newCategoryName.trim()}
                >
                  {creatingCategory ? "Adding…" : "Add"}
                </button>
              </div>
              {categoryError && (
                <p className="pe-field__error" role="alert">{categoryError}</p>
              )}
            </div>

            {categories.length > 0 && (
              <div className="pe-field">
                <span className="pe-field__label">All categories</span>
                <ul className="pe-list">
                  {categories.map((c) => (
                    <li key={c.id} className="pe-list__item" style={{ flexWrap: "wrap" }}>
                      {confirmDeleteCat === c.id ? (
                        <>
                          <span className="pe-list__name">
                            Delete the category &ldquo;{c.name}&rdquo;? This cannot be undone.
                          </span>
                          <button
                            type="button"
                            className="pe-btn pe-btn--small pe-btn--danger"
                            onClick={() => handleDeleteCategory(c.id)}
                            disabled={deletingCat}
                          >
                            {deletingCat ? "Deleting…" : "Delete category"}
                          </button>
                          <button
                            type="button"
                            className="pe-btn pe-btn--small"
                            onClick={() => { setConfirmDeleteCat(null); setDeleteCatProblem(null); }}
                            disabled={deletingCat}
                            autoFocus
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="pe-list__name">{c.name}</span>
                          <span className="pe-list__meta">
                            {c._count?.courses ?? 0} course{(c._count?.courses ?? 0) === 1 ? "" : "s"}
                          </span>
                          <button
                            type="button"
                            className="pe-btn pe-btn--small pe-btn--ghost"
                            onClick={() => { setDeleteCatProblem(null); setConfirmDeleteCat(c.id); }}
                            disabled={(c._count?.courses ?? 0) > 0 || deletingCat}
                            aria-label={`Delete ${c.name}`}
                            title={
                              (c._count?.courses ?? 0) > 0
                                ? "Reassign the courses in this category before deleting"
                                : "Delete this category"
                            }
                          >
                            Delete
                          </button>
                        </>
                      )}
                      {deleteCatProblem?.id === c.id && (
                        <p className="pe-field__error" role="alert" style={{ flexBasis: "100%" }}>
                          {deleteCatProblem.msg}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
         TAB — Access
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === "Access" && (
        <div className="pe-card">
          <div className="pe-form">
            <p className="pe-card__help">
              Each control is independent. Combine them to express different course shapes
              (open to all with no payment asked, dana-required, role-locked, bundled with a live program, etc.).
            </p>

            <label className="pe-checkbox">
              <input
                type="checkbox"
                checked={allowSelfEnroll}
                onChange={(e) => setAllowSelfEnroll(e.target.checked)}
              />
              <span>
                <span className="pe-checkbox__label">Members can self-enroll</span>
                <span className="pe-checkbox__hint">
                  Shows an &ldquo;Enroll&rdquo; button on the course landing page. Leave off
                  for courses that are only available through a live program registration
                  or admin grant.
                </span>
              </span>
            </label>

            <label className="pe-checkbox">
              <input
                type="checkbox"
                checked={roleGateOn}
                onChange={(e) => {
                  setRoleGateOn(e.target.checked);
                  if (!e.target.checked) setRequiredRoles([]);
                }}
              />
              <span>
                <span className="pe-checkbox__label">Restrict to specific roles</span>
                <span className="pe-checkbox__hint">
                  Only members holding at least one selected role can see or enroll in
                  this course. ADMIN always bypasses.
                </span>
              </span>
            </label>

            {roleGateOn && (
              <div className="pe-roles-select">
                <p className="pe-field__hint">Eligible roles:</p>
                {ROLE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="pe-checkbox pe-checkbox--sm">
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
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            )}

            <label className="pe-field">
              <span className="pe-field__label">Access Restriction Message</span>
              <span className="pe-field__help">
                Friendly message shown to visitors who can&rsquo;t enroll (no role, no live
                cohort open, manual-grant-only). Leave blank to use a derived default.
              </span>
              <textarea
                value={accessRestrictionMessage}
                onChange={(e) => setAccessRestrictionMessage(e.target.value)}
                className="pe-input pe-input--textarea"
                rows={2}
                placeholder="e.g. This course is offered to teacher trainees. If you're considering training, get in touch."
              />
            </label>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
         TAB — Schedule (placeholder — drip release in the next slice)
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === "Schedule" && (
        <div className="pe-card">
          <div className="pe-form">
            <h3 className="pe-card__section-title">Lesson release schedule</h3>
            <p className="pe-card__help" style={{ marginBottom: 16 }}>
              The Course analog of Program&rsquo;s Schedule tab. Drip release —
              unlocking lessons on a relative or absolute timeline — was deliberately
              removed in session 100 (2026-05-06) when no courses were using it. It&rsquo;s
              coming back as the next slice of this build.
            </p>

            <div
              style={{
                background: "var(--rim-bg-accent)",
                borderRadius: 10,
                padding: "20px 24px",
                marginTop: 8,
              }}
            >
              <p style={{ margin: "0 0 12px", fontFamily: "var(--font-serif)", fontSize: "var(--text-body)", color: "var(--rim-text)" }}>
                Coming soon
              </p>
              <p style={{ margin: "0 0 8px", color: "var(--rim-text-muted)", lineHeight: 1.55 }}>
                When this tab is built out, it will let you choose:
              </p>
              <ul style={{ margin: "0 0 16px 20px", color: "var(--rim-text-muted)", lineHeight: 1.7 }}>
                <li>
                  <strong>Release model</strong> — relative (e.g. &ldquo;Lesson 2 unlocks 7 days
                  after enrollment&rdquo;) or absolute (e.g. &ldquo;Lesson 2 unlocks Oct 15&rdquo;),
                  or both.
                </li>
                <li>
                  <strong>Locked-lesson UX</strong> — hide entirely, show title with
                  &ldquo;Unlocks in 3 days,&rdquo; or show title + content but block
                  &ldquo;Complete.&rdquo;
                </li>
                <li>
                  <strong>Email cadence</strong> — notify when a new lesson unlocks,
                  weekly digest, or disabled.
                </li>
                <li>
                  <strong>Bundled-with-program behavior</strong> — drip schedule tied to
                  the Program start date when this course is bundled with a live cohort.
                </li>
              </ul>
              <p style={{ margin: 0, color: "var(--rim-text-muted)", fontSize: "var(--text-small)" }}>
                Until then, all lessons are available to enrolled members immediately. If
                you need staged release before this lands, contact us — we can stage
                manually via lesson <code>isActive</code> flags.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
         TAB — Dana
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === "Dana" && (
        <div className="pe-card">
          <div className="pe-form">
            <div className="pe-field">
              <span className="pe-field__label">Dana Mode</span>
              <span className="pe-field__help">
                How dana works for this course. Same four modes as Programs. Pick &ldquo;None&rdquo;
                for onboarding or training courses that skip the dana step entirely.
              </span>
              <div className="pe-option-cards">
                {DANA_MODES.map((opt) => (
                  <label
                    key={opt.value}
                    className={`pe-option-card${danaMode === opt.value ? " pe-option-card--active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="courseDanaMode"
                      checked={danaMode === opt.value}
                      onChange={() => setDanaMode(opt.value)}
                    />
                    <span className="pe-option-card__mark" />
                    <span>
                      <span style={{ display: "block", fontWeight: 600 }}>{opt.label}</span>
                      <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--rim-text-muted)", marginTop: 4 }}>
                        {opt.help}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {(danaMode === "voluntary" || danaMode === "base_plus_dana") && (
              <label className="pe-field">
                <span className="pe-field__label">Suggested Amount ($)</span>
                <span className="pe-field__help">
                  Default value shown in the dana picker. Members can change it.
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={suggestedDana}
                  onChange={(e) => setSuggestedDana(e.target.value)}
                  className="pe-input pe-input--narrow"
                />
              </label>
            )}

            {danaMode === "base_plus_dana" && (
              <label className="pe-field">
                <span className="pe-field__label">Base Amount ($)</span>
                <span className="pe-field__help">
                  Minimum required to enroll. Members can add more on top of this.
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={danaBaseAmount}
                  onChange={(e) => setDanaBaseAmount(e.target.value)}
                  className="pe-input pe-input--narrow"
                />
              </label>
            )}

            {danaMode === "fixed" && (
              <label className="pe-field">
                <span className="pe-field__label">Fixed Amount ($)</span>
                <span className="pe-field__help">
                  Exact amount charged to enroll. No picker, no extra.
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={danaFixedAmount}
                  onChange={(e) => setDanaFixedAmount(e.target.value)}
                  className="pe-input pe-input--narrow"
                />
              </label>
            )}

            {danaMode !== "none" && (
              <div className="pe-field">
                <span className="pe-field__label">Dana Message</span>
                <span className="pe-field__help">
                  Shown on the course landing page near the Enroll button. Use this to
                  describe how dana supports the teachings and what members should know.
                </span>
                <RimTiptapEditor
                  value={danaMessage}
                  onChange={(v) => { setDanaMessage(v); setDirty(true); }}
                  placeholder="Describe how dana supports this course…"
                  variant="message"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
         TAB — Visibility
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === "Visibility" && (
        <div className="pe-card">
          <div className="pe-form">
            <label className="pe-checkbox">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>
                <span className="pe-checkbox__label">Active</span>
                <span className="pe-checkbox__hint">
                  When off, the course is hidden from members and the public catalog. Use
                  for retired or draft courses.
                </span>
              </span>
            </label>

            <label className="pe-checkbox">
              <input
                type="checkbox"
                checked={publishOnPublicCatalog}
                onChange={(e) => setPublishOnPublicCatalog(e.target.checked)}
              />
              <span>
                <span className="pe-checkbox__label">Show on public /courses catalog</span>
                <span className="pe-checkbox__hint">
                  Off for onboarding, internal training, and role-assigned courses.
                </span>
              </span>
            </label>

            <label className="pe-checkbox">
              <input
                type="checkbox"
                checked={isOnboarding}
                onChange={(e) => setIsOnboarding(e.target.checked)}
              />
              <span>
                <span className="pe-checkbox__label">Auto-enroll new members (onboarding)</span>
                <span className="pe-checkbox__hint">
                  Every new member signs up gets enrolled in this course automatically.
                </span>
              </span>
            </label>

            <label className="pe-checkbox">
              <input
                type="checkbox"
                checked={hideFromMemberProfile}
                onChange={(e) => setHideFromMemberProfile(e.target.checked)}
              />
              <span>
                <span className="pe-checkbox__label">Hide from member profile</span>
                <span className="pe-checkbox__hint">
                  Members won&rsquo;t see this course on their Library page even if they&rsquo;re
                  enrolled. Use sparingly — most enrollments should be visible to the member.
                </span>
              </span>
            </label>
          </div>
        </div>
      )}

      {/* ── Save bar ── */}
      <div className="pe-actions">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !title || !slug}
          className="pe-btn pe-btn--primary"
        >
          {saving ? "Saving…" : isEditing ? "Save Course" : "Create Course"}
        </button>
        <button
          type="button"
          onClick={() => guardedNavigate(basePath)}
          className="pe-btn"
        >
          Cancel
        </button>
        {/* The answer beside the button, and it stays (2026-10-19: it showed at
            the top of a long page for three seconds). */}
        <SaveNote status={saving ? "saving" : error ? "error" : success ? "saved" : "idle"} saved={`Saved at ${savedAt}.`} problem={error} />
      </div>
    </div>
  );
}
