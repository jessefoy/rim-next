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
import { relativeDate } from "@/lib/relativeDate";
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
  initialUpdatedAt?: string;      // ISO; drives the "last edited" meta line
  activeEditorName?: string | null;
  hubMembers?: NotifyMember[];    // eligible notification recipients
  canManageSharing?: boolean;     // author / origin-hub coordinator — gates the sharing controls
  initialVisibility?: "HUB" | "COORDINATORS" | "COMMUNITY";
  initialSharedHubs?: { id: string; slug: string; name: string }[];
  viewerHubs?: { id: string; name: string }[];   // viewer's active hubs (share-into picker)
  originHubId?: string | null;
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
  initialUpdatedAt,
  activeEditorName,
  hubMembers = [],
  canManageSharing = false,
  initialVisibility = "HUB",
  initialSharedHubs = [],
  viewerHubs = [],
  originHubId = null,
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
  // Sharing state — persists immediately (independent of the doc Save), mirroring
  // the standalone share modal used on the documents list.
  const [visibility, setVisibility] = useState<"HUB" | "COORDINATORS" | "COMMUNITY">(initialVisibility);
  const [sharedHubs, setSharedHubs] = useState(initialSharedHubs);
  const [addHubId, setAddHubId] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
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

  // ── Sharing (visibility + cross-hub placements) — persists immediately ──
  async function changeVisibility(v: "HUB" | "COORDINATORS" | "COMMUNITY") {
    if (shareBusy || v === visibility || !docId) return;
    setShareBusy(true); setShareError(null);
    try {
      const res = await fetch(`/api/documents/${docId}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: v }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not change visibility");
      setVisibility(v);
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "Could not change visibility");
    } finally { setShareBusy(false); }
  }

  async function addHub() {
    if (!addHubId || shareBusy || !docId) return;
    setShareBusy(true); setShareError(null);
    try {
      const res = await fetch(`/api/documents/${docId}/placements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hubId: addHubId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not share");
      setSharedHubs((cur) => [...cur, data.hub]);
      setAddHubId("");
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "Could not share");
    } finally { setShareBusy(false); }
  }

  async function removeHub(hubId: string) {
    if (shareBusy || !docId) return;
    setShareBusy(true); setShareError(null);
    try {
      const res = await fetch(`/api/documents/${docId}/placements?hubId=${encodeURIComponent(hubId)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not remove");
      setSharedHubs((cur) => cur.filter((h) => h.id !== hubId));
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "Could not remove");
    } finally { setShareBusy(false); }
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

  // Hubs you could share into: your active hubs, minus the origin + already-shared.
  const sharedIds = new Set(sharedHubs.map((h) => h.id));
  const addableHubs = viewerHubs.filter((h) => h.id !== originHubId && !sharedIds.has(h.id));

  return (
    <div className="doc-focus">
      {/* ── Slim top strip — breadcrumb back ─────────────────────────────── */}
      <div className="doc-focus__top">
        <a href={`/account/hub/${hubSlug}/documents`} className="doc-focus__back">
          ← <span className="doc-focus__back-label">Documents</span>
        </a>
        <span className="doc-focus__crumb">{label.trim() || "Untitled document"}</span>
      </div>

      <div className="doc-focus__body">
        {/* ── Editor canvas: title · meta · toolbar · body ───────────────── */}
        <div className="doc-focus__main">
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

          <input
            className="doc-focus__title"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Untitled document"
            aria-label="Document title"
          />
          <div className="doc-focus__meta">
            {isNew
              ? "New document"
              : `Last edited ${initialUpdatedAt ? relativeDate(initialUpdatedAt) : "recently"}${authorName ? ` · ${authorName}` : ""}`}
          </div>

          <RimTiptapEditor
            value={body}
            onChange={setBody}
            placeholder="Begin writing…"
            variant="doc"
          />
        </div>

        {/* ── Settings sidebar ───────────────────────────────────────────── */}
        <aside className="doc-focus__side">
          <div className="doc-focus__save-row">
            <button
              type="button"
              className="doc-focus__cancel"
              onClick={() => router.push(`/account/hub/${hubSlug}/documents`)}
            >
              Cancel
            </button>
            <button
              className="doc-focus__save"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : isNew ? "Create" : "Save"}
            </button>
          </div>
          {error && <p className="doc-focus__error">{error}</p>}

          <section className="doc-focus__field">
            <div className="doc-focus__field-label">Category</div>
            {category === "__new__" || newCat ? (
              <div className="doc-focus__cat-new">
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
          </section>

          {!isNew && canManageSharing && (
            <>
              <section className="doc-focus__field">
                <div className="doc-focus__field-label">Who can see it</div>
                <select
                  className="fs doc-focus__select"
                  value={visibility}
                  disabled={shareBusy}
                  aria-label="Who can see this document"
                  onChange={(e) => changeVisibility(e.target.value as "HUB" | "COORDINATORS" | "COMMUNITY")}
                >
                  <option value="HUB">Hub members</option>
                  <option value="COORDINATORS">Coordinators only</option>
                  <option value="COMMUNITY">Whole community</option>
                </select>
              </section>

              <section className="doc-focus__field">
                <div className="doc-focus__field-label">Shared with other hubs</div>
                {sharedHubs.length === 0 ? (
                  <p className="doc-focus__hint">Only in this hub.</p>
                ) : (
                  <ul className="doc-focus__hubs">
                    {sharedHubs.map((h) => (
                      <li key={h.id} className="doc-focus__hub-row">
                        <span>{h.name}</span>
                        <button
                          type="button"
                          className="hub-action-btn hub-action-btn--del"
                          disabled={shareBusy}
                          onClick={() => removeHub(h.id)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {addableHubs.length > 0 && (
                  <div className="doc-focus__share-add">
                    <select
                      className="fs doc-focus__select"
                      value={addHubId}
                      disabled={shareBusy}
                      aria-label="Share into another hub"
                      onChange={(e) => setAddHubId(e.target.value)}
                    >
                      <option value="">Add a hub…</option>
                      {addableHubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                    <button type="button" className="btn btn--sm" disabled={shareBusy || !addHubId} onClick={addHub}>Share</button>
                  </div>
                )}
                {shareError && <p className="doc-focus__share-error">{shareError}</p>}
              </section>
            </>
          )}

          <section className="doc-focus__field">
            <HubDocNotifyPanel
              members={hubMembers}
              selectedIds={notifyIds}
              onChange={setNotifyIds}
              notifiedMap={notifiedMap}
            />
          </section>

          {!isNew && (isAuthor || isAdmin) && (
            <section className="doc-focus__field doc-focus__field--row">
              <div className="doc-focus__field-label">Lock editing</div>
              <button
                className={`doc-lock-btn${locked ? " doc-lock-btn--locked" : ""}`}
                onClick={toggleLock}
                title={locked ? "Unlock document" : "Lock document"}
              >
                {locked ? "🔒" : "🔓"}
              </button>
            </section>
          )}

          {!isNew && authorName && (
            <div className="doc-focus__author">By {authorName}</div>
          )}

          {!isNew && (
            <div className="doc-focus__danger">
              <button className="hdoc-editor__delete" onClick={handleArchive}>
                Archive
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
