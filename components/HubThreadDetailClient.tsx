"use client";

import { useState, useRef, useEffect } from "react";
import FormattedEditor from "./FormattedEditor";
import { renderFormattedText } from "@/lib/renderRichContent";

type ThreadCategory = "OPERATIONAL" | "CONTEMPLATION" | "GENERAL";
type ThreadStatus = "OPEN" | "CLOSED" | "ARCHIVED";

interface Reply {
  id: string;
  body: any; // Tiptap JSON
  authorId: string;
  authorName: string;
  edited: boolean;
  editedAt: string | null;
  reactions: Record<string, number>;
  createdAt: string;
}

interface Thread {
  id: string;
  title: string;
  body: any; // Tiptap JSON
  category: ThreadCategory;
  status: ThreadStatus;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  replies: Reply[];
}

interface Props {
  thread: Thread;
  currentUserId: string;
  currentUserName: string;
  isManager: boolean;
}

const CATEGORY_LABELS: Record<ThreadCategory, string> = {
  OPERATIONAL: "Issues & Challenges",
  CONTEMPLATION: "Contemplations & Practice",
  GENERAL: "General",
};

const ALLOWED_EMOJIS = ["\ud83d\udc4d", "\u2764\ufe0f", "\ud83d\ude4f", "\ud83d\udca1", "\ud83d\ude0a"] as const;

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
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/** Check if Tiptap JSON has meaningful content */
function hasContent(json: any): boolean {
  if (!json) return false;
  return extractText(json).trim().length > 0;
}

function extractText(json: any): string {
  if (!json) return "";
  if (typeof json === "string") return json;
  if (json.text) return json.text;
  if (json.content) return json.content.map(extractText).join(" ");
  return "";
}

// ── EmojiReactions ──────────────────────────────────────────────────

interface EmojiReactionsProps {
  replyId: string;
  reactions: Record<string, number>;
  onUpdate: (replyId: string, reactions: Record<string, number>) => void;
  disabled: boolean;
}

function EmojiReactions({ replyId, reactions, onUpdate, disabled }: EmojiReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  async function react(emoji: string) {
    if (loading) return;
    setLoading(emoji);
    setPickerOpen(false);
    try {
      const res = await fetch(`/api/host/replies/${replyId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdate(replyId, data.reactions);
      }
    } finally {
      setLoading(null);
    }
  }

  const hasReactions = Object.values(reactions).some((n) => n > 0);

  return (
    <div className="hub-reply-reactions">
      {hasReactions && (
        <div className="hub-reply-reactions__existing">
          {ALLOWED_EMOJIS.filter((e) => (reactions[e] ?? 0) > 0).map((emoji) => (
            <button
              key={emoji}
              className="hub-reply-reaction-pill"
              onClick={() => react(emoji)}
              disabled={!!loading || disabled}
              title={`React with ${emoji}`}
            >
              {emoji} {reactions[emoji]}
            </button>
          ))}
        </div>
      )}

      {!disabled && (
        <div className="hub-reply-reactions__add" ref={pickerRef}>
          <button
            className="hub-reply-reactions__add-btn"
            onClick={() => setPickerOpen((o) => !o)}
            title="Add reaction"
            disabled={!!loading}
          >
            {loading ? "\u2026" : "\u263a"}
          </button>
          {pickerOpen && (
            <div className="hub-reply-reactions__picker">
              {ALLOWED_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  className="hub-reply-reactions__picker-btn"
                  onClick={() => react(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ReplyItem ───────────────────────────────────────────────────────

interface ReplyItemProps {
  reply: Reply;
  currentUserId: string;
  threadOpen: boolean;
  onReactionUpdate: (replyId: string, reactions: Record<string, number>) => void;
  onReplyEdited: (replyId: string, newBody: any) => void;
}

function ReplyItem({
  reply,
  currentUserId,
  threadOpen,
  onReactionUpdate,
  onReplyEdited,
}: ReplyItemProps) {
  const isOwn = reply.authorId === currentUserId;
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState<any>(reply.body);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  async function handleSaveEdit() {
    if (!hasContent(editBody)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/host/replies/${reply.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody }),
      });
      if (res.ok) {
        onReplyEdited(reply.id, editBody);
        setEditing(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setEditError(data.error || "Save failed");
      }
    } catch {
      setEditError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`hub-reply${isOwn ? " hub-reply--own" : ""}`}>
      <p className="hub-reply__meta">
        <strong>{reply.authorName}</strong>
        {isOwn && <span className="hub-thread-detail__you"> (you)</span>}
        {" \u00b7 "}{formatDate(reply.createdAt)}
        {reply.edited && (
          <span className="hub-reply__edited"> \u00b7 edited</span>
        )}
      </p>

      {editing ? (
        <div>
          <FormattedEditor
            value={editBody}
            onChange={setEditBody}
            minHeight={120}
          />
          {editError && <p className="hub-form-error">{editError}</p>}
          <div className="hub-form-actions">
            <button
              className="hub-btn hub-btn--sm"
              onClick={handleSaveEdit}
              disabled={saving || !hasContent(editBody)}
            >
              {saving ? "Saving\u2026" : "Save"}
            </button>
            <button
              className="hub-btn hub-btn--ghost hub-btn--sm"
              onClick={() => {
                setEditing(false);
                setEditBody(reply.body);
                setEditError("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          className="hub-reply__body"
          dangerouslySetInnerHTML={{ __html: renderFormattedText(reply.body) }}
        />
      )}

      <div className="hub-reply__footer">
        <EmojiReactions
          replyId={reply.id}
          reactions={reply.reactions}
          onUpdate={onReactionUpdate}
          disabled={!threadOpen}
        />
        {isOwn && threadOpen && !editing && (
          <button
            className="hub-reply__edit-btn"
            onClick={() => {
              setEditBody(reply.body);
              setEditing(true);
            }}
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export default function HubThreadDetailClient({
  thread: initialThread,
  currentUserId,
  currentUserName,
  isManager,
}: Props) {
  const [thread, setThread] = useState(initialThread);
  const [replyBody, setReplyBody] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [statusChanging, setStatusChanging] = useState(false);

  const isOpen = thread.status === "OPEN";

  function handleReactionUpdate(replyId: string, reactions: Record<string, number>) {
    setThread((t) => ({
      ...t,
      replies: t.replies.map((r) => (r.id === replyId ? { ...r, reactions } : r)),
    }));
  }

  function handleReplyEdited(replyId: string, newBody: any) {
    setThread((t) => ({
      ...t,
      replies: t.replies.map((r) =>
        r.id === replyId ? { ...r, body: newBody, edited: true } : r
      ),
    }));
  }

  async function handleReplySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasContent(replyBody)) return;
    setSubmitting(true);
    setReplyError("");
    try {
      const res = await fetch(`/api/host/threads/${thread.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setReplyError(data.error || "Failed to post reply");
        return;
      }
      const data = await res.json();
      const newReply: Reply = {
        id: data.id,
        body: replyBody,
        authorId: currentUserId,
        authorName: currentUserName,
        edited: false,
        editedAt: null,
        reactions: {},
        createdAt: new Date().toISOString(),
      };
      setThread((t) => ({ ...t, replies: [...t.replies, newReply] }));
      setReplyBody(null);
    } catch {
      setReplyError("Network error \u2014 please try again");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(newStatus: "OPEN" | "CLOSED" | "ARCHIVED") {
    setStatusChanging(true);
    try {
      const res = await fetch(`/api/host/threads/${thread.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setThread((t) => ({ ...t, status: newStatus }));
      }
    } finally {
      setStatusChanging(false);
    }
  }

  return (
    <div className="hub-thread-detail">
      {/* Header */}
      <div className="hub-thread-detail__header">
        <div className="hub-thread-detail__labels">
          <span
            className={`hub-thread-card__cat hub-thread-card__cat--${thread.category.toLowerCase()}`}
          >
            {CATEGORY_LABELS[thread.category]}
          </span>
          {thread.status !== "OPEN" && (
            <span className="hub-thread-detail__closed">
              {thread.status === "CLOSED" ? "Closed" : "Archived"}
            </span>
          )}
        </div>
        <h1 className="hub-thread-detail__title">{thread.title}</h1>
        <p className="hub-thread-detail__meta">
          {thread.authorName}
          {thread.authorId === currentUserId && (
            <span className="hub-thread-detail__you"> (you)</span>
          )}
          {" \u00b7 "}
          {formatDate(thread.createdAt)} \u00b7{" "}
          {thread.replies.length === 0
            ? "no replies"
            : thread.replies.length === 1
            ? "1 reply"
            : `${thread.replies.length} replies`}
        </p>
      </div>

      {/* Opening post body */}
      <div
        className="hub-thread-detail__body"
        dangerouslySetInnerHTML={{ __html: renderFormattedText(thread.body) }}
      />

      {/* Replies */}
      {thread.replies.length > 0 && (
        <div className="hub-thread-detail__replies">
          <p className="hub-thread-detail__reply-count">
            {thread.replies.length} {thread.replies.length === 1 ? "Reply" : "Replies"}
          </p>
          {thread.replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              currentUserId={currentUserId}
              threadOpen={isOpen}
              onReactionUpdate={handleReactionUpdate}
              onReplyEdited={handleReplyEdited}
            />
          ))}
        </div>
      )}

      {/* Reply form */}
      {isOpen ? (
        <div className="hub-thread-detail__reply-form">
          <p className="hub-thread-detail__reply-label">Add a reply</p>
          <form onSubmit={handleReplySubmit}>
            <FormattedEditor
              value={replyBody}
              onChange={setReplyBody}
              placeholder="Share your thoughts\u2026"
              minHeight={160}
            />
            {replyError && <p className="hub-form-error">{replyError}</p>}
            <div className="hub-form-actions" style={{ marginTop: 10 }}>
              <button
                type="submit"
                className="hub-btn"
                disabled={submitting || !hasContent(replyBody)}
              >
                {submitting ? "Posting\u2026" : "Post Reply"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <p className="hub-thread-detail__closed-note">
          This thread is closed \u2014 no new replies can be added.
        </p>
      )}

      {/* Manager controls */}
      {isManager && (
        <div className="hub-thread-detail__manager-controls">
          <p className="hub-thread-detail__manager-label">Manager Actions</p>
          <div className="hub-form-actions">
            {thread.status === "OPEN" && (
              <button
                className="hub-btn hub-btn--outline hub-btn--sm"
                onClick={() => handleStatusChange("CLOSED")}
                disabled={statusChanging}
              >
                {statusChanging ? "\u2026" : "Close Thread"}
              </button>
            )}
            {thread.status === "CLOSED" && (
              <>
                <button
                  className="hub-btn hub-btn--outline hub-btn--sm"
                  onClick={() => handleStatusChange("OPEN")}
                  disabled={statusChanging}
                >
                  {statusChanging ? "\u2026" : "Reopen Thread"}
                </button>
                <button
                  className="hub-btn hub-btn--ghost hub-btn--sm"
                  onClick={() => handleStatusChange("ARCHIVED")}
                  disabled={statusChanging}
                >
                  {statusChanging ? "\u2026" : "Archive Thread"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
