"use client";

/**
 * HubTrashClient — Trash bin for a single hub.
 * CSS prefix: hub-trash-
 *
 * Lists soft-deleted conversation threads. Each row offers Restore (puts the
 * thread back) or Delete permanently (irreversible). Only visible to managers
 * (gated by the server page). Native Documents were retired session 165.
 */

import { useState } from "react";

interface Person {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
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

export default function HubTrashClient({ hubSlug, hubName, initialThreads }: Props) {
  const [threads, setThreads] = useState<TrashedThread[]>(initialThreads);
  const [busyId, setBusyId]   = useState<string | null>(null);

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

  const totalCount = threads.length;

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
        <p className="hub-empty">When members delete conversations, they appear here. You can restore them or remove them permanently.</p>
      ) : (
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
    </div>
  );
}
