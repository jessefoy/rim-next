"use client";

/**
 * HubConvThreadClient — Thread detail + replies.
 * CSS prefix: hub-conv- (shared with conversation list)
 *
 * Design:
 *   - Each post (original + replies) is a "card" with avatar + author + timestamp
 *   - Authors can edit their own posts inline (pencil on hover)
 *   - Coordinator actions (pin/close) collapsed into a "…" menu in the header
 *   - Reactions are clickable chips; aggregate chip appears below the body
 *   - Generous spacing between posts
 */

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Pin, Pencil, MoreHorizontal, SmilePlus } from "lucide-react";
import dynamic from "next/dynamic";
const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div style={{ minHeight: 80 }} /> },
);
import { renderBlockNoteHtml } from "@/lib/renderRichContent";
import { avatarColorFor } from "@/lib/avatarColor";

interface PersonName {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
}

interface Reply {
  id: string;
  body: any;
  bodyHtml: string;
  authorId: string;
  author: PersonName;
  edited: boolean;
  editedAt: string | null;
  /** Map of emoji → list of user IDs who've reacted with it. */
  reactions: Record<string, string[]>;
  createdAt: string;
}

interface Thread {
  id: string;
  title: string;
  body: any;
  bodyHtml: string;
  status: string;
  isPinned: boolean;
  edited: boolean;
  editedAt: string | null;
  authorId: string;
  author: PersonName;
  replies: Reply[];
  createdAt: string;
}

interface Props {
  hubSlug: string;
  initialThread: Thread;
  isCoordinator: boolean;
  currentUserId: string;
  currentUser: PersonName;
}

const ALLOWED_EMOJIS = ["👍", "❤️", "🙏", "💡", "😊"] as const;

function displayName(u: PersonName) {
  const first = u.preferredName || u.firstName;
  const full = [first, u.lastName].filter(Boolean).join(" ");
  return full || u.preferredName || u.firstName || u.lastName || "Someone";
}

function initialsOf(u: PersonName) {
  if (u.firstName && u.lastName) {
    return (u.firstName[0] + u.lastName[0]).toUpperCase();
  }
  const name = u.preferredName || u.firstName || u.lastName || "";
  if (!name) return "?";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function relativeTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function hasContent(value: any): boolean {
  if (!value) return false;
  if (typeof value === "string") return value.replace(/<[^>]+>/g, "").trim().length > 0;
  if (Array.isArray(value)) {
    const extract = (n: any): string => {
      if (!n) return "";
      if (typeof n === "string") return n;
      if (n.text) return n.text;
      if (n.content) return (n.content as any[]).map(extract).join(" ");
      if (n.children) return (n.children as any[]).map(extract).join(" ");
      return "";
    };
    return value.map(extract).join(" ").trim().length > 0;
  }
  return false;
}

export default function HubConvThreadClient({
  hubSlug,
  initialThread,
  isCoordinator,
  currentUserId,
  currentUser,
}: Props) {
  const [thread, setThread] = useState<Thread>(initialThread);
  const [replyBody, setReplyBody] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Editing state — single flag keyed by "op" or reply id
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState<string>("");
  const [editTitle, setEditTitle] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // "…" menu toggle for thread-level actions
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  // Reaction picker popover per-reply
  const [reactionOpenFor, setReactionOpenFor] = useState<string | null>(null);

  const isClosed = thread.status !== "OPEN";
  const canEditOp = thread.authorId === currentUserId || isCoordinator;

  async function postReply() {
    if (!hasContent(replyBody)) return;
    setSaving(true);
    const res = await fetch(
      `/api/hub/${hubSlug}/conversations/${thread.id}/replies`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ body: replyBody }),
      }
    );
    if (res.ok) {
      const reply = await res.json();
      const newReply: Reply = {
        id:        reply.id,
        body:      reply.body,
        bodyHtml:  renderBlockNoteHtml(reply.body),
        authorId:  reply.authorId,
        author:    currentUser,
        edited:    false,
        editedAt:  null,
        reactions: {},
        createdAt: reply.createdAt,
      };
      setThread((prev) => ({ ...prev, replies: [...prev.replies, newReply] }));
      setReplyBody("");
    }
    setSaving(false);
  }

  function startEditOp() {
    setEditingId("op");
    setEditTitle(thread.title);
    setEditBody(typeof thread.body === "string" ? thread.body : "");
  }

  function startEditReply(r: Reply) {
    setEditingId(r.id);
    setEditBody(typeof r.body === "string" ? r.body : "");
    setEditTitle("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditBody("");
    setEditTitle("");
  }

  async function saveOpEdit() {
    if (!hasContent(editBody) || !editTitle.trim()) return;
    setSavingEdit(true);
    const res = await fetch(`/api/hub/${hubSlug}/conversations/${thread.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "edit", title: editTitle.trim(), body: editBody }),
    });
    if (res.ok) {
      const updated = await res.json();
      setThread((prev) => ({
        ...prev,
        title:    updated.title,
        body:     updated.body,
        bodyHtml: renderBlockNoteHtml(updated.body),
        edited:   true,
        editedAt: updated.editedAt,
      }));
      cancelEdit();
    }
    setSavingEdit(false);
  }

  async function saveReplyEdit(replyId: string) {
    if (!hasContent(editBody)) return;
    setSavingEdit(true);
    const res = await fetch(
      `/api/hub/${hubSlug}/conversations/${thread.id}/replies/${replyId}`,
      {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ body: editBody }),
      }
    );
    if (res.ok) {
      const updated = await res.json();
      setThread((prev) => ({
        ...prev,
        replies: prev.replies.map((r) =>
          r.id === replyId
            ? { ...r, body: updated.body, bodyHtml: renderBlockNoteHtml(updated.body), edited: true, editedAt: updated.editedAt }
            : r
        ),
      }));
      cancelEdit();
    }
    setSavingEdit(false);
  }

  async function react(replyId: string, emoji: string) {
    setReactionOpenFor(null);
    const res = await fetch(
      `/api/hub/${hubSlug}/conversations/${thread.id}/replies/${replyId}/react`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ emoji }),
      }
    );
    if (res.ok) {
      const { reactions } = await res.json();
      setThread((prev) => ({
        ...prev,
        replies: prev.replies.map((r) =>
          r.id === replyId ? { ...r, reactions } : r
        ),
      }));
    }
  }

  async function setStatus(status: string) {
    setMenuOpen(false);
    const res = await fetch(`/api/hub/${hubSlug}/conversations/${thread.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    if (res.ok) setThread((prev) => ({ ...prev, status }));
  }

  async function togglePin() {
    setMenuOpen(false);
    const action = thread.isPinned ? "unpin" : "pin";
    const res = await fetch(`/api/hub/${hubSlug}/conversations/${thread.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action }),
    });
    if (res.ok) setThread((prev) => ({ ...prev, isPinned: !prev.isPinned }));
  }

  return (
    <div className="hub-conv-thread">
      {/* Back link */}
      <Link href={`/account/hub/${hubSlug}/conversations`} className="hub-conv-thread__back">
        <ArrowLeft size={15} />
        <span>Conversations</span>
      </Link>

      {/* Thread header: title + meta + coordinator menu */}
      <header className="hub-conv-thread__head">
        {editingId === "op" ? (
          <input
            className="hub-conv-thread__title-input"
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Topic title"
            autoFocus
          />
        ) : (
          <h1 className="hub-conv-thread__title">
            {thread.isPinned && <Pin size={16} className="hub-conv-thread__pin" aria-label="Pinned" />}
            <span>{thread.title}</span>
          </h1>
        )}
        {(thread.replies.length > 0 || isClosed) && (
          <div className="hub-conv-thread__head-meta">
            {thread.replies.length > 0 && (
              <span>
                {thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"}
              </span>
            )}
            {isClosed && <span className="hub-conv-thread__closed">Closed</span>}
          </div>
        )}
        {isCoordinator && editingId !== "op" && (
          <div className="hub-conv-thread__menu-wrap" ref={menuRef}>
            <button
              className="hub-conv-iconbtn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Thread actions"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="hub-conv-menu" role="menu">
                <button className="hub-conv-menu__item" onClick={togglePin} role="menuitem">
                  {thread.isPinned ? "Unpin thread" : "Pin to top"}
                </button>
                {isClosed ? (
                  <button className="hub-conv-menu__item" onClick={() => setStatus("OPEN")} role="menuitem">
                    Reopen thread
                  </button>
                ) : (
                  <button className="hub-conv-menu__item" onClick={() => setStatus("CLOSED")} role="menuitem">
                    Close thread
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Original post */}
      <article className="hub-conv-post hub-conv-post--op">
        <div
          className="hub-conv-post__avatar"
          aria-hidden="true"
          style={{ background: avatarColorFor(initialsOf(thread.author)) }}
        >
          {initialsOf(thread.author)}
        </div>
        <div className="hub-conv-post__main">
          <div className="hub-conv-post__header">
            <span className="hub-conv-post__author">{displayName(thread.author)}</span>
            <span className="hub-conv-post__dot">·</span>
            <span className="hub-conv-post__time">{relativeTime(thread.createdAt)}</span>
            {thread.edited && <span className="hub-conv-post__edited">(edited)</span>}
            {canEditOp && editingId !== "op" && (
              <button
                className="hub-conv-post__edit"
                onClick={startEditOp}
                aria-label="Edit post"
              >
                <Pencil size={13} />
                <span>Edit</span>
              </button>
            )}
          </div>
          {editingId === "op" ? (
            <div className="hub-conv-post__edit-form">
              <RimTiptapEditor
                value={editBody}
                onChange={setEditBody}
                placeholder="Edit your post…"
                variant="message"
              />
              <div className="hub-conv-post__edit-actions">
                <button className="btn--ghost" onClick={cancelEdit}>Cancel</button>
                <button
                  className="btn btn--sm"
                  onClick={saveOpEdit}
                  disabled={savingEdit || !editTitle.trim() || !hasContent(editBody)}
                >
                  {savingEdit ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          ) : (
            <div
              className="hub-conv-post__body rim-content"
              dangerouslySetInnerHTML={{ __html: thread.bodyHtml }}
            />
          )}
        </div>
      </article>

      {/* Replies */}
      {thread.replies.length > 0 && (
        <div className="hub-conv-thread__replies">
          {thread.replies.map((r) => {
            const isAuthor = r.authorId === currentUserId;
            const isEditing = editingId === r.id;
            // Reactions render with: emoji, count (number of users), and a
            // visual cue if the viewer is among the reactors. Click toggles.
            const reactions = Object.entries(r.reactions).filter(([, users]) => users.length > 0);
            const replyInits = initialsOf(r.author);
            return (
              <article key={r.id} className="hub-conv-post">
                <div
                  className="hub-conv-post__avatar"
                  aria-hidden="true"
                  style={{ background: avatarColorFor(replyInits) }}
                >
                  {replyInits}
                </div>
                <div className="hub-conv-post__main">
                  <div className="hub-conv-post__header">
                    <span className="hub-conv-post__author">{displayName(r.author)}</span>
                    {isAuthor && <span className="hub-conv-post__you">you</span>}
                    <span className="hub-conv-post__dot">·</span>
                    <span className="hub-conv-post__time">{relativeTime(r.createdAt)}</span>
                    {r.edited && <span className="hub-conv-post__edited">(edited)</span>}
                    {isAuthor && !isEditing && (
                      <button
                        className="hub-conv-post__edit"
                        onClick={() => startEditReply(r)}
                        aria-label="Edit reply"
                      >
                        <Pencil size={13} />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="hub-conv-post__edit-form">
                      <RimTiptapEditor
                        value={editBody}
                        onChange={setEditBody}
                        placeholder="Edit your reply…"
                        variant="message"
                      />
                      <div className="hub-conv-post__edit-actions">
                        <button className="btn--ghost" onClick={cancelEdit}>Cancel</button>
                        <button
                          className="btn btn--sm"
                          onClick={() => saveReplyEdit(r.id)}
                          disabled={savingEdit || !hasContent(editBody)}
                        >
                          {savingEdit ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className="hub-conv-post__body rim-content"
                        dangerouslySetInnerHTML={{ __html: r.bodyHtml }}
                      />
                      <div className="hub-conv-post__footer">
                        {reactions.length > 0 && (
                          <div className="hub-conv-post__reactions">
                            {reactions.map(([emoji, users]) => {
                              const youReacted = users.includes(currentUserId);
                              return (
                                <button
                                  key={emoji}
                                  className={`hub-conv-reaction${youReacted ? " hub-conv-reaction--mine" : ""}`}
                                  onClick={() => react(r.id, emoji)}
                                  aria-pressed={youReacted}
                                  aria-label={
                                    youReacted
                                      ? `Remove your ${emoji} reaction`
                                      : `Add ${emoji} reaction`
                                  }
                                >
                                  <span>{emoji}</span>
                                  <span className="hub-conv-reaction__count">{users.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <div className="hub-conv-post__react-wrap">
                          <button
                            className="hub-conv-post__react-btn"
                            onClick={() => setReactionOpenFor(reactionOpenFor === r.id ? null : r.id)}
                            aria-label="Add reaction"
                            aria-expanded={reactionOpenFor === r.id}
                          >
                            <SmilePlus size={15} />
                          </button>
                          {reactionOpenFor === r.id && (
                            <div className="hub-conv-react-pop" role="menu">
                              {ALLOWED_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  className="hub-conv-react-pop__btn"
                                  onClick={() => react(r.id, emoji)}
                                  aria-label={`React with ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Reply composer */}
      {!isClosed ? (
        <div className="hub-conv-replybox">
          <div
            className="hub-conv-replybox__avatar"
            aria-hidden="true"
            style={{ background: avatarColorFor(initialsOf(currentUser)) }}
          >
            {initialsOf(currentUser)}
          </div>
          <div className="hub-conv-replybox__main">
            <RimTiptapEditor
              value={replyBody}
              onChange={setReplyBody}
              placeholder="Write a reply…"
              variant="message"
            />
            <div className="hub-conv-replybox__actions">
              <button
                className="btn"
                onClick={postReply}
                disabled={saving || !hasContent(replyBody)}
              >
                {saving ? "Posting…" : "Post reply"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="hub-conv-thread__closed-note">
          This conversation is closed — no new replies can be added.
        </p>
      )}
    </div>
  );
}
