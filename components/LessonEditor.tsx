"use client";

/**
 * LessonEditor — handles both create and edit for lessons.
 * Sections: Identity, Content, Media, Header Quote, Teachers, Resources.
 * CSS prefix: th-
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface Resource {
  name: string;
  url: string;
  resourceType: string;
}

interface LessonData {
  id?: string;
  titleInternal: string;
  titleDisplayed: string;
  slug: string;
  isSectionTitle: boolean;
  body: string;
  heroImageUrl: string;
  heroImageAlt: string;
  audioUrl: string;
  videoUrl: string;
  headerQuote: string;
  quoteSource: string;
  teacherNames: string;
  resources: Resource[];
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
  const [isSectionTitle, setIsSectionTitle] = useState(initialData?.isSectionTitle ?? false);

  // Content
  const [body, setBody] = useState(initialData?.body ?? "");

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

  // Teachers
  const [teacherNames, setTeacherNames] = useState(initialData?.teacherNames ?? "");

  // Resources
  const [resources, setResources] = useState<Resource[]>(initialData?.resources ?? []);
  const [uploadingResourceIdx, setUploadingResourceIdx] = useState<number | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Auto-generate slug from internal title
  useEffect(() => {
    if (!isEditing && !slugTouched && titleInternal) {
      setSlug(slugify(titleInternal));
    }
  }, [titleInternal, isEditing, slugTouched]);

  function insertBlock(type: "verse" | "practice" | "callout") {
    const templates: Record<string, string> = {
      verse: "\n\n> [verse]\n> Enter quote text here\n> — Attribution (optional)\n\n",
      practice: "\n\n> [practice]\n> Describe the practice here\n\n",
      callout: "\n\n> [callout]\n> Enter key insight here\n\n",
    };
    setBody((prev) => prev + templates[type]);
  }

  async function uploadFile(file: File): Promise<string | null> {
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) return null;
      const data = await res.json();
      return data.url;
    } catch {
      return null;
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const url = await uploadFile(file);
    if (url) setHeroImageUrl(url);
    else setError("Image upload failed");
    setUploadingImage(false);
  }

  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAudio(true);
    const url = await uploadFile(file);
    if (url) setAudioUrl(url);
    else setError("Audio upload failed");
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
      const teacherArr = teacherNames
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);

      const payload = {
        titleInternal,
        titleDisplayed,
        slug,
        isSectionTitle,
        body: body || null,
        heroImageUrl: heroImageUrl || null,
        heroImageAlt: heroImageAlt || null,
        audioUrl: audioUrl || null,
        videoUrl: videoUrl || null,
        headerQuote: headerQuote || null,
        quoteSource: quoteSource || null,
        teacherNames: teacherArr,
        resources: resources.filter((r) => r.name || r.url),
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
      <h2 className="th-editor__title">{isEditing ? "Edit Lesson" : "New Lesson"}</h2>

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

          <label className="th-checkbox">
            <input
              type="checkbox"
              checked={isSectionTitle}
              onChange={(e) => setIsSectionTitle(e.target.checked)}
            />
            Section title (non-linked divider in course list)
          </label>
        </div>
      </div>

      {/* ── Section: Content ── */}
      <div className="th-section">
        <h3 className="th-section__title">Content</h3>
        <div className="th-block-btns">
          <button type="button" className="th-btn th-btn--small" onClick={() => insertBlock("verse")}>+ Verse Quote</button>
          <button type="button" className="th-btn th-btn--small" onClick={() => insertBlock("practice")}>+ Practice</button>
          <button type="button" className="th-btn th-btn--small" onClick={() => insertBlock("callout")}>+ Callout</button>
        </div>
        <div data-color-mode="light">
          <MDEditor
            value={body}
            onChange={(val) => setBody(val ?? "")}
            height={500}
            preview="live"
            hideToolbar={false}
            visibleDragbar={false}
          />
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
                  <button
                    type="button"
                    className="th-btn th-btn--danger th-btn--small"
                    onClick={() => { setHeroImageUrl(""); setHeroImageAlt(""); }}
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
                  onClick={() => setAudioUrl("")}
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
        <div className="th-form">
          <label className="th-field">
            <span className="th-field__label">Teacher Names</span>
            <input
              type="text"
              value={teacherNames}
              onChange={(e) => setTeacherNames(e.target.value)}
              className="th-input"
              placeholder="Comma-separated names"
            />
          </label>
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
