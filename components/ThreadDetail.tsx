"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Author {
  id: string;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
}

interface Reply {
  id: string;
  body: string;
  author: Author;
  createdAt: string;
}

interface ThreadData {
  id: string;
  title: string;
  body: string;
  category: "OPERATIONAL" | "CONTEMPLATION";
  status: "OPEN" | "CLOSED" | "ARCHIVED";
  author: Author;
  createdAt: string;
  updatedAt: string;
  replies: Reply[];
}

interface Props {
  thread: ThreadData;
  currentUserId: string;
  isManager: boolean;
}

function displayName(u: Author): string {
  return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ThreadDetail({ thread: initialThread, currentUserId, isManager }: Props) {
  const router = useRouter();
  const [thread, setThread] = useState<ThreadData>(initialThread);
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSubmitting(true);
    setReplyError(null);
    try {
      const res = await fetch(`/api/host/threads/${thread.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReplyError(data.error ?? "Something went wrong.");
        return;
      }
      // Reload thread to get new reply
      const refreshRes = await fetch(`/api/host/threads/${thread.id}`);
      if (refreshRes.ok) {
        const refreshed = await refreshRes.json();
        setThread(refreshed);
      }
      setReplyBody("");
    } catch {
      setReplyError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(status: "OPEN" | "CLOSED" | "ARCHIVED") {
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/host/threads/${thread.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Something went wrong.");
        return;
      }
      if (status === "ARCHIVED") {
        router.push("/account/host/threads");
      } else {
        setThread((prev) => ({ ...prev, status }));
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setStatusUpdating(false);
    }
  }

  const categoryLabel = thread.category === "CONTEMPLATION" ? "Contemplation" : "Operational";

  return (
    <div className="hub-thread-detail">
      {/* Thread header */}
      <div className="hub-thread-detail__header">
        <div className="hub-thread-detail__labels">
          <span className={`hub-thread-card__cat hub-thread-card__cat--${thread.category.toLowerCase()}`}>
            {categoryLabel}
          </span>
          {thread.status === "CLOSED" && (
            <span className="hub-thread-detail__closed">Closed — no new replies</span>
          )}
        </div>
        <h1 className="hub-thread-detail__title">{thread.title}</h1>
        <p className="hub-thread-detail__meta">
          {displayName(thread.author)} · {formatDate(thread.createdAt)}
        </p>
      </div>

      {/* Thread body */}
      <div className="hub-thread-detail__body">
        {thread.body.split("\n").map((line, i) =>
          line ? <p key={i}>{line}</p> : <br key={i} />
        )}
      </div>

      {/* Replies */}
      {thread.replies.length > 0 && (
        <div className="hub-thread-detail__replies">
          <p className="hub-thread-detail__reply-count">
            {thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"}
          </p>
          {thread.replies.map((reply) => (
            <div
              key={reply.id}
              className={`hub-reply${reply.author.id === currentUserId ? " hub-reply--own" : ""}`}
            >
              <p className="hub-reply__meta">
                <strong>{displayName(reply.author)}</strong>
                {reply.author.id === currentUserId && " (you)"}
                {" · "}
                {formatDate(reply.createdAt)}
              </p>
              <div className="hub-reply__body">
                {reply.body.split("\n").map((line, i) =>
                  line ? <p key={i}>{line}</p> : <br key={i} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply form */}
      {thread.status === "OPEN" ? (
        <div className="hub-thread-detail__reply-form">
          <p className="hub-thread-detail__reply-label">Add a reply</p>
          <form onSubmit={handleReply}>
            <textarea
              className="hub-form-textarea"
              rows={4}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Share your thoughts…"
            />
            {replyError && <p className="hub-form-error">{replyError}</p>}
            <div className="hub-form-actions">
              <button type="submit" className="hub-btn" disabled={submitting || !replyBody.trim()}>
                {submitting ? "Posting…" : "Post Reply"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <p className="hub-thread-detail__closed-note">
          This thread is closed. No new replies can be added.
        </p>
      )}

      {/* Manager controls */}
      {isManager && (
        <div className="hub-thread-detail__manager-controls">
          <p className="hub-thread-detail__manager-label">Manager actions</p>
          <div className="hub-form-actions">
            {thread.status === "OPEN" && (
              <button
                className="hub-btn hub-btn--outline hub-btn--sm"
                onClick={() => handleStatusChange("CLOSED")}
                disabled={statusUpdating}
              >
                Close Thread
              </button>
            )}
            {thread.status === "CLOSED" && (
              <button
                className="hub-btn hub-btn--outline hub-btn--sm"
                onClick={() => handleStatusChange("OPEN")}
                disabled={statusUpdating}
              >
                Reopen Thread
              </button>
            )}
            {thread.status !== "ARCHIVED" && (
              <button
                className="hub-btn hub-btn--ghost hub-btn--sm"
                onClick={() => {
                  if (confirm("Archive this thread? It will be hidden from the main list but not deleted.")) {
                    handleStatusChange("ARCHIVED");
                  }
                }}
                disabled={statusUpdating}
              >
                Archive
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
