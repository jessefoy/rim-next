"use client";

/**
 * AboutMeSection — account profile page.
 *
 * Renders two things:
 *   1. Presence photo (avatar) upload/remove — wired to /api/account/avatar
 *      and Vercel blob client upload via /api/upload.
 *   2. Personal bio — BlockNote Message-type document, independent of any
 *      role. Saved to User.bio via PATCH /api/account/bio.
 *
 * Placement registered in lib/editorRegistry.ts as `user-bio` (message).
 */

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import dynamic from "next/dynamic";
import { isHtmlString, renderBlockNoteHtml } from "@/lib/renderRichContent";

const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div style={{ minHeight: 80 }} /> },
);

interface Props {
  initialBio: unknown;
  initialAvatarUrl: string | null;
}

export default function AboutMeSection({ initialBio, initialAvatarUrl }: Props) {
  const [bio, setBio] = useState<string>(() => {
    if (isHtmlString(initialBio)) return initialBio;
    return renderBlockNoteHtml(initialBio) || "";
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      const res = await fetch("/api/account/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: blob.url }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setAvatarUrl(blob.url);
    } catch {
      setError("Photo upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAvatarRemove() {
    setError("");
    try {
      await fetch("/api/account/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: null }),
      });
      setAvatarUrl(null);
    } catch {
      setError("Could not remove photo.");
    }
  }

  async function handleBioSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch("/api/account/bio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: bio || null }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Could not save bio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mp-section mp-bio">
      <p className="mp-section__title">About me</p>
      <p className="mp-section__hint">
        Your presence photo appears on your video tile when your camera is off.
        The description below is shown on your member profile.
      </p>

      <div className="mp-bio__avatar-row">
        <div className="mp-bio__avatar">
          {avatarUrl ? (
            <div
              className="mp-bio__avatar-preview"
              style={{ backgroundImage: `url(${avatarUrl})` }}
            />
          ) : (
            <div className="mp-bio__avatar-empty">No photo</div>
          )}
        </div>
        <div className="mp-bio__avatar-actions">
          <button
            type="button"
            className="mp-bio__avatar-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Add photo"}
          </button>
          {avatarUrl && (
            <button
              type="button"
              className="mp-bio__avatar-remove"
              onClick={handleAvatarRemove}
            >
              Remove
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="mp-bio__file-input"
            onChange={handleAvatarUpload}
          />
        </div>
      </div>

      <div className="mp-bio__editor">
        <RimTiptapEditor
          value={bio}
          onChange={setBio}
          placeholder="Share a bit about yourself…"
          variant="message"
        />
      </div>

      <div className="mp-save">
        {error && <p className="mp-save__error">{error}</p>}
        <button
          type="button"
          className="mp-save__btn"
          onClick={handleBioSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save bio"}
        </button>
        {saved && <span className="mp-save__success">Saved ✓</span>}
      </div>
    </section>
  );
}
