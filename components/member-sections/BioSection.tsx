"use client";

/**
 * BioSection — admin member profile.
 *
 * Lets ADMIN edit any member's personal bio (User.bio) via
 * PATCH /api/admin/members/[id]/bio. Mirrors AdminNotesSection for pattern.
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import { isHtmlString, renderBlockNoteHtml } from "@/lib/renderRichContent";

const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div style={{ minHeight: 80 }} /> },
);

interface Props {
  memberId: string;
  initialBio: unknown;
}

export default function BioSection({ memberId, initialBio }: Props) {
  const [bio, setBio] = useState<string>(() => {
    if (isHtmlString(initialBio)) return initialBio;
    return renderBlockNoteHtml(initialBio) || "";
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(`/api/admin/members/${memberId}/bio`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: bio || null }),
      });
      const data = await res.json().catch(() => ({}));
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
    <section className="adm2-section">
      <h2 className="adm2-section__title">Bio</h2>
      <p className="adm2-section__hint">
        Member's personal description. Separate from any role — shown on the
        member's own profile.
      </p>
      <RimTiptapEditor
        value={bio}
        onChange={setBio}
        placeholder="Personal bio…"
        variant="message"
      />
      <div className="adm2-save">
        {error && <p className="adm2-save__error">{error}</p>}
        <button className="adm2-save__btn" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save bio"}
        </button>
        {saved && <span className="adm2-save__success">Saved ✓</span>}
      </div>
    </section>
  );
}
