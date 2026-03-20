"use client";

import { useState } from "react";
import RimBlockEditor from "@/components/RimBlockEditor";

interface Props {
  slug: string;
  initialTitle: string;
  initialHubSlug: string;
  initialBody: unknown;
  legacyBodyHtml: string | null;  // pre-rendered HTML from server for Tiptap → BlockNote import
  initialRelations: string[];
  initialOrder: number;
}

export default function ManualSectionEditor({
  slug,
  initialTitle,
  initialHubSlug,
  initialBody,
  legacyBodyHtml,
  initialRelations,
  initialOrder,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [hubSlug, setHubSlug] = useState(initialHubSlug);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [body, setBody] = useState<any>(
    Array.isArray(initialBody) ? initialBody : null
  );
  const [relations, setRelations] = useState(initialRelations.join(", "));
  const [order, setOrder] = useState(String(initialOrder));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");

    const relationsArray = relations
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await fetch(`/api/admin/manual/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        hubSlug: hubSlug || null,
        body,
        relations: relationsArray,
        order: parseInt(order) || 0,
      }),
    });

    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save.");
    }
    setSaving(false);
  }

  return (
    <div className="man2-edit">
      <div style={{ marginBottom: 24 }}>
        <a
          href="/admin/manual"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: "var(--rim-text-muted)",
            textDecoration: "none",
          }}
        >
          ← All sections
        </a>
        &ensp;
        <a
          href={`/admin/manual/${slug}`}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: "var(--rim-text-muted)",
            textDecoration: "none",
          }}
        >
          View section
        </a>
      </div>

      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 24,
          color: "var(--rim-text)",
          marginBottom: 32,
        }}
      >
        Editing: {initialTitle}
      </h1>

      <div className="man2-edit__form">
        <div className="man2-edit__field">
          <label className="man2-edit__label">Title</label>
          <input
            className="man2-edit__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="man2-edit__field">
          <label className="man2-edit__label">Hub Slug (optional)</label>
          <input
            className="man2-edit__input"
            value={hubSlug}
            onChange={(e) => setHubSlug(e.target.value)}
            placeholder="e.g. courses, host-team, registrar"
          />
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              color: "var(--rim-text-muted)",
              margin: "4px 0 0",
            }}
          >
            If this section is associated with a specific hub, enter the hub&rsquo;s slug here.
          </p>
        </div>

        <div className="man2-edit__field">
          <label className="man2-edit__label">Content</label>
          <RimBlockEditor
            value={body}
            onChange={setBody}
            placeholder="Write the manual section content…"
            minHeight={500}
            legacyHtml={legacyBodyHtml ?? undefined}
            context="document"
          />
        </div>

        <div className="man2-edit__field">
          <label className="man2-edit__label">Related Sections</label>
          <input
            className="man2-edit__input"
            value={relations}
            onChange={(e) => setRelations(e.target.value)}
            placeholder="Comma-separated slugs, e.g. registration-management, volunteer-roles"
          />
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              color: "var(--rim-text-muted)",
              margin: "4px 0 0",
            }}
          >
            Enter slugs separated by commas. These will appear as links at the bottom of the section.
          </p>
        </div>

        <div className="man2-edit__field">
          <label className="man2-edit__label">Sort Order</label>
          <input
            className="man2-edit__input"
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            style={{ width: 100 }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            className="th-btn th-btn--primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>

          {saved && (
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                color: "#2e7d32",
              }}
            >
              ✓ Saved
            </span>
          )}

          {error && (
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                color: "#c0392b",
              }}
            >
              {error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
