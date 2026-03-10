"use client";

import { useState } from "react";
import Link from "next/link";

type ThreadCategory = "OPERATIONAL" | "CONTEMPLATION";
type ThreadStatus = "OPEN" | "CLOSED" | "ARCHIVED";

interface Thread {
  id: string;
  title: string;
  body: string;
  category: ThreadCategory;
  status: ThreadStatus;
  authorId: string;
  authorName: string;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  initialThreads: Thread[];
  currentUserId: string;
  isManager: boolean;
}

type Room = "peer-support" | "contemplation";

const CATEGORY_LABELS: Record<ThreadCategory, string> = {
  OPERATIONAL: "Peer Support",
  CONTEMPLATION: "Contemplation",
};

const CATEGORY_BY_ROOM: Record<Room, ThreadCategory> = {
  "peer-support": "OPERATIONAL",
  "contemplation": "CONTEMPLATION",
};

const ROOM_DESCRIPTIONS: Record<Room, string> = {
  "peer-support":
    "Share challenges, tips, questions, and peer support about hosting. All hosts can post.",
  "contemplation":
    "Weekly reflections posted by teachers and managers for group discussion.",
};

const ALLOWED_CATEGORIES: ThreadCategory[] = ["OPERATIONAL", "CONTEMPLATION"];

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    const diffHrs = Math.floor(diffMs / 3600000);
    if (diffHrs === 0) {
      const diffMin = Math.floor(diffMs / 60000);
      return diffMin <= 1 ? "just now" : `${diffMin}m ago`;
    }
    return `${diffHrs}h ago`;
  }
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface NewThreadFormProps {
  room: Room;
  onCreated: (thread: Thread) => void;
  onCancel: () => void;
  isManager: boolean;
}

function NewThreadForm({ room, onCreated, onCancel, isManager }: NewThreadFormProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<ThreadCategory>(CATEGORY_BY_ROOM[room]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/host/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), category }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to post topic");
        return;
      }
      const data = await res.json();
      // Build optimistic thread object for the list
      const newThread: Thread = {
        id: data.id,
        title: title.trim(),
        body: body.trim(),
        category,
        status: "OPEN",
        authorId: "", // will be resolved on refresh
        authorName: "You",
        replyCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onCreated(newThread);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="hub-conv-new-form">
      <div className="hub-conv-new-form__header">
        <span className="hub-conv-new-form__title">New Topic</span>
        <button type="button" onClick={onCancel} className="hub-conv-new-form__cancel">
          Cancel
        </button>
      </div>

      {isManager && (
        <div className="hub-form-field">
          <label className="hub-form-label">Room</label>
          <select
            className="hub-form-select hub-form-select--sm"
            value={category}
            onChange={(e) => setCategory(e.target.value as ThreadCategory)}
          >
            {ALLOWED_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="hub-form-field">
        <label className="hub-form-label" htmlFor="thread-title">
          Title
        </label>
        <input
          id="thread-title"
          className="hub-form-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's this about?"
          maxLength={140}
          required
        />
      </div>

      <div className="hub-form-field">
        <label className="hub-form-label" htmlFor="thread-body">
          Opening post
        </label>
        <textarea
          id="thread-body"
          className="hub-form-textarea"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share what's on your mind…"
          required
        />
      </div>

      {error && <p className="hub-form-error">{error}</p>}

      <div className="hub-form-actions">
        <button type="submit" className="hub-btn" disabled={saving || !title.trim() || !body.trim()}>
          {saving ? "Posting…" : "Post Topic"}
        </button>
        <button type="button" className="hub-btn hub-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

interface ThreadListProps {
  threads: Thread[];
  currentUserId: string;
}

function ThreadList({ threads, currentUserId }: ThreadListProps) {
  if (threads.length === 0) {
    return <p className="hub-conv-empty">No topics yet — be the first to post.</p>;
  }

  return (
    <ul className="hub-threads__list">
      {threads.map((t) => (
        <li key={t.id} className="hub-thread-card">
          <div className="hub-thread-card__top">
            {t.status === "CLOSED" && (
              <span className="hub-thread-card__status">Closed</span>
            )}
          </div>
          <Link href={`/account/host/conversations/${t.id}`} className="hub-thread-card__title">
            {t.title}
          </Link>
          <p className="hub-thread-card__meta">
            {t.authorId === currentUserId ? "You" : t.authorName} ·{" "}
            {t.replyCount === 0
              ? "no replies"
              : t.replyCount === 1
              ? "1 reply"
              : `${t.replyCount} replies`}{" "}
            · {formatDate(t.updatedAt)}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function HubConversationsClient({
  initialThreads,
  currentUserId,
  isManager,
}: Props) {
  const [activeRoom, setActiveRoom] = useState<Room>("peer-support");
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [showNewForm, setShowNewForm] = useState(false);

  const activeCategory = CATEGORY_BY_ROOM[activeRoom];
  const roomThreads = threads.filter((t) => t.category === activeCategory);

  // CONTEMPLATION room: only managers can post
  const canPost = activeRoom === "peer-support" || isManager;

  function handleCreated(newThread: Thread) {
    setThreads((prev) => [newThread, ...prev]);
    setShowNewForm(false);
  }

  return (
    <div className="hub-conversations">
      {/* Room tabs */}
      <div className="hub-conv-rooms">
        {(["peer-support", "contemplation"] as Room[]).map((room) => (
          <button
            key={room}
            className={`hub-conv-room-btn${activeRoom === room ? " hub-conv-room-btn--active" : ""}`}
            onClick={() => {
              setActiveRoom(room);
              setShowNewForm(false);
            }}
          >
            {room === "peer-support" ? "Peer Support" : "Contemplation"}
          </button>
        ))}
      </div>

      {/* Room description */}
      <p className="hub-conv-room-desc">{ROOM_DESCRIPTIONS[activeRoom]}</p>

      {/* Thread list header */}
      <div className="hub-section-header">
        <h2 className="hub-page__title">
          {activeRoom === "peer-support" ? "Peer Support" : "Contemplation"}
        </h2>
        {canPost && !showNewForm && (
          <button className="hub-btn hub-btn--sm" onClick={() => setShowNewForm(true)}>
            + New Topic
          </button>
        )}
      </div>

      {/* New topic form */}
      {showNewForm && (
        <NewThreadForm
          room={activeRoom}
          onCreated={handleCreated}
          onCancel={() => setShowNewForm(false)}
          isManager={isManager}
        />
      )}

      {/* Thread list */}
      <ThreadList threads={roomThreads} currentUserId={currentUserId} />
    </div>
  );
}
