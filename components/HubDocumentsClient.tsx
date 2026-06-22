"use client";

/**
 * HubDocumentsClient — Documents tab for generic hubs.
 * CSS prefix: hub-doc-
 *
 * Layout: documents grouped by category (hub.documentCategories order),
 * recency-sorted within each group; uncategorized last. A search box filters
 * across label/description/category/author and collapses the grouping into one
 * flat, recency-sorted result list while a query is active. Rows lead with an
 * "Updated <when>" freshness signal (provenance — "Added …" — demoted to hover).
 *
 * All hub members can create documents and edit/delete their own.
 * Coordinators can edit/delete any document.
 *
 * "Add Resource" form supports:
 *  - Link mode: external URL (Google Drive, etc.)
 *  - File mode: PDF upload via Vercel Blob
 *
 * Notify panel appears at the bottom of add/edit forms and as a standalone
 * action on each row (author + coordinators only). Works like Basecamp:
 * default is nobody checked; on existing docs the panel pre-selects members
 * who haven't been notified yet.
 */

import { useState, useRef } from "react";
import { upload } from "@vercel/blob/client";
import HubDocNotifyPanel, { type NotifyMember } from "@/components/HubDocNotifyPanel";
import HubDocCategoryManager from "@/components/HubDocCategoryManager";
import HubDocShareModal from "@/components/HubDocShareModal";
import { relativeDate } from "@/lib/relativeDate";

interface DocAddedBy {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
}

interface HubDoc {
  id: string;
  label: string;
  url: string | null;
  description: string | null;
  fileType: "DOC" | "SHEET" | "SLIDE" | "FORM" | "LINK" | "PDF";
  docKind: "NATIVE" | "ONLYOFFICE" | "LINK" | "UPLOAD";
  category: string | null;
  isNative: boolean;
  isLocked: boolean;
  addedById: string;
  addedBy: DocAddedBy;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  visibility: "HUB" | "COORDINATORS" | "COMMUNITY";
  /** True when this doc's home hub is the hub being viewed (vs. shared in). */
  isOrigin: boolean;
  originHub: { id: string; slug: string; name: string } | null;
  /** Hubs this doc is shared INTO (placements). */
  sharedHubs: { id: string; slug: string; name: string }[];
}

type HubMemberOption = NotifyMember;

interface Props {
  hubSlug: string;
  initialDocuments: HubDoc[];
  documentCategories: string[];
  isCoordinator: boolean;
  /** Office-doc create is gated to coordinators while OnlyOffice is in beta + configured. */
  officeEnabled: boolean;
  currentUserId: string;
  hubMembers: HubMemberOption[];
  /** Hubs the viewer can share a doc into (their own active hubs). */
  viewerHubs: { id: string; name: string }[];
}

type AddMode = "link" | "file";

function detectFileType(url: string): HubDoc["fileType"] {
  if (url.includes("docs.google.com/document"))      return "DOC";
  if (url.includes("docs.google.com/spreadsheets"))  return "SHEET";
  if (url.includes("docs.google.com/presentation")) return "SLIDE";
  if (url.includes("docs.google.com/forms"))         return "FORM";
  return "LINK";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function displayName(u: HubMemberOption | DocAddedBy) {
  return (u as HubMemberOption).preferredName ||
    [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown";
}

/* ── Main component ─────────────────────────────────────────────────────────── */

export default function HubDocumentsClient({
  hubSlug,
  initialDocuments,
  documentCategories: initialCategories,
  isCoordinator,
  officeEnabled,
  currentUserId,
  hubMembers,
  viewerHubs,
}: Props) {
  const [docs, setDocs]               = useState<HubDoc[]>(initialDocuments);
  const [categories, setCategories]   = useState<string[]>(initialCategories);
  const [showAdd, setShowAdd]         = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [view, setView]               = useState<"active" | "archived">("active");
  const [query, setQuery]             = useState("");
  const [showCatManager, setShowCatManager] = useState(false);
  const [shareDoc, setShareDoc]       = useState<HubDoc | null>(null);
  const [removingFromHubId, setRemovingFromHubId] = useState<string | null>(null);

  // Add form state
  const [addMode, setAddMode]           = useState<AddMode>("link");
  const [addLabel, setAddLabel]         = useState("");
  const [addUrl, setAddUrl]             = useState("");
  const [addDesc, setAddDesc]           = useState("");
  const [addCategory, setAddCategory]   = useState(initialCategories[0] ?? "");
  const [addNewCat, setAddNewCat]       = useState("");
  const [addFileType, setAddFileType]   = useState<HubDoc["fileType"]>("LINK");
  const [addNotifyIds, setAddNotifyIds] = useState<string[]>([]);
  const [uploading, setUploading]       = useState(false);
  const [uploadedUrl, setUploadedUrl]   = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string>("");
  const [saving, setSaving]             = useState(false);
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  // Edit form state
  const [editLabel, setEditLabel]         = useState("");
  const [editUrl, setEditUrl]             = useState("");
  const [editDesc, setEditDesc]           = useState("");
  const [editCategory, setEditCategory]   = useState("");
  const [editNewCat, setEditNewCat]       = useState("");
  const [editFileType, setEditFileType]   = useState<HubDoc["fileType"]>("LINK");
  const [editNotifyIds, setEditNotifyIds] = useState<string[]>([]);
  const [editNotifiedMap, setEditNotifiedMap] = useState<Record<string, string>>({});

  // Standalone Notify panel state (post-creation)
  const [notifyDocId, setNotifyDocId]       = useState<string | null>(null);
  const [notifyMembers, setNotifyMembers]   = useState<HubMemberOption[]>([]);
  const [notifySelectedIds, setNotifySelectedIds] = useState<string[]>([]);
  const [notifyNotifiedMap, setNotifyNotifiedMap] = useState<Record<string, string>>({});
  const [notifyLoading, setNotifyLoading]   = useState(false);
  const [notifySending, setNotifySending]   = useState(false);

  function canEdit(doc: HubDoc) {
    return isCoordinator || doc.addedById === currentUserId;
  }

  async function openEdit(doc: HubDoc) {
    setEditingId(doc.id);
    setEditLabel(doc.label);
    setEditUrl(doc.url ?? "");
    setEditDesc(doc.description ?? "");
    setEditCategory(doc.category ?? "");
    setEditNewCat("");
    setEditFileType(doc.fileType);
    setEditNotifyIds([]);
    setEditNotifiedMap({});
    // Fetch prior "updated" notifications so author can see who already got
    // the update email and avoid re-notifying.
    try {
      const res = await fetch(`/api/hub/${hubSlug}/documents/${doc.id}/notify`);
      if (res.ok) {
        const { notifications } = await res.json();
        const map: Record<string, string> = {};
        for (const n of notifications as Array<{ userId: string; eventType: string; notifiedAt: string }>) {
          if (n.eventType === "updated" && !map[n.userId]) map[n.userId] = n.notifiedAt;
        }
        setEditNotifiedMap(map);
      }
    } catch { /* non-fatal — panel still works without the map */ }
  }

  function resetAddForm() {
    setAddLabel(""); setAddUrl(""); setAddDesc(""); setAddNewCat("");
    setAddCategory(initialCategories[0] ?? ""); setAddMode("link");
    setAddFileType("LINK"); setAddNotifyIds([]);
    setUploadedUrl(null); setUploadedName("");
  }

  // ── File upload ──────────────────────────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 80);
      const uniqueName = `hub-docs/${Date.now()}-${safe}`;
      const blob = await upload(uniqueName, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      setUploadedUrl(blob.url);
      setUploadedName(file.name);
      if (!addLabel.trim()) setAddLabel(file.name.replace(/\.[^.]+$/, ""));
    } catch {
      window.alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // ── Save new resource (link or uploaded file) ────────────────────────────
  async function saveDoc() {
    const urlToSave = addMode === "file" ? uploadedUrl : addUrl.trim();
    if (!addLabel.trim() || !urlToSave) return;
    setSaving(true);
    const res = await fetch(`/api/hub/${hubSlug}/documents`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label:       addLabel.trim(),
        url:         urlToSave,
        description: addDesc.trim() || null,
        fileType:    addMode === "file" ? "PDF" : addFileType,
        category:    addNewCat.trim() ? null : (addCategory || null),
        newCategory: addNewCat.trim() || undefined,
        notifyUserIds: addNotifyIds,
      }),
    });
    if (res.ok) {
      const doc = await res.json();
      setDocs((prev) => [doc, ...prev]);
      if (addNewCat.trim() && !categories.includes(addNewCat.trim())) {
        setCategories((prev) => [...prev, addNewCat.trim()]);
      }
      resetAddForm();
      setShowAdd(false);
    }
    setSaving(false);
  }

  // ── New OnlyOffice office doc: create the blank, then open the editor ──────
  const [showOffice, setShowOffice]         = useState(false);
  const [officeLabel, setOfficeLabel]       = useState("");
  const [creatingOffice, setCreatingOffice] = useState(false);

  async function createOfficeDoc(fileType: "DOC" | "SHEET" | "SLIDE") {
    if (!officeLabel.trim() || creatingOffice) return;
    setCreatingOffice(true);
    try {
      const res = await fetch(`/api/hub/${hubSlug}/documents`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ label: officeLabel.trim(), docKind: "ONLYOFFICE", fileType }),
      });
      if (res.ok) {
        const doc = await res.json();
        window.location.href = `/account/documents/${doc.id}/office`;
        return;
      }
    } catch {
      /* re-enable below */
    }
    setCreatingOffice(false);
  }

  // ── Save edit ────────────────────────────────────────────────────────────
  async function updateDoc(id: string) {
    setSaving(true);
    const res = await fetch(`/api/hub/${hubSlug}/documents/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: editLabel.trim(), url: editUrl.trim(),
        description: editDesc.trim() || null,
        fileType: editFileType,
        category: editNewCat.trim() ? null : (editCategory || null),
        newCategory: editNewCat.trim() || undefined,
        notifyUserIds: editNotifyIds,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setDocs((prev) => prev.map((d) => (d.id === id ? updated : d)));
      if (editNewCat.trim() && !categories.includes(editNewCat.trim())) {
        setCategories((prev) => [...prev, editNewCat.trim()]);
      }
      setEditingId(null);
    }
    setSaving(false);
  }

  async function deleteDoc(id: string) {
    if (!window.confirm("Move this document to the trash? Admins and coordinators can restore or permanently delete it from there.")) return;
    setDeletingId(id);
    const res = await fetch(`/api/hub/${hubSlug}/documents/${id}`, { method: "DELETE" });
    if (res.ok) { setDocs((prev) => prev.filter((d) => d.id !== id)); setEditingId(null); }
    setDeletingId(null);
  }

  // Toggle archive state — author or coordinator only.
  async function toggleArchive(id: string, currentlyArchived: boolean) {
    setArchivingId(id);
    const res = await fetch(`/api/hub/${hubSlug}/documents/${id}/archive`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ archived: !currentlyArchived }),
    });
    if (res.ok) {
      const { archivedAt } = await res.json();
      setDocs((prev) => prev.map((d) => d.id === id ? { ...d, archivedAt } : d));
    }
    setArchivingId(null);
  }

  // ── Standalone Notify panel (post-creation) ──────────────────────────────
  // Uses eventType "created" — this is the "tell people the doc exists" path.
  // Already-notified members are rendered as disabled rows with timestamp.
  async function openNotifyPanel(docId: string) {
    setNotifyDocId(docId);
    setNotifyLoading(true);
    setNotifyMembers([]);
    setNotifySelectedIds([]);
    setNotifyNotifiedMap({});
    try {
      const res = await fetch(`/api/hub/${hubSlug}/documents/${docId}/notify`);
      if (res.ok) {
        const { members, notifications } = await res.json();
        setNotifyMembers(members);
        const createdMap: Record<string, string> = {};
        for (const n of notifications as Array<{ userId: string; eventType: string; notifiedAt: string }>) {
          if (n.eventType === "created" && !createdMap[n.userId]) createdMap[n.userId] = n.notifiedAt;
        }
        setNotifyNotifiedMap(createdMap);
        // Pre-select everyone not yet notified (eligible).
        setNotifySelectedIds(
          (members as HubMemberOption[]).filter((m) => !createdMap[m.id]).map((m) => m.id)
        );
      }
    } finally {
      setNotifyLoading(false);
    }
  }

  async function sendNotify() {
    if (!notifyDocId || notifySelectedIds.length === 0) {
      setNotifyDocId(null);
      return;
    }
    setNotifySending(true);
    await fetch(`/api/hub/${hubSlug}/documents/${notifyDocId}/notify`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: notifySelectedIds, eventType: "created" }),
    });
    setNotifySending(false);
    setNotifyDocId(null);
  }

  // ── Sharing (placements + visibility) ────────────────────────────────────
  // Sync local state after the share modal changes a doc's visibility/placements.
  function applyShareUpdate(
    docId: string,
    patch: { visibility?: HubDoc["visibility"]; sharedHubs?: HubDoc["sharedHubs"] },
  ) {
    setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, ...patch } : d)));
    setShareDoc((cur) => (cur && cur.id === docId ? { ...cur, ...patch } : cur));
  }

  // Remove a doc that was shared INTO this hub — deletes just this hub's
  // placement; the document and its origin are untouched.
  async function removeFromHub(doc: HubDoc) {
    const here = doc.sharedHubs.find((h) => h.slug === hubSlug);
    if (!here || removingFromHubId) return;
    if (!window.confirm(
      `Remove “${doc.label}” from this hub? It stays in ${doc.originHub?.name ?? "its home hub"} and any other hubs it's shared with.`
    )) return;
    setRemovingFromHubId(doc.id);
    const res = await fetch(`/api/documents/${doc.id}/placements?hubId=${encodeURIComponent(here.id)}`, { method: "DELETE" });
    if (res.ok) setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    setRemovingFromHubId(null);
  }

  // ── Category select helper ───────────────────────────────────────────────
  function CategorySelect({
    value, onChange, newCat, onNewCatChange,
  }: {
    value: string; onChange: (v: string) => void;
    newCat: string; onNewCatChange: (v: string) => void;
  }) {
    if (value === "__new__" || newCat) {
      return (
        <div className="hub-doc-cat-new-row">
          <input className="fi" type="text" value={newCat} onChange={(e) => onNewCatChange(e.target.value)}
            placeholder="New category name" />
          <button type="button" className="btn--ghost btn--xs"
            onClick={() => { onNewCatChange(""); onChange(categories[0] ?? ""); }}>
            Cancel
          </button>
        </div>
      );
    }
    return (
      <div className="hub-doc-cat-pick">
        <select className="fs" value={value} onChange={(e) => onChange(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="">None (uncategorized)</option>
        </select>
        <button type="button" className="hub-doc-cat-add-link" onClick={() => onChange("__new__")}>
          + New category
        </button>
      </div>
    );
  }

  // ── Filter by view, search, then categorize + sort ───────────────────────
  const visibleDocs = docs.filter((d) =>
    view === "archived" ? d.archivedAt !== null : d.archivedAt === null
  );
  const archivedCount = docs.filter((d) => d.archivedAt !== null).length;

  // Search spans label + description + category + author, scoped to the current
  // (Active/Archived) view. An active query collapses the category grouping into
  // one flat, recency-sorted result list — grouping fights search.
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const matchedDocs = visibleDocs.filter((d) =>
    !searching ||
    [d.label, d.description ?? "", d.category ?? "", displayName(d.addedBy)]
      .join(" ").toLowerCase().includes(q)
  );

  // Recency-first everywhere — ISO timestamps sort lexicographically by time.
  const byUpdatedDesc = (a: HubDoc, b: HubDoc) => b.updatedAt.localeCompare(a.updatedAt);

  type DocSection = { label: string; docs: HubDoc[]; isResults?: boolean };
  let sections: DocSection[] = [];
  if (searching) {
    const flat = [...matchedDocs].sort(byUpdatedDesc);
    if (flat.length > 0) sections = [{ label: "Results", docs: flat, isResults: true }];
  } else {
    const byCategory = new Map<string | null, HubDoc[]>();
    for (const doc of matchedDocs) {
      const key = doc.category;
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(doc);
    }
    for (const cat of categories) {
      const catDocs = (byCategory.get(cat) ?? []).sort(byUpdatedDesc);
      if (catDocs.length > 0) sections.push({ label: cat, docs: catDocs });
    }
    const uncategorized = (byCategory.get(null) ?? []).sort(byUpdatedDesc);
    if (uncategorized.length > 0) sections.push({ label: "Uncategorized", docs: uncategorized });
  }

  const addSaveDisabled =
    saving || uploading || !addLabel.trim() ||
    (addMode === "link" ? !addUrl.trim() : !uploadedUrl);

  return (
    <div className="hub-doc-container">

      {/* Page header */}
      <div className="hub-section-header">
        <h2 className="hub-page__title">Documents</h2>
        <div className="hub-page__actions">
          <a href={`/account/hub/${hubSlug}/documents/new`} className="btn btn--sm">
            + New Document
          </a>
          <button className="btn btn--sm btn--ghost" onClick={() => { setShowAdd((v) => !v); resetAddForm(); }}>
            + Add Resource
          </button>
          {officeEnabled && isCoordinator && (
            <button className="btn btn--sm btn--ghost" onClick={() => setShowOffice((v) => !v)}>
              + Office doc
            </button>
          )}
          {isCoordinator && (
            <button className="btn btn--sm btn--ghost" onClick={() => setShowCatManager(true)}>
              Manage categories
            </button>
          )}
        </div>
      </div>

      {/* Category manager — coordinator curation of the hub vocabulary */}
      {showCatManager && (
        <HubDocCategoryManager
          hubSlug={hubSlug}
          categories={categories}
          onChange={setCategories}
          onRecategorize={(from, to) =>
            setDocs((prev) => prev.map((d) => (d.category === from ? { ...d, category: to } : d)))
          }
          onClose={() => setShowCatManager(false)}
        />
      )}

      {/* Share modal — visibility + cross-hub placements (origin docs only) */}
      {shareDoc && (
        <HubDocShareModal
          doc={shareDoc}
          viewerHubs={viewerHubs}
          onUpdated={applyShareUpdate}
          onClose={() => setShareDoc(null)}
        />
      )}

      {/* Search — calm single input; collapses grouping to flat results when active */}
      {docs.length > 0 && (
        <div className="hub-doc-search">
          <input
            className="hub-doc-search__input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            aria-label="Search documents"
          />
        </div>
      )}

      {/* New office document (OnlyOffice) */}
      {showOffice && (
        <div className="hub-doc-add-form">
          <div className="add-doc-form__title">New office document</div>
          <input
            className="oo-create-input"
            placeholder="Name your document…"
            value={officeLabel}
            onChange={(e) => setOfficeLabel(e.target.value)}
            autoFocus
          />
          <div className="oo-create-types">
            <button type="button" className="btn btn--sm" disabled={!officeLabel.trim() || creatingOffice}
              onClick={() => createOfficeDoc("DOC")}>Document</button>
            <button type="button" className="btn btn--sm" disabled={!officeLabel.trim() || creatingOffice}
              onClick={() => createOfficeDoc("SHEET")}>Spreadsheet</button>
            <button type="button" className="btn btn--sm" disabled={!officeLabel.trim() || creatingOffice}
              onClick={() => createOfficeDoc("SLIDE")}>Presentation</button>
          </div>
          <p className="oo-create-hint">Opens full-screen — co-editing, comments, version history, real pages.</p>
        </div>
      )}

      {/* Active / Archived filter — only shown when archived items exist */}
      {archivedCount > 0 && (
        <div className="hub-doc-view-toggle">
          <button
            type="button"
            className={`hub-doc-view-toggle__btn${view === "active" ? " hub-doc-view-toggle__btn--active" : ""}`}
            onClick={() => setView("active")}
          >
            Active
          </button>
          <button
            type="button"
            className={`hub-doc-view-toggle__btn${view === "archived" ? " hub-doc-view-toggle__btn--active" : ""}`}
            onClick={() => setView("archived")}
          >
            Archived <span className="hub-doc-view-toggle__count">{archivedCount}</span>
          </button>
        </div>
      )}

      {/* Add Resource form */}
      {showAdd && (
        <div className="hub-doc-add-form">
          <div className="add-doc-form__title">Add Resource</div>

          {/* Link / File toggle */}
          <div className="hub-doc-mode-toggle">
            <button
              type="button"
              className={`hub-doc-mode-btn${addMode === "link" ? " hub-doc-mode-btn--active" : ""}`}
              onClick={() => setAddMode("link")}
            >
              Link
            </button>
            <button
              type="button"
              className={`hub-doc-mode-btn${addMode === "file" ? " hub-doc-mode-btn--active" : ""}`}
              onClick={() => setAddMode("file")}
            >
              Upload File
            </button>
          </div>

          {/* URL input (link mode) */}
          {addMode === "link" && (
            <div className="fg">
              <label className="fl">URL</label>
              <div className="hub-doc-url-row">
                <input
                  className="fi"
                  type="url"
                  value={addUrl}
                  onChange={(e) => { setAddUrl(e.target.value); setAddFileType(detectFileType(e.target.value)); }}
                  placeholder="https://…"
                />
                {addUrl && <span className="hub-doc-type-badge">{addFileType}</span>}
              </div>
            </div>
          )}

          {/* File upload (file mode) */}
          {addMode === "file" && (
            <div className="fg">
              <label className="fl">File (PDF)</label>
              {uploadedUrl ? (
                <div className="hub-doc-upload-done">
                  <span className="hub-doc-type-badge hub-doc-type-badge--pdf">PDF</span>
                  <span className="hub-doc-upload-filename">{uploadedName}</span>
                  <button
                    type="button"
                    className="hub-doc-notify-link"
                    onClick={() => { setUploadedUrl(null); setUploadedName(""); }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div
                  className={`hub-doc-upload-zone${uploading ? " hub-doc-upload-zone--loading" : ""}`}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      const fakeEvent = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
                      handleFileSelect(fakeEvent);
                    }
                  }}
                >
                  {uploading ? "Uploading…" : "Click or drag a PDF here to upload"}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    style={{ display: "none" }}
                    onChange={handleFileSelect}
                  />
                </div>
              )}
            </div>
          )}

          <div className="fg">
            <label className="fl">Label</label>
            <input className="fi" type="text" value={addLabel} onChange={(e) => setAddLabel(e.target.value)}
              placeholder="e.g. Virtual Host Guidelines" />
          </div>
          <div className="fg">
            <label className="fl">Category</label>
            <CategorySelect
              value={addCategory} onChange={setAddCategory}
              newCat={addNewCat} onNewCatChange={setAddNewCat}
            />
          </div>
          <div className="fg">
            <label className="fl">Description (optional)</label>
            <input className="fi" type="text" value={addDesc} onChange={(e) => setAddDesc(e.target.value)}
              placeholder="Brief description" />
          </div>

          <HubDocNotifyPanel
            members={hubMembers}
            selectedIds={addNotifyIds}
            onChange={setAddNotifyIds}
          />

          <div className="form-actions">
            <button className="btn--ghost" onClick={() => { setShowAdd(false); resetAddForm(); }}>Cancel</button>
            <button className="btn" onClick={saveDoc} disabled={addSaveDisabled}>
              {saving ? "Saving…" : uploading ? "Uploading…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Standalone Notify panel (post-creation) */}
      {notifyDocId && (
        <div className="hub-doc-notify-overlay">
          <div className="hub-doc-notify-modal">
            <div className="hub-doc-notify-modal__header">
              <strong>Notify team members</strong>
              <button className="btn--ghost btn--xs" onClick={() => setNotifyDocId(null)}>Cancel</button>
            </div>
            <HubDocNotifyPanel
              members={notifyMembers}
              selectedIds={notifySelectedIds}
              onChange={setNotifySelectedIds}
              loading={notifyLoading}
              notifiedMap={notifyNotifiedMap}
            />
            <div className="form-actions">
              <button className="btn--ghost" onClick={() => setNotifyDocId(null)}>Cancel</button>
              <button
                className="btn"
                onClick={sendNotify}
                disabled={notifySending || notifySelectedIds.length === 0}
              >
                {notifySending ? "Sending…" : `Notify${notifySelectedIds.length > 0 ? ` (${notifySelectedIds.length})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document list — category sections, or flat results when searching */}
      {sections.length === 0 ? (
        <p className="hub-empty">
          {searching ? `No documents match “${query.trim()}”.` : "No documents yet."}
        </p>
      ) : (
        sections.map(({ label, docs: catDocs, isResults }) => (
          <div key={label} className="hub-doc-category">
            {!isResults && (
              <div className="hub-doc-category__header">
                <div className="hub-doc-category__title">{label}</div>
              </div>
            )}
            <div className="hub-doc-list">
              {catDocs.map((doc) => (
                <div key={doc.id}>
                  {editingId === doc.id ? (
                    /* Inline edit panel */
                    <div className="hub-doc-add-form hub-doc-edit-inline">
                      <div className="fg">
                        <label className="fl">Label</label>
                        <input className="fi" type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                      </div>
                      {!doc.isNative && doc.fileType !== "PDF" && doc.docKind !== "ONLYOFFICE" && (
                        <div className="fg">
                          <label className="fl">URL</label>
                          <div className="hub-doc-url-row">
                            <input className="fi" type="url" value={editUrl}
                              onChange={(e) => { setEditUrl(e.target.value); setEditFileType(detectFileType(e.target.value)); }} />
                            <span className="hub-doc-type-badge">{editFileType}</span>
                          </div>
                        </div>
                      )}
                      {doc.fileType === "PDF" && (
                        <div className="fg">
                          <label className="fl">File</label>
                          <div className="hub-doc-upload-done">
                            <span className="hub-doc-type-badge hub-doc-type-badge--pdf">PDF</span>
                            <a href={doc.url ?? "#"} target="_blank" rel="noopener noreferrer" className="hub-doc-notify-link">
                              View current file ↗
                            </a>
                          </div>
                        </div>
                      )}
                      <div className="fg">
                        <label className="fl">Category</label>
                        <CategorySelect
                          value={editCategory} onChange={setEditCategory}
                          newCat={editNewCat} onNewCatChange={setEditNewCat}
                        />
                      </div>
                      {!doc.isNative && (
                        <div className="fg">
                          <label className="fl">Description</label>
                          <input className="fi" type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                        </div>
                      )}

                      <HubDocNotifyPanel
                        members={hubMembers}
                        selectedIds={editNotifyIds}
                        onChange={setEditNotifyIds}
                        notifiedMap={editNotifiedMap}
                      />

                      <div className="hub-doc-edit-footer">
                        <div className="hub-doc-edit-footer__right" style={{ marginLeft: "auto" }}>
                          <button className="btn--ghost" onClick={() => setEditingId(null)}>Cancel</button>
                          <button className="btn" onClick={() => updateDoc(doc.id)} disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="hub-doc-item">
                      {!doc.isNative && (
                        <span className={`hub-doc-type-badge${doc.fileType === "PDF" ? " hub-doc-type-badge--pdf" : ""}`}>
                          {doc.fileType}
                        </span>
                      )}
                      {doc.isLocked && <span className="hub-doc-item__edit" title="Locked by author">🔒</span>}
                      <div className="hub-doc-item__text">
                        {doc.docKind === "ONLYOFFICE" ? (
                          <a href={`/account/hub/${hubSlug}/documents/${doc.id}`} className="hub-doc-item__native-link">
                            {doc.label}
                          </a>
                        ) : doc.isNative ? (
                          <a href={`/account/hub/${hubSlug}/documents/${doc.id}`} className="hub-doc-item__native-link">
                            {doc.label}
                          </a>
                        ) : (
                          <a href={doc.url!} target="_blank" rel="noopener noreferrer" className="hub-doc-item__link">
                            {doc.label} ↗
                          </a>
                        )}
                        {(!doc.isOrigin && doc.originHub) && (
                          <span className="hub-doc-share-badge" title={`Shared from ${doc.originHub.name}`}>
                            Shared from {doc.originHub.name}
                          </span>
                        )}
                        {(doc.isOrigin && doc.sharedHubs.length > 0) && (
                          <span className="hub-doc-share-badge"
                            title={`Shared with ${doc.sharedHubs.map((h) => h.name).join(", ")}`}>
                            Shared
                          </span>
                        )}
                        {doc.visibility === "COMMUNITY" && (
                          <span className="hub-doc-share-badge hub-doc-share-badge--community">Community</span>
                        )}
                        {doc.description && <div className="hub-doc-item__desc">{doc.description}</div>}
                      </div>
                      <div className="hub-doc-item__meta" title={`Added ${fmtDate(doc.createdAt)}`}>
                        Updated {relativeDate(doc.updatedAt)} · {displayName(doc.addedBy)}
                      </div>
                      <div className="hub-doc-item__actions">
                        {/* Lifecycle (notify / share / edit / archive / delete) lives
                            with the ORIGIN hub. A hub a doc is shared INTO sees only
                            "Remove from hub". */}
                        {doc.isOrigin && canEdit(doc) && !doc.archivedAt && (
                          <button
                            className="hub-action-btn"
                            onClick={() => openNotifyPanel(doc.id)}
                          >
                            Notify
                          </button>
                        )}
                        {doc.isOrigin && canEdit(doc) && !doc.archivedAt && (
                          <button className="hub-action-btn" onClick={() => setShareDoc(doc)}>
                            Share
                          </button>
                        )}
                        {doc.isOrigin && canEdit(doc) && !doc.isNative && !doc.isLocked && !doc.archivedAt && (
                          <button
                            className="hub-action-btn hub-doc-item__edit"
                            onClick={(e) => { e.stopPropagation(); openEdit(doc); }}
                          >
                            Edit
                          </button>
                        )}
                        {doc.isOrigin && canEdit(doc) && doc.isNative && !doc.archivedAt && (
                          <a
                            href={`/account/hub/${hubSlug}/documents/${doc.id}/edit`}
                            className="hub-action-btn hub-doc-item__edit"
                          >
                            {doc.isLocked && doc.addedById !== currentUserId ? "View" : "Edit"}
                          </a>
                        )}
                        {doc.isOrigin && canEdit(doc) && (
                          <button
                            className="hub-action-btn"
                            onClick={() => toggleArchive(doc.id, !!doc.archivedAt)}
                            disabled={archivingId === doc.id}
                          >
                            {archivingId === doc.id ? "…" : doc.archivedAt ? "Unarchive" : "Archive"}
                          </button>
                        )}
                        {/* Delete only appears on archived items — by design.
                            Three-stage flow: Active → Archived → Trash (manager review). */}
                        {doc.isOrigin && canEdit(doc) && doc.archivedAt && (
                          <button
                            className="hub-action-btn hub-action-btn--del"
                            onClick={() => deleteDoc(doc.id)}
                            disabled={deletingId === doc.id}
                          >
                            {deletingId === doc.id ? "…" : "Delete"}
                          </button>
                        )}
                        {!doc.isOrigin && isCoordinator && (
                          <button
                            className="hub-action-btn hub-action-btn--del"
                            onClick={() => removeFromHub(doc)}
                            disabled={removingFromHubId === doc.id}
                          >
                            {removingFromHubId === doc.id ? "…" : "Remove from hub"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
