"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { renderContentBody } from "@/lib/renderRichContent";

interface ManualSection {
  id: string;
  slug: string;
  title: string;
  hubSlug: string | null;
  body: unknown;
  relations: string[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminManualPage() {
  const router = useRouter();
  const [sections, setSections] = useState<ManualSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/manual")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSections(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toSlug(s: string) {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  async function handleCreate() {
    if (!newTitle.trim()) { setError("Title is required."); return; }
    const slug = newSlug.trim() || toSlug(newTitle);
    if (!slug) { setError("Slug is required."); return; }
    setError("");
    const res = await fetch("/api/admin/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), slug, order: sections.length * 10 }),
    });
    if (res.ok) {
      const section = await res.json();
      router.push(`/admin/manual/${section.slug}/edit`);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create section.");
    }
  }

  if (loading) {
    return (
      <div className="man2-page">
        <p style={{ color: "var(--rim-text-muted)", fontFamily: "var(--font-sans)" }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="man2-page">
      <div className="man2-header">
        <h1>Staff Manual</h1>
        <button
          className="th-btn th-btn--primary man2-new-btn"
          onClick={() => setCreating((v) => !v)}
        >
          {creating ? "Cancel" : "+ New section"}
        </button>
      </div>

      {creating && (
        <div className="man2-section" style={{ marginBottom: 24 }}>
          <div className="man2-section__body" style={{ paddingTop: 18 }}>
            <div className="man2-edit__field" style={{ marginBottom: 12 }}>
              <label className="man2-edit__label">Title</label>
              <input
                className="man2-edit__input"
                value={newTitle}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  if (!newSlug) setNewSlug(toSlug(e.target.value));
                }}
                placeholder="Section title"
              />
            </div>
            <div className="man2-edit__field" style={{ marginBottom: 12 }}>
              <label className="man2-edit__label">Slug</label>
              <input
                className="man2-edit__input"
                value={newSlug}
                onChange={(e) => setNewSlug(toSlug(e.target.value))}
                placeholder="e.g. registration-management"
              />
            </div>
            {error && (
              <p style={{ color: "#c0392b", fontFamily: "var(--font-sans)", fontSize: 14, marginBottom: 8 }}>
                {error}
              </p>
            )}
            <button className="th-btn th-btn--primary" onClick={handleCreate}>
              Create &amp; edit
            </button>
          </div>
        </div>
      )}

      {sections.length === 0 && !creating && (
        <p style={{ color: "var(--rim-text-muted)", fontFamily: "var(--font-sans)" }}>
          No sections yet. Create one to get started.
        </p>
      )}

      {sections.map((section) => (
        <div key={section.id} className="man2-section">
          <div
            className="man2-section__header"
            onClick={() => toggle(section.id)}
          >
            <span className="man2-section__title">{section.title}</span>
            <span className="man2-section__slug">{section.slug}</span>
            <span style={{ color: "var(--rim-text-muted)", fontSize: 13 }}>
              {expanded.has(section.id) ? "▲" : "▼"}
            </span>
          </div>

          {expanded.has(section.id) && (
            <div className="man2-section__body">
              {section.body ? (
                <div
                  className="lp-body"
                  dangerouslySetInnerHTML={{
                    __html: renderContentBody(section.body),
                  }}
                />
              ) : (
                <p style={{ color: "var(--rim-text-muted)", fontFamily: "var(--font-sans)", fontSize: 14, fontStyle: "italic" }}>
                  No content yet.
                </p>
              )}
            </div>
          )}

          <div className="man2-section__actions">
            <a
              href={`/admin/manual/${section.slug}`}
              className="th-btn th-btn--ghost"
              style={{ fontSize: 13 }}
            >
              View
            </a>
            <a
              href={`/admin/manual/${section.slug}/edit`}
              className="th-btn th-btn--primary"
              style={{ fontSize: 13 }}
            >
              Edit
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
