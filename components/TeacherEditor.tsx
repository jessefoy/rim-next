"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import FormattedEditor from "@/components/FormattedEditor";

interface LessonItem {
  lessonId: string;
  lessonSlug: string;
  lessonTitle: string;
  courses: { courseSlug: string; courseTitle: string }[];
}

export interface TeacherEditorData {
  id: string;
  name: string;
  slug: string;
  bio: any; // Tiptap JSON
  photoUrl: string | null;
  isActive: boolean;
  lessons: LessonItem[];
}

interface Props {
  initialData: TeacherEditorData;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function TeacherEditor({ initialData }: Props) {
  const [name, setName] = useState(initialData.name);
  const [slug, setSlug] = useState(initialData.slug);
  const [slugTouched, setSlugTouched] = useState(false);
  const [bio, setBio] = useState<any>(initialData.bio ?? null);
  const [photoUrl, setPhotoUrl] = useState(initialData.photoUrl ?? "");
  const [isActive, setIsActive] = useState(initialData.isActive);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setError("");
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      setPhotoUrl(blob.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    setError("");
    setSuccess(false);
    setSaving(true);

    try {
      const res = await fetch(`/api/admin/teachers/${initialData.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          bio: bio || null,
          photoUrl: photoUrl || null,
          isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      // If slug changed, redirect to new URL
      const updated = await res.json();
      if (updated.slug !== initialData.slug) {
        window.location.href = `/admin/teachers/${updated.slug}`;
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="th-editor">
      {error && <div className="th-msg th-msg--error">{error}</div>}
      {success && <div className="th-msg th-msg--success">Saved successfully</div>}

      {/* ── Identity ── */}
      <div className="th-section">
        <h3 className="th-section__title">Identity</h3>
        <div className="th-form">
          <label className="th-field">
            <span className="th-field__label">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
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
            <span className="th-field__help">Used in the public URL: /teachers/[slug]</span>
          </label>

          <div className="th-field">
            <label className="th-checkbox-label">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>Active — appears on public teacher pages</span>
            </label>
          </div>
        </div>
      </div>

      {/* ── Photo ── */}
      <div className="th-section">
        <h3 className="th-section__title">Photo</h3>
        <div className="th-form">
          <div className="th-field">
            {photoUrl ? (
              <div className="th-media-preview">
                <img
                  src={photoUrl}
                  alt={name}
                  style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", marginBottom: 8 }}
                />
                <div className="th-media-preview__actions">
                  <button
                    type="button"
                    className="th-btn th-btn--danger th-btn--small"
                    onClick={() => setPhotoUrl("")}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="th-file-input"
                />
                {uploadingPhoto && <p className="th-muted">Uploading…</p>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Bio ── */}
      <div className="th-section">
        <h3 className="th-section__title">Bio</h3>
        <FormattedEditor
          value={bio}
          onChange={setBio}
          placeholder="Write a bio for this teacher…"
          minHeight={200}
        />
      </div>

      {/* ── Actions ── */}
      <div className="th-actions">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name || !slug}
          className="th-btn th-btn--primary"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <a href="/admin/teachers" className="th-btn">
          Back to Teachers
        </a>
      </div>

      {/* ── Lessons (read-only) ── */}
      <div className="th-section" style={{ marginTop: 40 }}>
        <h3 className="th-section__title">Lessons</h3>
        {initialData.lessons.length === 0 ? (
          <p className="th-muted">No lessons attached yet.</p>
        ) : (
          <div className="th-list">
            {initialData.lessons.map((lt) => (
              <div key={lt.lessonId} className="th-list-item">
                <a
                  href={`/lessons/${lt.lessonSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="th-link"
                >
                  {lt.lessonTitle}
                </a>
                {lt.courses.length > 0 && (
                  <span className="th-muted" style={{ marginLeft: 8, fontSize: 13 }}>
                    in{" "}
                    {lt.courses.map((c, i) => (
                      <span key={c.courseSlug}>
                        {i > 0 && ", "}
                        <Link
                          href={`/course/${c.courseSlug}`}
                          className="th-link"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {c.courseTitle}
                        </Link>
                      </span>
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
