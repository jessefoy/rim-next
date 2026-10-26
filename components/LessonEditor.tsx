"use client";

/**
 * LessonEditor — handles both create and edit for lessons.
 * Sections: Identity, Content, Media, Header Quote, Teachers, Resources.
 * CSS prefix: th-
 */

import { useState, useEffect, useRef, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import dynamic from "next/dynamic";
import { isHtmlString, renderBlockNoteHtml } from "@/lib/renderRichContent";

const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div style={{ minHeight: 500 }} /> },
);
import SlugField from "@/components/SlugField";
import { SaveNote } from "@/components/FormDone";
import { useNavigationDrawer } from "@/components/hooks/useNavigationDrawer";

interface Resource {
  name: string;
  url: string;
  resourceType: string;
}

interface TeacherItem {
  id: string;
  name: string;
}

interface LessonData {
  id?: string;
  titleInternal: string;
  titleDisplayed: string;
  slug: string;
  accessLevel: "ALL_MEMBERS" | "REGISTRATION_REQUIRED";
  body: any; // Tiptap JSON
  heroImageUrl: string;
  heroImageAlt: string;
  audioUrl: string;
  videoUrl: string;
  headerQuote: string;
  quoteSource: string;
  resources: Resource[];
  teachers?: { id: string; name: string }[];
  durationMinutes?: number | null;
  reflectionPrompt?: string | null;
}

interface Props {
  basePath?: string;
  initialData?: LessonData;
  isEditing: boolean;
  legacyBodyHtml?: string;  // pre-rendered HTML for Tiptap → BlockNote import on mount
}

const RESOURCE_TYPES = ["PDF", "Audio", "Worksheet", "Guide", "Link", "Other"];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function LessonEditor({ basePath = "/tools/learning/lessons", initialData, isEditing, legacyBodyHtml }: Props) {
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

  // Identity
  const [titleInternal, setTitleInternal] = useState(initialData?.titleInternal ?? "");
  const [titleDisplayed, setTitleDisplayed] = useState(initialData?.titleDisplayed ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [accessLevel, setAccessLevel] = useState<"ALL_MEMBERS" | "REGISTRATION_REQUIRED">(
    (initialData as any)?.accessLevel ?? "ALL_MEMBERS"
  );

  // Content — HTML string. Lazy migration: convert legacy BlockNote JSON
  // (or fall back to server-rendered HTML for older Tiptap-JSON rows) on load.
  const [body, setBody] = useState<string>(() => {
    const initial = initialData?.body;
    if (isHtmlString(initial)) return initial;
    const fromBlockNote = renderBlockNoteHtml(initial);
    if (fromBlockNote) return fromBlockNote;
    return legacyBodyHtml ?? "";
  });

  // Media
  const [heroImageUrl, setHeroImageUrl] = useState(initialData?.heroImageUrl ?? "");
  const [heroImageAlt, setHeroImageAlt] = useState(initialData?.heroImageAlt ?? "");
  const [audioUrl, setAudioUrl] = useState(initialData?.audioUrl ?? "");
  const [videoUrl, setVideoUrl] = useState(initialData?.videoUrl ?? "");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  // Header Quote
  const [headerQuote, setHeaderQuote] = useState(initialData?.headerQuote ?? "");
  const [quoteSource, setQuoteSource] = useState(initialData?.quoteSource ?? "");

  // Scheduling

  // Learning system
  const [durationMinutes, setDurationMinutes] = useState(
    initialData?.durationMinutes != null ? String(initialData.durationMinutes) : ""
  );
  const [reflectionPrompt, setReflectionPrompt] = useState(initialData?.reflectionPrompt ?? "");

  // Resources
  const [resources, setResources] = useState<Resource[]>(initialData?.resources ?? []);
  const [uploadingResourceIdx, setUploadingResourceIdx] = useState<number | null>(null);

  // Teachers (User-based)
  const [selectedTeachers, setSelectedTeachers] = useState<TeacherItem[]>(initialData?.teachers ?? []);
  const [teacherQuery, setTeacherQuery] = useState("");
  const [teacherResults, setTeacherResults] = useState<TeacherItem[]>([]);
  const [teacherSearching, setTeacherSearching] = useState(false);
  const teacherDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // A problem with a media upload or removal, said beside that control.
  const [imageProblem, setImageProblem] = useState("");
  const [audioProblem, setAudioProblem] = useState("");
  const [resourceProblem, setResourceProblem] = useState<{ idx: number; msg: string } | null>(null);
  // Removing media saves at once, so it asks first.
  const [confirmRemove, setConfirmRemove] = useState<"image" | "audio" | null>(null);
  const [removing, setRemoving] = useState(false);

  // ── Unsaved changes (mirrors ProgramEditor's guardedNavigate) ──
  const [dirty, setDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  // The dialog takes focus (Stay, its first button), keeps Tab and Shift-Tab
  // inside it, and gives focus back to whatever opened it.
  const leaveDialogRef = useNavigationDrawer(pendingNav !== null, () => setPendingNav(null));

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  /** Wrap navigation: with unsaved changes, ask before leaving. */
  function guardedNavigate(href: string) {
    if (dirty) setPendingNav(href);
    else router.push(href);
  }

  // An edit after a save: "Saved" no longer describes the page, and there is
  // now something to lose. Searches and media uploads (which save themselves)
  // are marked data-transient and don't count as unsaved work.
  function noteEdit(e: React.SyntheticEvent) {
    setSuccess(false);
    if (!(e.target as HTMLElement).closest("[data-transient]")) setDirty(true);
  }

  // Auto-generate slug from internal title
  useEffect(() => {
    if (!isEditing && !slugTouched && titleInternal) {
      setSlug(slugify(titleInternal));
    }
  }, [titleInternal, isEditing, slugTouched]);

  async function uploadFile(file: File): Promise<string | null> {
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      return blob.url;
    } catch {
      return null;
    }
  }

  // Saves media fields at once when editing an existing lesson (a new lesson
  // keeps them until Create). Returns whether the save took.
  async function autoSaveFields(fields: Record<string, string | null>): Promise<boolean> {
    if (!isEditing || !initialData?.slug) return true;
    try {
      const res = await fetch(`/api/lessons/${initialData.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // The new file shows only once it is saved; until then the lesson keeps
  // what it had, and a problem is said beside the upload control.
  async function handleMediaUpload(kind: "image" | "audio", e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    const setProblem = kind === "image" ? setImageProblem : setAudioProblem;
    const setUploading = kind === "image" ? setUploadingImage : setUploadingAudio;
    const noun = kind === "image" ? "The image" : "The audio file";
    setProblem("");
    setUploading(true);
    const url = await uploadFile(file);
    input.value = ""; // so the same file can be chosen again
    if (!url) {
      setProblem(`${noun} did not upload. Please try again.`);
    } else if (!(await autoSaveFields({ [kind === "image" ? "heroImageUrl" : "audioUrl"]: url }))) {
      setProblem(`${noun} uploaded but was not saved to this lesson. Please try again.`);
    } else {
      if (kind === "image") setHeroImageUrl(url);
      else setAudioUrl(url);
      if (!isEditing) setDirty(true);
    }
    setUploading(false);
  }

  async function removeMedia(kind: "image" | "audio") {
    const setProblem = kind === "image" ? setImageProblem : setAudioProblem;
    setProblem("");
    setRemoving(true);
    const ok = await autoSaveFields(
      kind === "image" ? { heroImageUrl: null, heroImageAlt: null } : { audioUrl: null },
    );
    setRemoving(false);
    if (!ok) {
      setProblem(`${kind === "image" ? "The image" : "The audio file"} was not removed. Please try again.`);
      return;
    }
    if (kind === "image") { setHeroImageUrl(""); setHeroImageAlt(""); }
    else setAudioUrl("");
    if (!isEditing) setDirty(true);
    setConfirmRemove(null);
  }

  async function handleResourceUpload(idx: number, file: File) {
    setResourceProblem(null);
    setUploadingResourceIdx(idx);
    const url = await uploadFile(file);
    if (url) {
      setResources((prev) => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], url };
        return updated;
      });
    } else {
      setResourceProblem({ idx, msg: "The file did not upload. Please try again." });
    }
    setUploadingResourceIdx(null);
  }

  // Teacher search
  useEffect(() => {
    if (teacherDebounceRef.current) clearTimeout(teacherDebounceRef.current);
    if (!teacherQuery.trim()) {
      setTeacherResults([]);
      return;
    }
    teacherDebounceRef.current = setTimeout(async () => {
      setTeacherSearching(true);
      try {
        const res = await fetch(`/api/members/search?q=${encodeURIComponent(teacherQuery)}`);
        if (res.ok) {
          const raw: { id: string; firstName: string; lastName: string }[] = await res.json();
          // Map to TeacherItem shape and filter out already-selected
          const mapped = raw.map((m) => ({
            id: m.id,
            name: [m.firstName, m.lastName].filter(Boolean).join(" "),
          }));
          setTeacherResults(
            mapped.filter((t) => !selectedTeachers.some((s) => s.id === t.id))
          );
        }
      } finally {
        setTeacherSearching(false);
      }
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherQuery]);

  function addTeacher(teacher: TeacherItem) {
    setDirty(true);
    setSelectedTeachers((prev) => [...prev, teacher]);
    setTeacherResults([]);
    setTeacherQuery("");
  }

  function removeTeacher(id: string) {
    setDirty(true);
    setSelectedTeachers((prev) => prev.filter((t) => t.id !== id));
  }

  function addResource() {
    setDirty(true);
    setResources((prev) => [...prev, { name: "", url: "", resourceType: "Link" }]);
  }

  function updateResource(idx: number, field: keyof Resource, value: string) {
    setResources((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  }

  function removeResource(idx: number) {
    setDirty(true);
    setResourceProblem(null);
    setResources((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setError("");
    setSuccess(false);
    setSaving(true);

    try {
      const payload = {
        titleInternal,
        titleDisplayed,
        slug,
        accessLevel,
        body: body || null,
        heroImageUrl: heroImageUrl || null,
        heroImageAlt: heroImageAlt || null,
        audioUrl: audioUrl || null,
        videoUrl: videoUrl || null,
        headerQuote: headerQuote || null,
        quoteSource: quoteSource || null,
        resources: resources.filter((r) => r.name || r.url),
        teacherIds: selectedTeachers.map((t) => t.id),
        durationMinutes: durationMinutes !== "" ? (parseInt(durationMinutes) || null) : null,
        reflectionPrompt: reflectionPrompt.trim() || null,
      };

      const lessonUrl = isEditing ? `/api/lessons/${initialData?.slug}` : "/api/lessons";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(lessonUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      const savedLesson = await res.json();
      const lessonSlug = isEditing ? initialData!.slug : savedLesson.slug;

      setDirty(false);
      if (isEditing) {
        setSuccess(true);
        setSavedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
        // A saved new address: the page moves to it, or every later save,
        // media included, would go to the old one and fail (2026-10-19). The page
        // remounts there, so the answer travels in ?saved= and is read back below.
        if (savedLesson.slug && savedLesson.slug !== initialData?.slug) router.replace(`${basePath}/${savedLesson.slug}?saved=${encodeURIComponent(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }))}`);
      } else {
        router.push(`${basePath}/${lessonSlug}`);
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    // An edit after a save: "Saved" no longer describes the page.
    <div className="th-editor" onChangeCapture={noteEdit} onInputCapture={noteEdit} onClickCapture={(e) => { if ((e.target as HTMLElement).closest("button")) setSuccess(false); }}>
      {/* ── Unsaved changes confirmation (as in ProgramEditor) ── */}
      {pendingNav && (
        <div className="pe-overlay" onClick={() => setPendingNav(null)}>
          <div ref={leaveDialogRef as RefObject<HTMLDivElement | null>} className="pe-dialog" role="dialog" aria-modal="true" aria-labelledby="th-leave-text" onClick={(e) => e.stopPropagation()}>
            <p className="pe-dialog__text" id="th-leave-text">You have unsaved changes. Leave without saving?</p>
            <div className="pe-dialog__actions">
              <button type="button" className="th-btn th-btn--primary" onClick={() => setPendingNav(null)}>
                Stay on this page
              </button>
              <button
                type="button"
                className="th-btn"
                onClick={() => { setDirty(false); router.push(pendingNav); }}
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="th-editor__header">
        <h2 className="th-editor__title">{isEditing ? "Edit Lesson" : "New Lesson"}</h2>
        {isEditing && slug && (
          <a href={`/lessons/${slug}`} target="_blank" rel="noopener noreferrer" className="th-link th-link--view">
            View lesson page →
          </a>
        )}
      </div>


      {/* ── Section: Identity ── */}
      <div className="th-section">
        <h3 className="th-section__title">Identity</h3>
        <div className="th-form">
          <label className="th-field">
            <span className="th-field__label">Title — Internal</span>
            <input
              type="text"
              value={titleInternal}
              onChange={(e) => setTitleInternal(e.target.value)}
              className="th-input"
              required
            />
            <span className="th-field__help">Used for admin organizing. Slug auto-generates from this.</span>
          </label>

          <label className="th-field">
            <span className="th-field__label">Title — Displayed</span>
            <input
              type="text"
              value={titleDisplayed}
              onChange={(e) => setTitleDisplayed(e.target.value)}
              className="th-input"
              required
            />
            <span className="th-field__help">Shown on the lesson page.</span>
          </label>

          <SlugField
            value={slug}
            onChange={(v) => { setSlug(v); setSlugTouched(true); }}
            isEditing={isEditing}
            warnText="Changing the slug will break existing links to this lesson."
          />

          <fieldset className="th-field">
            <legend className="th-field__label">Who can access this lesson?</legend>
            <label className="th-radio">
              <input type="radio" checked={accessLevel === "ALL_MEMBERS"} onChange={() => setAccessLevel("ALL_MEMBERS")} />
              All Members
            </label>
            <label className="th-radio">
              <input type="radio" checked={accessLevel === "REGISTRATION_REQUIRED"} onChange={() => setAccessLevel("REGISTRATION_REQUIRED")} />
              Registration Required
            </label>
          </fieldset>

        </div>
      </div>

      {/* ── Section: Content ── */}
      <div className="th-section">
        <h3 className="th-section__title">Content</h3>
        <RimTiptapEditor
          value={body}
          onChange={(v) => { setBody(v); setDirty(true); }}
          placeholder="Begin writing your lesson here…"
          variant="document"
        />

        <div className="th-form" style={{ marginTop: 24 }}>
          <label className="th-field">
            <span className="th-field__label">Reflection prompt</span>
            <span className="th-field__help">An invitation shown at the bottom of this lesson after the content. A single sentence or short paragraph. No formatting needed.</span>
            <textarea
              value={reflectionPrompt}
              onChange={(e) => setReflectionPrompt(e.target.value)}
              className="th-input th-input--textarea"
              rows={3}
              placeholder="e.g. What stayed with you? What are you still sitting with?"
            />
          </label>
        </div>
      </div>

      {/* ── Section: Media ── */}
      <div className="th-section">
        <h3 className="th-section__title">Media</h3>
        <div className="th-form">
          <div className="th-field">
            <span className="th-field__label">Hero Image</span>
            {heroImageUrl ? (
              <div className="th-media-preview">
                <img src={heroImageUrl} alt={heroImageAlt || "Hero"} className="th-media-preview__img" />
                <div className="th-media-preview__actions">
                  <label className="th-field">
                    <span className="th-field__label">Alt Text</span>
                    <input
                      type="text"
                      value={heroImageAlt}
                      onChange={(e) => setHeroImageAlt(e.target.value)}
                      className="th-input"
                    />
                  </label>
                  {confirmRemove === "image" ? (
                    <div>
                      <p className="th-field__help">Remove this image from the lesson?</p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="th-btn th-btn--primary th-btn--small"
                          onClick={() => removeMedia("image")}
                          disabled={removing}
                        >
                          {removing ? "Removing…" : "Remove image"}
                        </button>
                        <button
                          type="button"
                          className="th-btn th-btn--small"
                          onClick={() => setConfirmRemove(null)}
                          disabled={removing}
                          autoFocus
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="th-btn th-btn--danger th-btn--small"
                      onClick={() => { setImageProblem(""); setConfirmRemove("image"); }}
                    >
                      Remove image
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleMediaUpload("image", e)}
                  className="th-file-input"
                  aria-label="Choose a hero image"
                  disabled={uploadingImage}
                  data-transient={isEditing || undefined}
                />
                {uploadingImage && <p className="th-muted">Uploading…</p>}
              </>
            )}
            {imageProblem && <p className="save-note save-note--error" role="alert">{imageProblem}</p>}
          </div>

          <div className="th-field">
            <span className="th-field__label">Audio File</span>
            {audioUrl ? (
              <div className="th-media-preview">
                <p className="th-muted">{audioUrl.split("/").pop()}</p>
                {confirmRemove === "audio" ? (
                  <div>
                    <p className="th-field__help">Remove this audio file from the lesson?</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="th-btn th-btn--primary th-btn--small"
                        onClick={() => removeMedia("audio")}
                        disabled={removing}
                      >
                        {removing ? "Removing…" : "Remove audio"}
                      </button>
                      <button
                        type="button"
                        className="th-btn th-btn--small"
                        onClick={() => setConfirmRemove(null)}
                        disabled={removing}
                        autoFocus
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="th-btn th-btn--danger th-btn--small"
                    onClick={() => { setAudioProblem(""); setConfirmRemove("audio"); }}
                  >
                    Remove audio
                  </button>
                )}
              </div>
            ) : (
              <>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={(e) => handleMediaUpload("audio", e)}
                  className="th-file-input"
                  aria-label="Choose an audio file"
                  disabled={uploadingAudio}
                  data-transient={isEditing || undefined}
                />
                {uploadingAudio && <p className="th-muted">Uploading…</p>}
              </>
            )}
            {audioProblem && <p className="save-note save-note--error" role="alert">{audioProblem}</p>}
          </div>

          <label className="th-field">
            <span className="th-field__label">Video URL</span>
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="th-input"
              placeholder="YouTube or Vimeo URL"
            />
          </label>
        </div>
      </div>

      {/* ── Section: Header Quote ── */}
      <div className="th-section">
        <h3 className="th-section__title">Header Quote</h3>
        <p className="th-section__help">Shown when no audio file is set.</p>
        <div className="th-form">
          <label className="th-field">
            <span className="th-field__label">Quote</span>
            <textarea
              value={headerQuote}
              onChange={(e) => setHeaderQuote(e.target.value)}
              className="th-textarea"
              rows={3}
            />
          </label>
          <label className="th-field">
            <span className="th-field__label">Source</span>
            <input
              type="text"
              value={quoteSource}
              onChange={(e) => setQuoteSource(e.target.value)}
              className="th-input"
            />
          </label>
        </div>
      </div>

      {/* ── Section: Teachers ── */}
      <div className="th-section">
        <h3 className="th-section__title">Teachers</h3>

        {selectedTeachers.length > 0 && (
          <div className="th-teacher-tags">
            {selectedTeachers.map((t) => (
              <span key={t.id} className="th-teacher-tag">
                {t.name}
                <button
                  type="button"
                  className="th-teacher-tag__remove"
                  onClick={() => removeTeacher(t.id)}
                  aria-label={`Remove ${t.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="th-form">
          <div className="th-field">
            <input
              type="text"
              value={teacherQuery}
              onChange={(e) => setTeacherQuery(e.target.value)}
              placeholder="Search teachers by name…"
              aria-label="Search teachers by name"
              className="th-input"
              data-transient
            />
            {teacherSearching && <p className="th-muted">Searching…</p>}
            {teacherResults.length > 0 && (
              <div className="th-teacher-results">
                {teacherResults.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="th-teacher-result"
                    onClick={() => addTeacher(t)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section: Resources ── */}
      <div className="th-section">
        <h3 className="th-section__title">Resources</h3>
        {resources.map((resource, i) => (
          <div key={i} className="th-resource-row">
            <input
              type="text"
              placeholder="Name"
              aria-label={`Resource ${i + 1} name`}
              value={resource.name}
              onChange={(e) => updateResource(i, "name", e.target.value)}
              className="th-input"
            />
            <div className="th-resource-row__url">
              <input
                type="text"
                placeholder="URL"
                aria-label={`Resource ${i + 1} web address`}
                value={resource.url}
                onChange={(e) => updateResource(i, "url", e.target.value)}
                className="th-input"
              />
              <label className="th-btn th-btn--small th-resource-row__upload">
                Upload
                <input
                  type="file"
                  className="th-sr-only"
                  aria-label={`Upload a file for resource ${i + 1}`}
                  disabled={uploadingResourceIdx !== null}
                  onChange={async (e) => {
                    const input = e.target;
                    const file = input.files?.[0];
                    if (file) await handleResourceUpload(i, file);
                    input.value = "";
                  }}
                />
              </label>
              {uploadingResourceIdx === i && <span className="th-muted">Uploading…</span>}
              {resourceProblem?.idx === i && (
                <span className="save-note save-note--error" role="alert">{resourceProblem.msg}</span>
              )}
            </div>
            <select
              aria-label={`Resource ${i + 1} type`}
              value={resource.resourceType}
              onChange={(e) => updateResource(i, "resourceType", e.target.value)}
              className="th-select"
            >
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              type="button"
              className="th-btn th-btn--danger th-btn--small"
              onClick={() => removeResource(i)}
              aria-label={`Remove resource ${i + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="th-btn th-btn--small" onClick={addResource}>
          Add Resource
        </button>
      </div>

      <div className="th-actions">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !titleInternal || !titleDisplayed || !slug}
          className="th-btn th-btn--primary"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => guardedNavigate(basePath)}
          className="th-btn"
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
