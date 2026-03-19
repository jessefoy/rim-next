"use client";

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
    <div className="hdoc-editor">
      <div className="hdoc-editor__nav">
        <a href={`/account/hub/${hubSlug}/documents`} className="hdoc-editor__back">
          ← Documents
        </a>
      </div>

      <div className="hdoc-editor__header">
        <input
          className="hdoc-editor__title-input"
          type="text"
          placeholder="Document title"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
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

      <div className="hdoc-editor__body">
        <RimBlockEditor
          value={body}
          onChange={setBody}
          placeholder="Begin writing…"
          minHeight={600}
        />
      </div>

      <div className="hdoc-editor__footer">
        {error && <p className="hdoc-editor__error">{error}</p>}
        <div className="hdoc-editor__actions">
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
