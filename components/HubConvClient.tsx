"use client";

/**
 * HubConvClient — Conversations tab for generic hubs.
 * CSS prefix: cv-
 *
 * Thread list with compose form. Each thread links to /conversations/[id].
 * Any member can post; coordinators can close/archive threads.
 */

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface ThreadAuthor {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
}

interface Thread {
  id: string;
  title: string;
  body: string;
  status: string;
  authorId: string;
  author: ThreadAuthor;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  hubSlug: string;
  initialThreads: Thread[];
  isCoordinator: boolean;
  currentUserId: string;
  currentUserName: string;
}

function displayName(u: ThreadAuthor) {
  return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function HubConvClient({
  hubSlug,
  initialThreads,
  isCoordinator,
  currentUserId,
  currentUserName,
}: Props) {
  const searchParams = useSearchParams();
  const newTopicParam = searchParams.get("newTopic") ?? "";

  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [showCompose, setShowCompose] = useState(!!newTopicParam);
  const [title, setTitle] = useState(newTopicParam);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"open" | "closed">("open");
  const [loadingClosed, setLoadingClosed] = useState(false);
  const [closedThreads, setClosedThreads] = useState<Thread[] | null>(null);

  const displayed = view === "open" ? threads : (closedThreads ?? []);

  async function loadClosed() {
    if (closedThreads !== null) return;
    setLoadingClosed(true);
    const res = await fetch(`/api/hub/${hubSlug}/conversations?status=CLOSED`);
    if (res.ok) {
      const data = await res.json();
      setClosedThreads(
        data.map((t: any) => ({
          id:         t.id,
          title:      t.title,
          body:       t.body,
          status:     t.status,
          authorId:   t.authorId,
          author:     t.author,
          replyCount: t._count?.replies ?? 0,
          createdAt:  t.createdAt,
          updatedAt:  t.updatedAt,
        }))
      );
    }
    setLoadingClosed(false);
  }

  async function postThread() {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/hub/${hubSlug}/conversations`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ title: title.trim(), body: body.trim() }),
    });
    if (res.ok) {
      const t = await res.json();
      const thread: Thread = {
        id:         t.id,
        title:      t.title,
        body:       t.body,
        status:     t.status,
        authorId:   t.authorId,
        author: {
          firstName:     null,
          lastName:      null,
          preferredName: currentUserName,
        },
        replyCount: 0,
        createdAt:  t.createdAt,
        updatedAt:  t.updatedAt,
      };
      setThreads((prev) => [thread, ...prev]);
      setTitle(""); setBody(""); setShowCompose(false);
    }
    setSaving(false);
  }

  async function setStatus(id: string, status: string) {
    const res = await fetch(`/api/hub/${hubSlug}/conversations/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    if (res.ok) {
      if (status === "OPEN") {
        // Move back to open list
        const updated = await res.json();
        const thread: Thread = {
          id:         updated.id,
          title:      updated.title,
          body:       updated.body,
          status:     updated.status,
          authorId:   updated.authorId,
          author:     updated.author,
          replyCount: updated._count?.replies ?? 0,
          createdAt:  updated.createdAt,
          updatedAt:  updated.updatedAt,
        };
        setThreads((prev) => [thread, ...prev]);
        setClosedThreads((prev) => prev ? prev.filter((t) => t.id !== id) : null);
      } else {
        // Remove from open list
        setThreads((prev) => prev.filter((t) => t.id !== id));
        setClosedThreads(null); // invalidate closed cache
      }
    }
  }

  return (
    <div style={{ maxWidth: 680 }}>

      {/* Toolbar */}
      <div className="cv-toolbar">
        <div className="cv-view-pills">
          <button
            className={`cv-pill${view === "open" ? " cv-pill--active" : ""}`}
            onClick={() => setView("open")}
          >
            Open
          </button>
          <button
            className={`cv-pill${view === "closed" ? " cv-pill--active" : ""}`}
            onClick={() => { setView("closed"); loadClosed(); }}
          >
            Closed
          </button>
        </div>
        <button className="btn btn--sm" onClick={() => setShowCompose((v) => !v)}>
          + New Topic
        </button>
      </div>

      {/* Compose form */}
      {showCompose && (
        <div className="cv-compose">
          <div className="cv-compose__title">New Topic</div>
          <div className="fg">
            <label className="fl">Subject</label>
            <input
              className="fi"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What would you like to discuss?"
            />
          </div>
          <div className="fg">
            <label className="fl">Message</label>
            <textarea
              className="fi"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share your thoughts…"
              style={{ resize: "vertical" }}
            />
          </div>
          <div className="form-actions">
            <button className="btn--ghost" onClick={() => { setShowCompose(false); setTitle(""); setBody(""); }}>
              Cancel
            </button>
            <button
              className="btn"
              onClick={postThread}
              disabled={saving || !title.trim() || !body.trim()}
            >
              {saving ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      )}

      {/* Thread list */}
      {loadingClosed ? (
        <p className="hub-empty">Loading…</p>
      ) : displayed.length === 0 ? (
        <p className="hub-empty">
          {view === "open"
            ? "No open conversations yet."
            : "No closed conversations."}
        </p>
      ) : (
        <div className="cv-list">
          {displayed.map((thread) => (
            <div key={thread.id} className="cv-item">
              <div className="cv-item__main">
                <Link href={`/account/hub/${hubSlug}/conversations/${thread.id}`} className="cv-item__title">
                  {thread.title}
                </Link>
                <div className="cv-item__excerpt">{thread.body.slice(0, 120)}{thread.body.length > 120 ? "…" : ""}</div>
                <div className="cv-item__meta">
                  {fmtDate(thread.createdAt)} · {displayName(thread.author)}
                  {thread.replyCount > 0 && (
                    <span className="cv-item__replies"> · {thread.replyCount} {thread.replyCount === 1 ? "reply" : "replies"}</span>
                  )}
                </div>
              </div>
              {isCoordinator && (
                <div className="cv-item__actions">
                  {thread.status === "OPEN" ? (
                    <button className="ann-btn" onClick={() => setStatus(thread.id, "CLOSED")}>
                      Close
                    </button>
                  ) : (
                    <button className="ann-btn" onClick={() => setStatus(thread.id, "OPEN")}>
                      Reopen
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
