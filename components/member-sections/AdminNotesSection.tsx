"use client";

import { useState } from "react";
import FormattedEditor from "@/components/FormattedEditor";

interface Props {
  memberId: string;
  initialNotes: unknown;
}

export default function AdminNotesSection({ memberId, initialNotes }: Props) {
  const [notes, setNotes] = useState<unknown>(initialNotes ?? null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: notes || null }),
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
    <section className="adm2-section">
      <h2 className="adm2-section__title">Admin Notes</h2>
      <p className="adm2-section__hint">Private — not visible to the member.</p>
      <FormattedEditor
        value={notes}
        onChange={(v: unknown) => setNotes(v)}
        placeholder="Internal notes about this member…"
        minHeight={160}
      />
      <div className="adm2-save">
        {error && <p className="adm2-save__error">{error}</p>}
        <button className="adm2-save__btn" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save notes"}
        </button>
        {saved && <span className="adm2-save__success">Saved ✓</span>}
      </div>
    </section>
  );
}
