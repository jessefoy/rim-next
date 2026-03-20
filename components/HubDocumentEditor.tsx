"use client";

/**
 * HubDocumentEditor — Bear-inspired document editing surface.
 *
 * Clean white card on warm background. Title input at the top, editor below.
 * No chrome, no border on the editor — just you and the page.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import RimBlockEditor from "@/components/RimBlockEditor";

interface Props {
  hubSlug: string;
  docId: string | null;           // null = new document
  initialLabel: string;
  initialBody: any;               // BlockNote JSON or null
  initialCategory: string;
  documentCategories: string[];
}

export default function HubDocumentEditor({
  hubSlug,
  docId,
  initialLabel,
  initialBody,
  initialCategory,
  documentCategories,
}: Props) {
  const router = useRouter();
  const [label, setLabel] = useState(initialLabel);
  const [body, setBody] = useState<any>(initialBody);
  const [category, setCategory] = useState(initialCategory);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNew = docId === null;

  async function handleSave() {
    if (!label.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError(null);

    try {
      let res: Response;
      if (isNew) {
        res = await fetch(`/api/hub/${hubSlug}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label.trim(),
            body,
            category: category || null,
            isNative: true,
          }),
        });
      } else {
        res = await fetch(`/api/hub/${hubSlug}/documents/${docId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: label.trim(), body, category: category || null }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }

      const saved = await res.json();
      router.push(`/account/hub/${hubSlug}/documents/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!docId) return;
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    const res = await fetch(`/api/hub/${hubSlug}/documents/${docId}`, { method: "DELETE" });
    if (res.ok) router.push(`/account/hub/${hubSlug}/documents`);
  }

  return (
    <div className="doc-page">
      <div className="doc-page__nav">
        <a href={`/account/hub/${hubSlug}/documents`} className="doc-page__back">
          ← Documents
        </a>
        {documentCategories.length > 0 && (
          <select
            className="hdoc-editor__category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">No category</option>
            {documentCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      <div className="doc-page__card">
        <input
          className="doc-page__title-input"
          type="text"
          placeholder="Document title"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <hr />

        <RimBlockEditor
          value={body}
          onChange={setBody}
          placeholder="Begin writing…"
          minHeight={500}
        />
      </div>

      <div className="doc-page__footer" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {error && <p style={{ fontFamily: "var(--font-doc)", fontSize: 13, color: "#c0392b", flex: 1, margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
          {!isNew && (
            <button className="hdoc-editor__delete" onClick={handleDelete}>
              Delete
            </button>
          )}
          <button
            className="hdoc-editor__save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : isNew ? "Create Document" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
