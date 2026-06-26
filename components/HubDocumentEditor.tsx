"use client";

/**
 * HubDocumentEditor — Bear-inspired document editing surface.
 *
 * Clean white card on warm background. Title input at the top, editor below.
 * No chrome, no border on the editor — just you and the page.
 *
 * Features:
 * - Author attribution banner when not the author
 * - Active editor presence warning
 * - Author lock toggle (prevents edits by non-author/non-admin)
 * - Presence heartbeat every 30s while editing
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { isHtmlString, renderBlockNoteHtml } from "@/lib/renderRichContent";
import HubDocNotifyPanel, { type NotifyMember } from "@/components/HubDocNotifyPanel";

const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div style={{ minHeight: 500 }} /> },
);

interface Props {
  hubSlug: string;
  docId: string | null;           // null = new document
  initialLabel: string;
  initialBody: any;               // HTML string or legacy BlockNote JSON
  initialCategory: string;
  documentCategories: string[];
  isAuthor?: boolean;
  isAdmin?: boolean;
  isLocked?: boolean;
  authorName?: string;
  activeEditorName?: string | null;
  hubMembers?: NotifyMember[];    // eligible notification recipients
}

export default function HubDocumentEditor({
  hubSlug,
  docId,
  initialLabel,
  initialBody,
  initialCategory,
  documentCategories,
  isAuthor = true,
  isAdmin = false,
  isLocked: initialLocked = false,
  authorName,
  activeEditorName,
  hubMembers = [],
}: Props) {
  const router = useRouter();
  const [label, setLabel] = useState(initialLabel);
  // Lazy migration: convert legacy BlockNote JSON to HTML on load.
  const [body, setBody] = useState<string>(
    isHtmlString(initialBody) ? initialBody : (renderBlockNoteHtml(initialBody) || ""),
  );
  const [category, setCategory] = useState(initialCategory);
  const [newCat, setNewCat] = useState("");
  const [categories, setCategories] = useState(documentCategories);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(initialLocked);
  const [notifyIds, setNotifyIds] = useState<string[]>([]);
  const [notifiedMap, setNotifiedMap] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isNew = docId === null;

  // ── Presence heartbeat ───────────────────────────────────────────────
  useEffect(() => {
    if (isNew || !docId) return;

    // Initial heartbeat
    fetch(`/api/hub/${hubSlug}/documents/${docId}/presence`, { method: "POST" });

    // Heartbeat every 30s
    heartbeatRef.current = setInterval(() => {
      fetch(`/api/hub/${hubSlug}/documents/${docId}/presence`, { method: "POST" });
    }, 30_000);

    // Clear presence on unmount
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      fetch(`/api/hub/${hubSlug}/documents/${docId}/presence`, { method: "DELETE" });
    };
  }, [docId, hubSlug, isNew]);

  // ── Load prior "updated" notifications so author can see who's been told ─
  useEffect(() => {
    if (isNew || !docId) return;
    let cancelled = false;
    fetch(`/api/hub/${hubSlug}/documents/${docId}/notify`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const map: Record<string, string> = {};
        for (const n of (data.notifications ?? []) as Array<{ userId: string; eventType: string; notifiedAt: string }>) {
          if (n.eventType === "updated" && !map[n.userId]) map[n.userId] = n.notifiedAt;
        }
        setNotifiedMap(map);
      })
      .catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  }, [docId, hubSlug, isNew]);

  // ── Lock toggle ──────────────────────────────────────────────────────
  async function toggleLock() {
    if (!docId) return;
    const res = await fetch(`/api/hub/${hubSlug}/documents/${docId}/lock`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setLocked(data.isLocked);
    }
  }

  async function handleSave() {
    if (!label.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError(null);

    try {
      const resolvedCategory = newCat.trim() ? null : (category || null);
      const newCategory = newCat.trim() || undefined;

      let res: Response;
      if (isNew) {
        res = await fetch(`/api/hub/${hubSlug}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label.trim(),
            body,
            category: resolvedCategory,
            newCategory,
            isNative: true,
            notifyUserIds: notifyIds,
          }),
        });
      } else {
        res = await fetch(`/api/hub/${hubSlug}/documents/${docId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label.trim(), body,
            category: resolvedCategory,
            newCategory,
            notifyUserIds: notifyIds,
          }),
        });
      }

      // If a new category was created, track it locally
      if (newCat.trim() && !categories.includes(newCat.trim())) {
        setCategories((prev) => [...prev, newCat.trim()]);
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

  async function handleArchive() {
    if (!docId) return;
    if (!window.confirm("Archive this document? It will move to the Archived tab — anyone can unarchive it from there, and admins or coordinators can delete it from there.")) return;
    const res = await fetch(`/api/hub/${hubSlug}/documents/${docId}/archive`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ archived: true }),
    });
    if (res.ok) router.push(`/account/hub/${hubSlug}/documents`);
  }

  return (
    <div className="doc-page">
      {/* ── Banners ─────────────────────────────────────────────────── */}
      {activeEditorName && !dismissed && (
        <div className="doc-banner doc-banner--warning">
          <span><strong>{activeEditorName}</strong> may be editing this document right now. Changes could conflict.</span>
          <button className="doc-banner__dismiss" onClick={() => setDismissed(true)}>Continue anyway</button>
        </div>
      )}
      {!isNew && !isAuthor && authorName && (
        <div className="doc-banner doc-banner--info">
          You are editing a document created by <strong>{authorName}</strong>.
        </div>
      )}

      <div className="doc-page__nav">
        <a href={`/account/hub/${hubSlug}/documents`} className="doc-page__back">
          ← Documents
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {category === "__new__" || newCat ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="hdoc-editor__category-input"
                type="text"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="New category name"
              />
              <button
                type="button"
                className="btn--ghost"
                style={{ fontSize: "var(--text-label)", padding: "4px 8px", whiteSpace: "nowrap" }}
                onClick={() => { setNewCat(""); setCategory(categories[0] ?? ""); }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="hdoc-editor__category-pick">
              <select
                className="hdoc-editor__category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                type="button"
                className="hdoc-editor__category-add"
                onClick={() => setCategory("__new__")}
              >
                + New
              </button>
            </div>
          )}
          {/* Lock toggle — only author + admin */}
          {!isNew && (isAuthor || isAdmin) && (
            <button
              className={`doc-lock-btn${locked ? " doc-lock-btn--locked" : ""}`}
              onClick={toggleLock}
              title={locked ? "Unlock document" : "Lock document"}
            >
              {locked ? "🔒" : "🔓"}
            </button>
          )}
        </div>
      </div>

      <div className="doc-page__card doc-page__card--editor">
        <RimTiptapEditor
          value={body}
          onChange={setBody}
          placeholder="Begin writing…"
          variant="doc"
          title={label}
          onTitleChange={setLabel}
          titlePlaceholder="Document title"
        />
      </div>

      <HubDocNotifyPanel
        members={hubMembers}
        selectedIds={notifyIds}
        onChange={setNotifyIds}
        notifiedMap={notifiedMap}
      />

      <div className="doc-page__footer" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {error && <p style={{ fontFamily: "var(--font-doc)", fontSize: "var(--text-xs)", color: "var(--color-error)", flex: 1, margin: 0 }}>{error}</p>}
        {locked && (
          <span style={{ fontFamily: "var(--font-doc)", fontSize: "var(--text-xs)", color: "var(--rim-text-muted)", flex: 1, margin: 0 }}>
            🔒 Locked{isAuthor ? " — only you and admins can edit" : ""}
          </span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
          {!isNew && (
            <button className="hdoc-editor__delete" onClick={handleArchive}>
              Archive
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
