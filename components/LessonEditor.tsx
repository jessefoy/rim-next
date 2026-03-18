"use client";

/**
 * LessonEditor — handles both create and edit for lessons.
 * Sections: Identity, Content, Media, Header Quote, Teachers, Resources.
 * CSS prefix: th-
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import ContentEditor from "@/components/ContentEditor";
import ManualHelpIcon from "@/components/ManualHelpIcon";
import SlugField from "@/components/SlugField";

interface Resource {
  name: string;
  url: string;
  resourceType: string;
}

interface TeacherItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
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
  teachers?: TeacherItem[];
  releaseDelayDays?: number | null;
  parentDripInfo?: { seriesTitle: string; intervalDays: number | null }[];
}

interface Props {
  hubSlug: string;
  initialData?: LessonData;
  isEditing: boolean;
}

const RESOURCE_TYPES = ["PDF", "Audio", "Worksheet", "Guide", "Link", "Other"];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function LessonEditor({ hubSlug, initialData, isEditing }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  // Identity
  const [titleInternal, setTitleInternal] = useState(initialData?.titleInternal ?? "");
  const [titleDisplayed, setTitleDisplayed] = useState(initialData?.titleDisplayed ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [accessLevel, setAccessLevel] = useState<"ALL_MEMBERS" | "REGISTRATION_REQUIRED">(
    (initialData as any)?.accessLevel ?? "ALL_MEMBERS"
  );

  // Content — Tiptap JSON
  const [body, setBody] = useState<any>(initialData?.body ?? null);

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
  const [releaseDelayDays, setReleaseDelayDays] = useState(
    String(initialData?.releaseDelayDays ?? "")
  );
  const parentDripInfo = initialData?.parentDripInfo ?? [];

  // Resources
  const [resources, setResources] = useState<Resource[]>(initialData?.resources ?? []);
  const [uploadingResourceIdx, setUploadingResourceIdx] = useState<number | null>(null);

  // Teachers
  const [selectedTeachers, setSelectedTeachers] = useState<TeacherItem[]>(initialData?.teachers ?? []);
  const [teacherQuery, setTeacherQuery] = useState("");
  const [teacherResults, setTeacherResults] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [teacherSearching, setTeacherSearching] = useState(false);
  const teacherDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      return null;
    }
  }

  // Auto-save a single field to DB (only when editing an existing lesson)
  async function autoSaveField(field: string, value: string | null) {
    if (!isEditing || !initialData?.slug) return;
    try {
      await fetch(`/api/lessons/${initialData.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
    } catch {
      // Silent — full save will catch any issues
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const url = await uploadFile(file);
    if (url) {
      setHeroImageUrl(url);
      await autoSaveField("heroImageUrl", url);
    } else {
      setError("Image upload failed");
    }
    setUploadingImage(false);
  }

  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAudio(true);
    const url = await uploadFile(file);
    if (url) {
      setAudioUrl(url);
      await autoSaveField("audioUrl", url);
    } else {
      setError("Audio upload failed");
    }
    setUploadingAudio(false);
  }

  async function handleResourceUpload(idx: number, file: File) {
    setUploadingResourceIdx(idx);
    const url = await uploadFile(file);
    if (url) {
      setResources((prev) => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], url };
        return updated;
      });
    } else {
      setError("Resource upload failed");
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
        const res = await fetch(`/api/teachers/search?q=${encodeURIComponent(teacherQuery)}`);
        if (res.ok) {
          const data = await res.json();
          // Filter out already-selected
          setTeacherResults(
            data.filter((t: { id: string }) => !selectedTeachers.some((s) => s.id === t.id))
          );
        }
      } finally {
        setTeacherSearching(false);
      }
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherQuery]);

  function addTeacher(teacher: { id: string; name: string; slug: string }) {
    setSelectedTeachers((prev) => [...prev, { ...teacher, isActive: true }]);
    setTeacherResults([]);
    setTeacherQuery("");
  }

  function removeTeacher(id: string) {
    setSelectedTeachers((prev) => prev.filter((t) => t.id !== id));
  }

  function addResource() {
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
        releaseDelayDays: releaseDelayDays !== "" ? (parseInt(releaseDelayDays) || null) : null,
      };

      const url = isEditing ? `/api/lessons/${initialData?.slug}` : "/api/lessons";
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
        router.push(`/account/hub/${hubSlug}/lessons/${created.slug}`);
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
        <h2 className="th-editor__title">{isEditing ? "Edit Lesson" : "New Lesson"}</h2>
        <ManualHelpIcon manualSlug="course-hub" />
        {isEditing && slug && (
          <a href={`/lessons/${slug}`} target="_blank" rel="noopener noreferrer" className="th-link th-link--view">
            View lesson page →
          </a>
        )}
      </div>

      {error && <div className="th-msg th-msg--error">{error}</div>}
      {success && <div className="th-msg th-msg--success">Saved successfully</div>}

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
        <ContentEditor
          value={body}
          onChange={setBody}
          placeholder="Begin writing your lesson here…"
          minHeight={500}
        />
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
                  <button
                    type="button"
                    className="th-btn th-btn--danger th-btn--small"
                    onClick={() => { setHeroImageUrl(""); setHeroImageAlt(""); autoSaveField("heroImageUrl", null); }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="th-file-input"
                />
                {uploadingImage && <p className="th-muted">Uploading…</p>}
              </>
            )}
          </div>

          <div className="th-field">
            <span className="th-field__label">Audio File</span>
            {audioUrl ? (
              <div className="th-media-preview">
                <p className="th-muted">{audioUrl.split("/").pop()}</p>
                <button
                  type="button"
                  className="th-btn th-btn--danger th-btn--small"
                  onClick={() => { setAudioUrl(""); autoSaveField("audioUrl", null); }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="th-file-input"
                />
                {uploadingAudio && <p className="th-muted">Uploading…</p>}
              </>
            )}
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
              <span
                key={t.id}
                className={`th-teacher-tag${!t.isActive ? " th-teacher-tag--inactive" : ""}`}
              >
                {t.name}{!t.isActive && " (inactive)"}
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
              className="th-input"
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

      {/* ── Section: Scheduling ── */}
      {parentDripInfo.length > 0 && (
        <div className="th-section">
          <h3 className="th-section__title">Scheduling</h3>
          {parentDripInfo.length > 1 && (
            <p className="th-section__help">This lesson belongs to multiple series with different schedules. The override applies to all of them.</p>
          )}
          <div className="th-form">
            <label className="th-field">
              <span className="th-field__label">Override release delay (days)</span>
              <input
                type="number"
                min="0"
                value={releaseDelayDays}
                onChange={(e) => setReleaseDelayDays(e.target.value)}
                className="th-input"
                placeholder={parentDripInfo[0]?.intervalDays != null ? String(parentDripInfo[0].intervalDays) : ""}
              />
              <span className="th-field__help">
                Leave blank to use the series default ({parentDripInfo[0]?.intervalDays ?? "not set"} days).
              </span>
            </label>
          </div>
        </div>
      )}

      {/* ── Section: Resources ── */}
      <div className="th-section">
        <h3 className="th-section__title">Resources</h3>
        {resources.map((resource, i) => (
          <div key={i} className="th-resource-row">
            <input
              type="text"
              placeholder="Name"
              value={resource.name}
              onChange={(e) => updateResource(i, "name", e.target.value)}
              className="th-input"
            />
            <div className="th-resource-row__url">
              <input
                type="text"
                placeholder="URL"
                value={resource.url}
                onChange={(e) => updateResource(i, "url", e.target.value)}
                className="th-input"
              />
              <label className="th-btn th-btn--small th-resource-row__upload">
                Upload
                <input
                  type="file"
                  className="th-sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await handleResourceUpload(i, file);
                  }}
                />
              </label>
              {uploadingResourceIdx === i && <span className="th-muted">Uploading…</span>}
            </div>
            <select
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
          onClick={() => router.push(`/account/hub/${hubSlug}/lessons`)}
          className="th-btn"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
