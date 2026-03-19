"use client";

import { useState, useEffect } from "react";
import SlugField from "@/components/SlugField";

interface Props {
  memberId: string;
  firstName: string | null;
  lastName: string | null;
  initialIsTeacher: boolean;
  initialProfile: {
    bio: string | null;
    photoUrl: string | null;
    slug: string | null;
    isPublic: boolean;
  } | null;
}

export default function TeacherSection({
  memberId, firstName, lastName, initialIsTeacher, initialProfile,
}: Props) {
  const [isTeacher, setIsTeacher] = useState(initialIsTeacher);
  const [teacherBio, setTeacherBio] = useState(initialProfile?.bio ?? "");
  const [teacherPhotoUrl, setTeacherPhotoUrl] = useState(initialProfile?.photoUrl ?? "");
  const [teacherSlug, setTeacherSlug] = useState(initialProfile?.slug ?? "");
  const [teacherIsPublic, setTeacherIsPublic] = useState(initialProfile?.isPublic ?? false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Auto-generate slug when isTeacher is first enabled and no slug exists yet
  useEffect(() => {
    if (isTeacher && !teacherSlug) {
      const name = [firstName, lastName].filter(Boolean).join(" ");
      const generated = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      if (generated) setTeacherSlug(generated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(`/api/admin/members/${memberId}/teacher-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isTeacher,
          bio: teacherBio || null,
          photoUrl: teacherPhotoUrl || null,
          slug: teacherSlug || null,
          isPublic: teacherIsPublic,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* ── Teacher Attribution ───────────────────────────────────────────────── */}
      <section className="adm2-section">
        <h2 className="adm2-section__title">Teacher Attribution</h2>
        <label className="adm2-role-item">
          <input
            type="checkbox"
            checked={isTeacher}
            onChange={() => setIsTeacher((v) => !v)}
          />
          <div className="adm2-role-item__text">
            <span className="adm2-role-item__name">Teacher</span>
            <span className="adm2-role-item__desc">Can be attributed to lessons and series in the lesson editor.</span>
          </div>
        </label>
      </section>

      {/* ── Teacher Profile (visible when isTeacher) ─────────────────────────── */}
      {isTeacher && (
        <section className="adm2-section">
          <h2 className="adm2-section__title">Public Teacher Profile</h2>
          <p className="adm2-section__hint">
            Optional public profile page. Set a slug to enable the public URL (e.g. /teachers/jesse-foy).
            Check &ldquo;Show on public Teachers page&rdquo; to make it discoverable.
          </p>
          <div className="adm2-form">
            <div className="adm2-form__field">
              <label className="adm2-form__label">Bio</label>
              <textarea
                value={teacherBio}
                onChange={(e) => setTeacherBio(e.target.value)}
                className="adm2-form__input"
                rows={4}
                placeholder="A short bio for this teacher…"
                style={{ resize: "vertical", minHeight: 100 }}
              />
            </div>
            <div className="adm2-form__field">
              <label className="adm2-form__label">Photo URL</label>
              <input
                type="text"
                value={teacherPhotoUrl}
                onChange={(e) => setTeacherPhotoUrl(e.target.value)}
                className="adm2-form__input"
                placeholder="https://…"
              />
            </div>
            <div className="adm2-form__field">
              <label className="adm2-form__label">Slug</label>
              <SlugField
                value={teacherSlug}
                onChange={setTeacherSlug}
                isEditing={true}
                warnText="Changing the slug will break any existing links to this teacher's public page."
                hintText="Public URL: /teachers/[slug]. Leave blank to hide from the public page."
              />
            </div>
            <label className="adm2-role-item" style={{ marginTop: 4 }}>
              <input
                type="checkbox"
                checked={teacherIsPublic}
                onChange={(e) => setTeacherIsPublic(e.target.checked)}
              />
              <div className="adm2-role-item__text">
                <span className="adm2-role-item__name">Show on public Teachers page</span>
              </div>
            </label>
          </div>
        </section>
      )}

      {/* ── Save ─────────────────────────────────────────────────────────────── */}
      <div className="adm2-save">
        {error && <p className="adm2-save__error">{error}</p>}
        <button className="adm2-save__btn" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save teacher profile"}
        </button>
        {saved && <span className="adm2-save__success">Saved ✓</span>}
      </div>
    </>
  );
}
