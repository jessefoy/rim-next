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
import { SaveNote } from "@/components/FormDone";

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
  // Each save is answered beside its own button and the answer stays until
  // the next change (SaveNote; Jesse, 2026-10-13), never a 3-second flash.
  const [bioStatus, setBioStatus] = useState<"idle" | "saved" | "error">("idle");
  const [photo, setPhoto] = useState<{ status: "idle" | "saved" | "error"; saved: string; problem: string }>({
    status: "idle",
    saved: "",
    problem: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setPhoto({ status: "idle", saved: "", problem: "" });
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
      setPhoto({ status: "saved", saved: "Saved. Your new photo is on your profile.", problem: "" });
    } catch {
      setPhoto({ status: "error", saved: "", problem: "Your photo was not saved. Please try again." });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAvatarRemove() {
    setPhoto({ status: "idle", saved: "", problem: "" });
    try {
      const res = await fetch("/api/account/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: null }),
      });
      if (!res.ok) throw new Error("Remove failed");
      setAvatarUrl(null);
      setPhoto({ status: "saved", saved: "Removed. Your profile has no photo now.", problem: "" });
    } catch {
      setPhoto({ status: "error", saved: "", problem: "Your photo was not removed. Please try again." });
    }
  }

  async function handleBioSave() {
    setSaving(true);
    setBioStatus("idle");
    try {
      const res = await fetch("/api/account/bio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: bio || null }),
      });
      if (!res.ok) throw new Error("Save failed");
      setBioStatus("saved");
    } catch {
      setBioStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mp-section mp-bio">
      <h2 className="mp-section__title">Photo and introduction</h2>
      <p className="mp-section__hint">
        Your photo appears in team member lists. The description below is shown
        on your member profile.
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
          <SaveNote status={uploading ? "saving" : photo.status} saved={photo.saved} problem={photo.problem} />
        </div>
      </div>

      <div className="mp-bio__editor">
        <RimTiptapEditor
          value={bio}
          onChange={(html: string) => {
            setBio(html);
            setBioStatus("idle");
          }}
          placeholder="Share a bit about yourself…"
          variant="message"
        />
      </div>

      <div className="mp-save">
        <button
          type="button"
          className="mp-save__btn"
          onClick={handleBioSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save introduction"}
        </button>
        <SaveNote
          status={saving ? "saving" : bioStatus}
          saved="Saved. Your introduction is up to date."
          problem="Your introduction was not saved. What you wrote is still here. Please try again."
        />
      </div>
    </section>
  );
}
