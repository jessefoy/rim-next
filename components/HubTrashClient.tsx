"use client";

/**
 * HubTrashClient — Trash bin for a single hub.
 * CSS prefix: hub-trash-
 *
 * Lists soft-deleted documents + threads. Each row offers Restore (puts the
 * item back) or Delete permanently (irreversible). Only visible to managers
 * (gated by the server page).
 */

import { useState } from "react";

interface Person {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
}

interface TrashedDoc {
  id: string;
  label: string;
  fileType: string;
  category: string | null;
  addedBy: Person;
  deletedAt: string;
  deletedBy: Person | null;
}

interface TrashedThread {
  id: string;
  title: string;
  category: string;
  replyCount: number;
  author: Person;
  deletedAt: string;
  deletedBy: Person | null;
}

interface Props {
  hubSlug: string;
  hubName: string;
  initialDocs: TrashedDoc[];
  initialThreads: TrashedThread[];
}

function displayName(p: Person | null) {
  if (!p) return "Unknown";
  return p.preferredName || [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unknown";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export default function HubTrashClient({ hubSlug, hubName, initialDocs, initialThreads }: Props) {
  const [docs, setDocs]         = useState<TrashedDoc[]>(initialDocs);
  const [threads, setThreads]   = useState<TrashedThread[]>(initialThreads);
  const [busyId, setBusyId]     = useState<string | null>(null);

  async function restoreDoc(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/hub/${hubSlug}/documents/${id}/restore`, { method: "POST" });
    if (res.ok) setDocs((prev) => prev.filter((d) => d.id !== id));
    setBusyId(null);
  }

  async function permaDeleteDoc(id: string, label: string) {
    if (!window.confirm(`Permanently delete "${label}"? This cannot be undone.`)) return;
    setBusyId(id);
    const res = await fetch(`/api/hub/${hubSlug}/documents/${id}/permanent-delete`, { method: "POST" });
    if (res.ok) setDocs((prev) => prev.filter((d) => d.id !== id));
    setBusyId(null);
  }

  async function restoreThread(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/hub/${hubSlug}/conversations/${id}/restore`, { method: "POST" });
    if (res.ok) setThreads((prev) => prev.filter((t) => t.id !== id));
    setBusyId(null);
  }

  async function permaDeleteThread(id: string, title: string) {
    if (!window.confirm(`Permanently delete the thread "${title}" and all its replies? This cannot be undone.`)) return;
    setBusyId(id);
    const res = await fetch(`/api/hub/${hubSlug}/conversations/${id}/permanent-delete`, { method: "POST" });
    if (res.ok) setThreads((prev) => prev.filter((t) => t.id !== id));
    setBusyId(null);
  }

  const totalCount = docs.length + threads.length;

  return (
    <div className="hub-trash">
      <div className="hub-section-header">
        <h1 className="hub-page__title">Trash</h1>
        <div className="hub-trash__sub">
          {totalCount === 0
            ? "Nothing in the trash."
            : `${totalCount} item${totalCount === 1 ? "" : "s"} deleted from ${hubName}.`}
        </div>
      </div>

      {totalCount === 0 ? (
        <p className="hub-empty">When members delete documents or conversations, they appear here. You can restore them or remove them permanently.</p>
      ) : (
        <>
          {docs.length > 0 && (
            <section className="hub-trash__section">
              <h3 className="hub-trash__section-title">Documents</h3>
              <div className="hub-trash__list">
                {docs.map((d) => (
                  <div key={d.id} className="hub-trash__row">
                    <div className="hub-trash__row-main">
                      <div className="hub-trash__row-label">
                        <span className="hub-doc-type-badge">{d.fileType}</span>
                        <span>{d.label}</span>
                      </div>
                      <div className="hub-trash__row-meta">
                        {d.category && <span>{d.category}</span>}
                        <span>By {displayName(d.addedBy)}</span>
                        <span>Deleted {fmtDate(d.deletedAt)} by {displayName(d.deletedBy)}</span>
                      </div>
                    </div>
                    <div className="hub-trash__row-actions">
                      <button
                        className="hub-action-btn"
                        onClick={() => restoreDoc(d.id)}
                        disabled={busyId === d.id}
                      >
                        {busyId === d.id ? "…" : "Restore"}
                      </button>
                      <button
                        className="hub-action-btn hub-action-btn--del"
                        onClick={() => permaDeleteDoc(d.id, d.label)}
                        disabled={busyId === d.id}
                      >
                        Delete permanently
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {threads.length > 0 && (
            <section className="hub-trash__section">
              <h3 className="hub-trash__section-title">Conversations</h3>
              <div className="hub-trash__list">
                {threads.map((t) => (
                  <div key={t.id} className="hub-trash__row">
                    <div className="hub-trash__row-main">
                      <div className="hub-trash__row-label">
                        <span>{t.title}</span>
                      </div>
                      <div className="hub-trash__row-meta">
                        <span>{t.category}</span>
                        <span>By {displayName(t.author)}</span>
                        <span>{t.replyCount} {t.replyCount === 1 ? "reply" : "replies"}</span>
                        <span>Deleted {fmtDate(t.deletedAt)} by {displayName(t.deletedBy)}</span>
                      </div>
                    </div>
                    <div className="hub-trash__row-actions">
                      <button
                        className="hub-action-btn"
                        onClick={() => restoreThread(t.id)}
                        disabled={busyId === t.id}
                      >
                        {busyId === t.id ? "…" : "Restore"}
                      </button>
                      <button
                        className="hub-action-btn hub-action-btn--del"
                        onClick={() => permaDeleteThread(t.id, t.title)}
                        disabled={busyId === t.id}
                      >
                        Delete permanently
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
