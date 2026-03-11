"use client";

/**
 * HubAnnouncementsClient — Announcements tab for generic hubs.
 * CSS prefix: ann-
 */

import { useState } from "react";
import Link from "next/link";

interface AnnAuthor {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  status: "ACTIVE" | "ARCHIVED";
  linkedThreadId: string | null;
  authorId: string;
  author: AnnAuthor;
  createdAt: string;
}

interface Props {
  hubSlug: string;
  initialAnnouncements: Announcement[];
  isCoordinator: boolean;
  conversationsBase: string; // e.g. /account/hub/host-team/conversations
}

function displayName(a: AnnAuthor) {
  return a.preferredName || [a.firstName, a.lastName].filter(Boolean).join(" ") || "Unknown";
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 1000 / 3600;
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${Math.floor(diffH)} hour${Math.floor(diffH) !== 1 ? "s" : ""} ago`;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

const PRIORITY_CLASS: Record<string, string> = {
  NORMAL:    "",
  IMPORTANT: " ann-item--imp",
  URGENT:    " ann-item--urg",
};

const PRIORITY_BADGE: Record<string, { cls: string; label: string } | null> = {
  NORMAL:    null,
  IMPORTANT: { cls: "pill pill--important", label: "Important" },
  URGENT:    { cls: "pill pill--urgent",    label: "Urgent" },
};

export default function HubAnnouncementsClient({
  hubSlug,
  initialAnnouncements,
  isCoordinator,
  conversationsBase,
}: Props) {
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements);
  const [showCompose, setShowCompose]     = useState(false);
  const [showArchived, setShowArchived]   = useState(false);
  const [archivedList, setArchivedList]   = useState<Announcement[] | null>(null);
  const [loadingArchived, setLoadingArchived] = useState(false);

  // Compose form state
  const [title, setTitle]       = useState("");
  const [body, setBody]         = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "IMPORTANT" | "URGENT">("NORMAL");
  const [posting, setPosting]   = useState(false);

  // Per-item state for delete confirm
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId]       = useState<string | null>(null);
  const [turningId, setTurningId]         = useState<string | null>(null);

  async function postAnnouncement() {
    if (!title.trim() || !body.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/hub/${hubSlug}/announcements`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ title: title.trim(), body: body.trim(), priority }),
    });
    if (res.ok) {
      const ann = await res.json();
      setAnnouncements((prev) => [ann, ...prev]);
      setTitle(""); setBody(""); setPriority("NORMAL"); setShowCompose(false);
    }
    setPosting(false);
  }

  async function archiveAnn(id: string) {
    const res = await fetch(`/api/hub/${hubSlug}/announcements/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: "ARCHIVED" }),
    });
    if (res.ok) setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  }

  async function deleteAnn(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/hub/${hubSlug}/announcements/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      setConfirmDelete(null);
    }
    setDeletingId(null);
  }

  async function turnIntoConversation(id: string) {
    setTurningId(id);
    const res = await fetch(`/api/hub/${hubSlug}/announcements/${id}/thread`, { method: "POST" });
    if (res.ok) {
      const { threadId } = await res.json();
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, linkedThreadId: threadId } : a))
      );
      window.location.href = `${conversationsBase}/${threadId}`;
    }
    setTurningId(null);
  }

  async function loadArchived() {
    if (archivedList) { setShowArchived(true); return; }
    setLoadingArchived(true);
    const res = await fetch(`/api/hub/${hubSlug}/announcements?archived=true`);
    if (res.ok) { setArchivedList(await res.json()); }
    setLoadingArchived(false);
    setShowArchived(true);
  }

  const displayed = showArchived ? (archivedList ?? []) : announcements;

  return (
    <div style={{ maxWidth: 680 }}>

      {/* Coordinator toolbar */}
      {isCoordinator && !showArchived && (
        <div className="ann-toolbar">
          <button className="btn btn--sm" onClick={() => setShowCompose((v) => !v)}>
            + New Announcement
          </button>
        </div>
      )}

      {/* Compose form */}
      {showCompose && (
        <div className="ann-compose">
          <div className="ann-compose__title">New Announcement</div>
          <div className="fg">
            <label className="fl">Title</label>
            <input
              className="fi"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do team members need to know?"
            />
          </div>
          <div className="fg">
            <label className="fl">Message</label>
            <textarea
              className="ft"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message here…"
            />
          </div>
          <div className="fg" style={{ marginBottom: 0 }}>
            <label className="fl" style={{ marginBottom: 9 }}>Priority</label>
            <div className="priority-row">
              {(["NORMAL", "IMPORTANT", "URGENT"] as const).map((p) => (
                <button
                  key={p}
                  className={`priority-btn${p === "IMPORTANT" ? " priority-btn--imp" : p === "URGENT" ? " priority-btn--urg" : ""}${priority === p ? " on" : ""}`}
                  onClick={() => setPriority(p)}
                  type="button"
                >
                  {p === "NORMAL" ? "Normal" : p === "IMPORTANT" ? "Important" : "Urgent"}
                </button>
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button className="btn--ghost" onClick={() => setShowCompose(false)}>Cancel</button>
            <button className="btn" onClick={postAnnouncement} disabled={posting || !title.trim() || !body.trim()}>
              {posting ? "Posting…" : "Post Announcement"}
            </button>
          </div>
        </div>
      )}

      {/* Archived view header */}
      {showArchived && (
        <div style={{ marginBottom: 16 }}>
          <button className="hub-back-link" onClick={() => setShowArchived(false)}>
            ← Back to announcements
          </button>
          <div className="db-sec-title" style={{ marginBottom: 0 }}>Archived Announcements</div>
        </div>
      )}

      {/* List */}
      {loadingArchived ? (
        <p className="hub-empty">Loading…</p>
      ) : displayed.length === 0 ? (
        <p className="hub-empty">{showArchived ? "No archived announcements." : "No announcements yet."}</p>
      ) : (
        displayed.map((ann) => {
          const badge = PRIORITY_BADGE[ann.priority];
          return (
            <div key={ann.id} className={`ann-item${PRIORITY_CLASS[ann.priority]}`}>
              <div className="ann-item__title-row">
                {badge && <span className={badge.cls}>{badge.label}</span>}
                <span className="ann-item__title">{ann.title}</span>
              </div>
              <div className="ann-item__meta">
                Posted by {displayName(ann.author)} · {fmtDate(ann.createdAt)}
              </div>
              <div className="ann-item__body">{ann.body}</div>
              <div className="ann-item__footer">
                {/* Discussion link */}
                <span>
                  {ann.linkedThreadId ? (
                    <Link
                      href={`${conversationsBase}/${ann.linkedThreadId}`}
                      className="ann-item__disc-link"
                    >
                      Discussion open — Go to conversation
                    </Link>
                  ) : (
                    <Link
                      href={`${conversationsBase}?newTopic=${encodeURIComponent(ann.title)}`}
                      className="ann-item__disc-prompt"
                    >
                      Have questions? Start a conversation
                    </Link>
                  )}
                </span>

                {/* Coordinator actions */}
                {isCoordinator && !showArchived && (
                  <div className="ann-coord">
                    {!ann.linkedThreadId && (
                      <button
                        className="ann-btn"
                        onClick={() => turnIntoConversation(ann.id)}
                        disabled={turningId === ann.id}
                      >
                        {turningId === ann.id ? "Creating…" : "Turn into conversation"}
                      </button>
                    )}
                    <button className="ann-btn" onClick={() => archiveAnn(ann.id)}>Archive</button>
                    {confirmDelete === ann.id ? (
                      <>
                        <button
                          className="ann-btn ann-btn--del"
                          onClick={() => deleteAnn(ann.id)}
                          disabled={deletingId === ann.id}
                        >
                          {deletingId === ann.id ? "Deleting…" : "Confirm delete"}
                        </button>
                        <button className="ann-btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="ann-btn ann-btn--del" onClick={() => setConfirmDelete(ann.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* View archived link */}
      {!showArchived && (
        <div className="ann-archive-link" onClick={loadArchived} style={{ cursor: "pointer" }}>
          View archived announcements
        </div>
      )}
    </div>
  );
}
