"use client";

/**
 * HubDocumentsClient — Documents tab for generic hubs.
 * CSS prefix: hub-doc-
 *
 * Layout: documents grouped by category (from hub.documentCategories order).
 * Uncategorized documents rendered last.
 *
 * All hub members can create documents and edit/delete their own.
 * Coordinators can edit/delete any document.
 */

import { useState } from "react";

interface DocAddedBy {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
}

interface HubDoc {
  id: string;
  label: string;
  url: string | null;             // nullable — native docs have no external URL
  description: string | null;
  fileType: "DOC" | "SHEET" | "SLIDE" | "FORM" | "LINK";
  category: string | null;
  isNative: boolean;
  isLocked: boolean;
  addedById: string;
  addedBy: DocAddedBy;
  createdAt: string;
}

interface Props {
  hubSlug: string;
  initialDocuments: HubDoc[];
  documentCategories: string[];
  isCoordinator: boolean;
  currentUserId: string;
}

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

function displayName(u: DocAddedBy) {
  return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown";
}

export default function HubDocumentsClient({
  hubSlug,
  initialDocuments,
  documentCategories: initialCategories,
  isCoordinator,
  currentUserId,
}: Props) {
  const [docs, setDocs]               = useState<HubDoc[]>(initialDocuments);
  const [categories, setCategories]   = useState<string[]>(initialCategories);
  const [showAdd, setShowAdd]         = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  // Add form state
  const [addLabel, setAddLabel]         = useState("");
  const [addUrl, setAddUrl]             = useState("");
  const [addDesc, setAddDesc]           = useState("");
  const [addCategory, setAddCategory]   = useState(initialCategories[0] ?? "");
  const [addNewCat, setAddNewCat]       = useState("");
  const [addFileType, setAddFileType]   = useState<HubDoc["fileType"]>("LINK");
  const [saving, setSaving]             = useState(false);

  // Edit form state
  const [editLabel, setEditLabel]       = useState("");
  const [editUrl, setEditUrl]           = useState("");
  const [editDesc, setEditDesc]         = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editNewCat, setEditNewCat]     = useState("");
  const [editFileType, setEditFileType] = useState<HubDoc["fileType"]>("LINK");

  function canEdit(doc: HubDoc) {
    return isCoordinator || doc.addedById === currentUserId;
  }

  function openEdit(doc: HubDoc) {
    setEditingId(doc.id);
    setEditLabel(doc.label);
    setEditUrl(doc.url ?? "");
    setEditDesc(doc.description ?? "");
    setEditCategory(doc.category ?? "");
    setEditNewCat("");
    setEditFileType(doc.fileType);
  }

  async function saveDoc() {
    if (!addLabel.trim() || !addUrl.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/hub/${hubSlug}/documents`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label:       addLabel.trim(),
        url:         addUrl.trim(),
        description: addDesc.trim() || null,
        fileType:    addFileType,
        category:    addNewCat.trim() ? null : (addCategory || null),
        newCategory: addNewCat.trim() || undefined,
      }),
    });
    if (res.ok) {
      const doc = await res.json();
      setDocs((prev) => [doc, ...prev]);
      // If a new category was created, add it to the local list
      if (addNewCat.trim() && !categories.includes(addNewCat.trim())) {
        setCategories((prev) => [...prev, addNewCat.trim()]);
      }
      setAddLabel(""); setAddUrl(""); setAddDesc(""); setAddNewCat("");
      setAddCategory(initialCategories[0] ?? ""); setShowAdd(false);
    }
    setSaving(false);
  }

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
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setDocs((prev) => prev.map((d) => (d.id === id ? updated : d)));
      // If a new category was created, add it to the local list
      if (editNewCat.trim() && !categories.includes(editNewCat.trim())) {
        setCategories((prev) => [...prev, editNewCat.trim()]);
      }
      setEditingId(null);
    }
    setSaving(false);
  }

  async function deleteDoc(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/hub/${hubSlug}/documents/${id}`, { method: "DELETE" });
    if (res.ok) { setDocs((prev) => prev.filter((d) => d.id !== id)); setEditingId(null); }
    setDeletingId(null);
  }

  // Build categorized sections
  const byCategory = new Map<string | null, HubDoc[]>();
  for (const doc of docs) {
    const key = doc.category;
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(doc);
  }

  // Render in documentCategories order, uncategorized last
  const sections: Array<{ label: string; docs: HubDoc[] }> = [];
  for (const cat of categories) {
    const catDocs = byCategory.get(cat) ?? [];
    if (catDocs.length > 0) sections.push({ label: cat, docs: catDocs });
  }
  const uncategorized = byCategory.get(null) ?? [];
  if (uncategorized.length > 0) sections.push({ label: "Uncategorized", docs: uncategorized });

  /* ── Category select helper ───────────────────────────────── */
  function CategorySelect({
    value, onChange, newCat, onNewCatChange,
  }: {
    value: string; onChange: (v: string) => void;
    newCat: string; onNewCatChange: (v: string) => void;
  }) {
    if (value === "__new__" || newCat) {
      return (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input className="fi" type="text" value={newCat} onChange={(e) => onNewCatChange(e.target.value)}
            placeholder="New category name" style={{ flex: 1 }} />
          <button type="button" className="btn--ghost" style={{ fontSize: 12, padding: "4px 8px" }}
            onClick={() => { onNewCatChange(""); onChange(categories[0] ?? ""); }}>
            Cancel
          </button>
        </div>
      );
    }
    return (
      <select className="fs" value={value} onChange={(e) => onChange(e.target.value)}>
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        <option value="">None (uncategorized)</option>
        <option value="__new__">+ Add new category…</option>
      </select>
    );
  }

  return (
    <div className="hub-doc-container">

      {/* Toolbar — all hub members can create */}
      <div className="hub-doc-toolbar">
        <a href={`/account/hub/${hubSlug}/documents/new`} className="btn btn--sm">
          + New Document
        </a>
        <button className="btn btn--sm btn--ghost" onClick={() => setShowAdd((v) => !v)}>
          + Add Link
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="hub-doc-add-form">
          <div className="add-doc-form__title">Add Document</div>
          <div className="fg">
            <label className="fl">Label</label>
            <input className="fi" type="text" value={addLabel} onChange={(e) => setAddLabel(e.target.value)}
              placeholder="e.g. Virtual Host Guidelines" />
          </div>
          <div className="fg">
            <label className="fl">Google Drive URL</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                className="fi"
                type="url"
                value={addUrl}
                onChange={(e) => { setAddUrl(e.target.value); setAddFileType(detectFileType(e.target.value)); }}
                placeholder="https://docs.google.com/…"
                style={{ flex: 1 }}
              />
              {addUrl && <span className="hub-doc-type-badge">{addFileType}</span>}
            </div>
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
          <div className="form-actions">
            <button className="btn--ghost" onClick={() => { setShowAdd(false); setAddNewCat(""); }}>Cancel</button>
            <button className="btn" onClick={saveDoc} disabled={saving || !addLabel.trim() || !addUrl.trim()}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Categorized document list */}
      {sections.length === 0 ? (
        <p className="hub-empty">No documents yet.</p>
      ) : (
        sections.map(({ label, docs: catDocs }) => (
          <div key={label} className="hub-doc-category">
            <div className="hub-doc-category__header">
              <div className="hub-doc-category__title">{label}</div>
            </div>
            <div className="hub-doc-list">
              {catDocs.map((doc) => (
                <div key={doc.id}>
                  {editingId === doc.id ? (
                    /* Inline edit panel */
                    <div className="hub-doc-add-form" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0 }}>
                      <div className="fg">
                        <label className="fl">Label</label>
                        <input className="fi" type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                      </div>
                      {!doc.isNative && (
                        <div className="fg">
                          <label className="fl">Google Drive URL</label>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input className="fi" type="url" value={editUrl}
                              onChange={(e) => { setEditUrl(e.target.value); setEditFileType(detectFileType(e.target.value)); }}
                              style={{ flex: 1 }} />
                            <span className="hub-doc-type-badge">{editFileType}</span>
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
                      <div className="form-actions" style={{ justifyContent: "space-between" }}>
                        <button
                          className="hub-action-btn hub-action-btn--del"
                          onClick={() => deleteDoc(doc.id)}
                          disabled={deletingId === doc.id}
                        >
                          {deletingId === doc.id ? "Deleting…" : "Delete"}
                        </button>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn--ghost" onClick={() => setEditingId(null)}>Cancel</button>
                          <button className="btn" onClick={() => updateDoc(doc.id)} disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="hub-doc-item">
                      {!doc.isNative && <span className="hub-doc-type-badge">{doc.fileType}</span>}
                      {doc.isLocked && <span style={{ fontSize: 13, flexShrink: 0 }} title="Locked by author">🔒</span>}
                      <div className="hub-doc-item__text">
                        {doc.isNative ? (
                          <a
                            href={`/account/hub/${hubSlug}/documents/${doc.id}`}
                            className="hub-doc-item__native-link"
                          >
                            {doc.label}
                          </a>
                        ) : (
                          <a
                            href={doc.url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hub-doc-item__link"
                          >
                            {doc.label} ↗
                          </a>
                        )}
                        {doc.description && <div className="hub-doc-item__desc">{doc.description}</div>}
                      </div>
                      <div className="hub-doc-item__meta">
                        {fmtDate(doc.createdAt)} · {displayName(doc.addedBy)}
                      </div>
                      {canEdit(doc) && !doc.isNative && !doc.isLocked && (
                        <button
                          className="hub-action-btn"
                          style={{ flexShrink: 0 }}
                          onClick={(e) => { e.stopPropagation(); openEdit(doc); }}
                        >
                          Edit
                        </button>
                      )}
                      {canEdit(doc) && doc.isNative && (
                        <a
                          href={`/account/hub/${hubSlug}/documents/${doc.id}/edit`}
                          className="hub-action-btn"
                          style={{ flexShrink: 0, textDecoration: "none" }}
                        >
                          {doc.isLocked && doc.addedById !== currentUserId ? "View" : "Edit"}
                        </a>
                      )}
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
