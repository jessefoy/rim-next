"use client";

/**
 * BioSection — admin member profile.
 *
 * Lets ADMIN edit any member's personal bio (User.bio) via
 * PATCH /api/admin/members/[id]/bio. Mirrors AdminNotesSection for pattern.
 */

import { useState } from "react";
import RimProseEditor from "@/components/RimProseEditor";

interface Props {
  memberId: string;
  initialBio: unknown;
}

export default function BioSection({ memberId, initialBio }: Props) {
  const [bio, setBio] = useState<unknown>(
    Array.isArray(initialBio) ? initialBio : null
  );
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
      <RimProseEditor
        value={bio}
        onChange={(v: unknown) => setBio(v)}
        placeholder="Personal bio…"
        minHeight={140}
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
