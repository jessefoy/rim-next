"use client";

import { useState } from "react";
import Link from "next/link";

interface ThreadItem {
  id: string;
  title: string;
  category: "OPERATIONAL" | "CONTEMPLATION";
  status: "OPEN" | "CLOSED" | "ARCHIVED";
  author: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    preferredName: string | null;
  };
  replyCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  initialThreads: ThreadItem[];
}

function displayName(u: ThreadItem["author"]): string {
  return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ThreadList({ initialThreads }: Props) {
  const [threads, setThreads] = useState<ThreadItem[]>(initialThreads);
  const [category, setCategory] = useState<"" | "OPERATIONAL" | "CONTEMPLATION">("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCategory, setNewCategory] = useState<"OPERATIONAL" | "CONTEMPLATION">("OPERATIONAL");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const filtered = category ? threads.filter((t) => t.category === category) : threads;

  async function handleNewThread(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) {
      setFormError("Title and body are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/host/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), body: newBody.trim(), category: newCategory }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Something went wrong.");
        return;
      }
      // Reload threads
      const listRes = await fetch("/api/host/threads");
      if (listRes.ok) {
        const list = await listRes.json();
        setThreads(list);
      }
      setShowNewForm(false);
      setNewTitle("");
      setNewBody("");
      setNewCategory("OPERATIONAL");
      setSuccessMsg("Thread posted — all hub members have been notified.");
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="hub-threads">
      {/* Controls */}
      <div className="hub-threads__controls">
        <div className="hub-threads__filters">
          <button
            className={`hub-filter-btn${category === "" ? " hub-filter-btn--active" : ""}`}
            onClick={() => setCategory("")}
          >
            All
          </button>
          <button
            className={`hub-filter-btn${category === "OPERATIONAL" ? " hub-filter-btn--active" : ""}`}
            onClick={() => setCategory("OPERATIONAL")}
          >
            Operational
          </button>
          <button
            className={`hub-filter-btn${category === "CONTEMPLATION" ? " hub-filter-btn--active" : ""}`}
            onClick={() => setCategory("CONTEMPLATION")}
          >
            Contemplation
          </button>
        </div>
        <button
          className="hub-btn hub-btn--outline"
          onClick={() => { setShowNewForm(!showNewForm); setFormError(null); setSuccessMsg(null); }}
        >
          {showNewForm ? "Cancel" : "+ New Thread"}
        </button>
      </div>

      {/* Category legend */}
      <p className="hub-threads__legend">
        <strong>Operational</strong> — day-to-day questions, tips, and peer support.{" "}
        <strong>Contemplation</strong> — weekly reflections shared by the teacher or host manager.
      </p>

      {/* Success banner */}
      {successMsg && (
        <p className="hub-success-banner">{successMsg}</p>
      )}

      {/* New thread form */}
      {showNewForm && (
        <div className="hub-thread-form">
          <p className="hub-thread-form__title">Start a Thread</p>
          <form onSubmit={handleNewThread}>
            <div className="hub-form-field">
              <label className="hub-form-label" htmlFor="thread-category">Category</label>
              <select
                id="thread-category"
                className="hub-form-select"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as "OPERATIONAL" | "CONTEMPLATION")}
              >
                <option value="OPERATIONAL">Operational — questions, tips, peer support</option>
                <option value="CONTEMPLATION">Contemplation — weekly reflection from teacher or manager</option>
              </select>
            </div>

            <div className="hub-form-field">
              <label className="hub-form-label" htmlFor="thread-title">Title</label>
              <input
                id="thread-title"
                type="text"
                className="hub-form-input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="What's this thread about?"
              />
            </div>

            <div className="hub-form-field">
              <label className="hub-form-label" htmlFor="thread-body">Body</label>
              <textarea
                id="thread-body"
                className="hub-form-textarea"
                rows={5}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Share your thoughts, question, or reflection…"
              />
            </div>

            {formError && <p className="hub-form-error">{formError}</p>}

            <div className="hub-form-actions">
              <button type="submit" className="hub-btn" disabled={submitting}>
                {submitting ? "Posting…" : "Post Thread"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Thread list */}
      {filtered.length === 0 ? (
        <p className="hub-threads__empty">No threads yet. Use <strong>+ New Thread</strong> to start the first one.</p>
      ) : (
        <ul className="hub-threads__list">
          {filtered.map((thread) => (
            <li key={thread.id} className="hub-thread-card">
              <div className="hub-thread-card__top">
                <span className={`hub-thread-card__cat hub-thread-card__cat--${thread.category.toLowerCase()}`}>
                  {thread.category === "CONTEMPLATION" ? "Contemplation" : "Operational"}
                </span>
                {thread.status === "CLOSED" && (
                  <span className="hub-thread-card__status">Closed</span>
                )}
              </div>
              <Link href={`/account/host/threads/${thread.id}`} className="hub-thread-card__title">
                {thread.title}
              </Link>
              <p className="hub-thread-card__meta">
                {displayName(thread.author)}
                {" · "}
                {formatDate(thread.createdAt)}
                {" · "}
                {thread.replyCount} {thread.replyCount === 1 ? "reply" : "replies"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
