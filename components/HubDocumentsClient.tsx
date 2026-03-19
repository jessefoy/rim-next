"use client";

/**
 * HubDocumentsClient — Documents tab for generic hubs.
 * CSS prefix: doc-
 *
 * Layout: documents grouped by category (from hub.documentCategories order).
 * Uncategorized documents rendered last.
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
  addedBy: DocAddedBy;
  createdAt: string;
}

interface Props {
  hubSlug: string;
  initialDocuments: HubDoc[];
  documentCategories: string[];
  isCoordinator: boolean;
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
  documentCategories,
  isCoordinator,
}: Props) {
  const [docs, setDocs]               = useState<HubDoc[]>(initialDocuments);
  const [showAdd, setShowAdd]         = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  // Add form state
  const [addLabel, setAddLabel]         = useState("");
  const [addUrl, setAddUrl]             = useState("");
  const [addDesc, setAddDesc]           = useState("");
  const [addCategory, setAddCategory]   = useState(documentCategories[0] ?? "");
  const [addNewCat, setAddNewCat]       = useState("");
  const [addFileType, setAddFileType]   = useState<HubDoc["fileType"]>("LINK");
  const [saving, setSaving]             = useState(false);

  // Edit form state
  const [editLabel, setEditLabel]       = useState("");
  const [editUrl, setEditUrl]           = useState("");
  const [editDesc, setEditDesc]         = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editFileType, setEditFileType] = useState<HubDoc["fileType"]>("LINK");

  function openEdit(doc: HubDoc) {
    setEditingId(doc.id);
    setEditLabel(doc.label);
    setEditUrl(doc.url ?? "");
    setEditDesc(doc.description ?? "");
    setEditCategory(doc.category ?? "");
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
      setAddLabel(""); setAddUrl(""); setAddDesc(""); setAddNewCat(""); setShowAdd(false);
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
        fileType: editFileType, category: editCategory || null,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setDocs((prev) => prev.map((d) => (d.id === id ? updated : d)));
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
  for (const cat of documentCategories) {
    const catDocs = byCategory.get(cat) ?? [];
    if (catDocs.length > 0) sections.push({ label: cat, docs: catDocs });
  }
  const uncategorized = byCategory.get(null) ?? [];
  if (uncategorized.length > 0) sections.push({ label: "Uncategorized", docs: uncategorized });

  return (
    <div style={{ maxWidth: 680 }}>

      {/* Toolbar */}
      {isCoordinator && (
        <div className="doc-toolbar">
          <a href={`/account/hub/${hubSlug}/documents/new`} className="btn btn--sm">
            + New Document
          </a>
          <button className="btn btn--sm btn--ghost" onClick={() => setShowAdd((v) => !v)}>
            + Add Link
          </button>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="doc-add-form">
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
              {addUrl && <span className="doc-type-badge">{addFileType}</span>}
            </div>
          </div>
          <div className="fg">
            <label className="fl">Category</label>
            {addCategory === "__new__" ? (
              <input className="fi" type="text" value={addNewCat} onChange={(e) => setAddNewCat(e.target.value)}
                placeholder="New category name" />
            ) : (
              <select className="fs" value={addCategory} onChange={(e) => setAddCategory(e.target.value)}>
                {documentCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="">None (uncategorized)</option>
                <option value="__new__">Add new category…</option>
              </select>
            )}
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
          <div key={label} className="doc-category">
            <div className="doc-category__header">
              <div className="doc-category__title">{label}</div>
            </div>
            <div className="doc-list">
              {catDocs.map((doc) => (
                <div key={doc.id}>
                  {editingId === doc.id ? (
                    /* Inline edit panel */
                    <div className="doc-add-form" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0 }}>
                      <div className="fg">
                        <label className="fl">Label</label>
                        <input className="fi" type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                      </div>
                      <div className="fg">
                        <label className="fl">Google Drive URL</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input className="fi" type="url" value={editUrl}
                            onChange={(e) => { setEditUrl(e.target.value); setEditFileType(detectFileType(e.target.value)); }}
                            style={{ flex: 1 }} />
                          <span className="doc-type-badge">{editFileType}</span>
                        </div>
                      </div>
                      <div className="fg">
                        <label className="fl">Category</label>
                        <select className="fs" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                          {documentCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                          <option value="">None (uncategorized)</option>
                        </select>
                      </div>
                      <div className="fg">
                        <label className="fl">Description</label>
                        <input className="fi" type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                      </div>
                      <div className="form-actions" style={{ justifyContent: "space-between" }}>
                        <button
                          className="ann-btn ann-btn--del"
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
                    <div className="doc-item">
                      {!doc.isNative && <span className="doc-type-badge">{doc.fileType}</span>}
                      <div className="doc-item__text">
                        {doc.isNative ? (
                          <a
                            href={`/account/hub/${hubSlug}/documents/${doc.id}`}
                            className="doc-item__native-link"
                          >
                            {doc.label}
                          </a>
                        ) : (
                          <a
                            href={doc.url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="doc-item__link"
                          >
                            {doc.label} ↗
                          </a>
                        )}
                        {doc.description && <div className="doc-item__desc">{doc.description}</div>}
                      </div>
                      <div className="doc-item__meta">
                        {fmtDate(doc.createdAt)} · {displayName(doc.addedBy)}
                      </div>
                      {isCoordinator && !doc.isNative && (
                        <button
                          className="ann-btn"
                          style={{ flexShrink: 0 }}
                          onClick={(e) => { e.stopPropagation(); openEdit(doc); }}
                        >
                          Edit
                        </button>
                      )}
                      {isCoordinator && doc.isNative && (
                        <a
                          href={`/account/hub/${hubSlug}/documents/${doc.id}/edit`}
                          className="ann-btn"
                          style={{ flexShrink: 0, textDecoration: "none" }}
                        >
                          Edit
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
