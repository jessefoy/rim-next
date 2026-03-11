"use client";

import { useState } from "react";
import Link from "next/link";

type ThreadCategory = "OPERATIONAL" | "CONTEMPLATION" | "GENERAL";
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

// Three rooms matching the mockup exactly
type Room = "issues" | "contemplations" | "general";

const ROOMS: { id: Room; label: string; desc: string; category: ThreadCategory }[] = [
  {
    id: "issues",
    label: "Issues & Challenges",
    desc: "Peer support, tricky situations, collective problem-solving.",
    category: "OPERATIONAL",
  },
  {
    id: "contemplations",
    label: "Contemplations & Practice",
    desc: "Weekly prompts from Jesse and the coordinator.",
    category: "CONTEMPLATION",
  },
  {
    id: "general",
    label: "General",
    desc: "Open conversation, topic by topic. No endless scrolling.",
    category: "GENERAL",
  },
];

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

function Av({ name }: { name: string }) {
  return (
    <div className="hub-conv-avatar" aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

interface NewThreadFormProps {
  room: Room;
  category: ThreadCategory;
  onCreated: (thread: Thread) => void;
  onCancel: () => void;
  isManager: boolean;
}

function NewThreadForm({ category, onCreated, onCancel }: NewThreadFormProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
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
      const newThread: Thread = {
        id: data.id,
        title: title.trim(),
        body: body.trim(),
        category,
        status: "OPEN",
        authorId: "",
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
    <div className="hub-conv-new-form">
      <div className="hub-conv-new-form__header">
        <span className="hub-conv-new-form__title">New Topic</span>
        <button type="button" onClick={onCancel} className="hub-conv-new-form__cancel">
          Cancel
        </button>
      </div>
      <form onSubmit={handleSubmit}>
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
    </div>
  );
}

export default function HubConversationsClient({
  initialThreads,
  currentUserId,
  isManager,
}: Props) {
  const [activeRoom, setActiveRoom] = useState<Room>("issues");
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [showNewForm, setShowNewForm] = useState(false);

  const currentRoom = ROOMS.find((r) => r.id === activeRoom)!;
  const roomThreads = threads.filter(
    (t) => t.category === currentRoom.category && t.status !== "ARCHIVED"
  );

  // CONTEMPLATION room: only managers can post
  const canPost = activeRoom !== "contemplations" || isManager;

  function handleCreated(newThread: Thread) {
    setThreads((prev) => [newThread, ...prev]);
    setShowNewForm(false);
  }

  return (
    <div className="hub-conversations">
      <h2 className="hub-conversations__title">Conversations</h2>
      <p className="hub-conversations__sub">
        Topic-based. Each thread has a beginning and an end. No endless scrolling.
      </p>

      {/* Room pill buttons */}
      <div className="hub-conv-rooms">
        {ROOMS.map((room) => (
          <button
            key={room.id}
            className={`hub-conv-room-btn${activeRoom === room.id ? " hub-conv-room-btn--active" : ""}`}
            onClick={() => {
              setActiveRoom(room.id);
              setShowNewForm(false);
            }}
          >
            {room.label}
          </button>
        ))}
      </div>

      {/* Room description + new topic button */}
      <div className="hub-conv-room-header">
        <p className="hub-conv-room-desc">{currentRoom.desc}</p>
        {canPost && (
          <button
            className="hub-btn hub-btn--sm"
            onClick={() => setShowNewForm((o) => !o)}
          >
            {showNewForm ? "Cancel" : "+ New Topic"}
          </button>
        )}
      </div>

      {/* New topic form */}
      {showNewForm && (
        <NewThreadForm
          room={activeRoom}
          category={currentRoom.category}
          onCreated={handleCreated}
          onCancel={() => setShowNewForm(false)}
          isManager={isManager}
        />
      )}

      {/* Thread list */}
      {roomThreads.length === 0 ? (
        <div className="hub-conv-empty-state">
          <div className="hub-conv-empty-state__icon">💬</div>
          <div className="hub-conv-empty-state__title">No topics yet in this room</div>
          <div className="hub-conv-empty-state__body">
            {activeRoom === "contemplations"
              ? "Jesse or the coordinator will post a weekly practice prompt here."
              : "Start a topic when something comes up worth exploring together."}
          </div>
        </div>
      ) : (
        <ul className="hub-threads__list">
          {roomThreads.map((t) => (
            <li key={t.id}>
              <Link href={`/account/host/conversations/${t.id}`} className="hub-thread-card">
                <Av name={t.authorName} />
                <div className="hub-thread-card__content">
                  <div className="hub-thread-card__top-row">
                    <span className="hub-thread-card__title">{t.title}</span>
                    <span className="hub-thread-card__time">{formatDate(t.updatedAt)}</span>
                  </div>
                  <p className="hub-thread-card__preview">{t.body}</p>
                  <div className="hub-thread-card__meta">
                    {t.replyCount === 0
                      ? "no replies"
                      : t.replyCount === 1
                      ? "1 reply"
                      : `${t.replyCount} replies`}{" "}
                    · {t.authorName}
                    {t.authorId === currentUserId && <span className="hub-thread-detail__you"> (you)</span>}
                    {t.status === "CLOSED" && (
                      <span className="hub-thread-card__status"> · Closed</span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
