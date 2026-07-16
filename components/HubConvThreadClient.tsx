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

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Pin, Pencil, MoreHorizontal, SmilePlus, Bell, BellOff, Users } from "lucide-react";
import dynamic from "next/dynamic";
const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div style={{ minHeight: 80 }} /> },
);
import { renderBlockNoteHtml } from "@/lib/renderRichContent";
import { avatarColorFor } from "@/lib/avatarColor";
import HubDocNotifyPanel, { type NotifyMember } from "@/components/HubDocNotifyPanel";

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

interface Subscription {
  userId: string;
  source: string; // AUTHOR | COORDINATOR_AUTO | ADDED | SELF
  subscribedAt: string;
}

interface Props {
  hubSlug: string;
  initialThread: Thread;
  isCoordinator: boolean;
  currentUserId: string;
  currentUser: PersonName;
  hubMembers: NotifyMember[];
  initialSubscriptions: Subscription[];
  initialCurrentUserSubscribed: boolean;
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
  hubMembers,
  initialSubscriptions,
  initialCurrentUserSubscribed,
}: Props) {
  const [thread, setThread] = useState<Thread>(initialThread);
  const [replyBody, setReplyBody] = useState<string>("");
  // Bumped after a successful post to remount the reply editor empty (Tiptap
  // keeps its initial content otherwise). Plus a synchronous in-flight guard
  // and an inline error — together they kill the double-post (session 141).
  const [replyEditorKey, setReplyEditorKey] = useState(0);
  const [replyError, setReplyError] = useState<string | null>(null);
  const sendingReplyRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(initialSubscriptions);
  const [currentUserSubscribed, setCurrentUserSubscribed] = useState(initialCurrentUserSubscribed);
  const [followBusy, setFollowBusy] = useState(false);
  const [replyNotifyIds, setReplyNotifyIds] = useState<string[]>([]);
  const [notifyExpanded, setNotifyExpanded] = useState(false);

  // userId → subscribedAt (ISO) — fed to the notify panel as notifiedMap so
  // already-subscribed members appear disabled with a timestamp.
  const subscribedMap: Record<string, string> = {};
  for (const s of subscriptions) subscribedMap[s.userId] = s.subscribedAt;

  async function toggleFollow() {
    setFollowBusy(true);
    const willSubscribe = !currentUserSubscribed;
    const res = await fetch(
      `/api/hub/${hubSlug}/conversations/${thread.id}/subscribe`,
      { method: willSubscribe ? "POST" : "DELETE" }
    );
    if (res.ok) {
      setCurrentUserSubscribed(willSubscribe);
      if (willSubscribe) {
        setSubscriptions((prev) =>
          prev.some((s) => s.userId === currentUserId)
            ? prev
            : [...prev, { userId: currentUserId, source: "SELF", subscribedAt: new Date().toISOString() }]
        );
      } else {
        setSubscriptions((prev) => prev.filter((s) => s.userId !== currentUserId));
      }
    }
    setFollowBusy(false);
  }

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
  // Which reply's "who reacted" list is expanded — a tap-to-reveal that works
  // on mobile where the hover tooltip doesn't. One open at a time.
  const [whoOpenFor, setWhoOpenFor] = useState<string | null>(null);

  const isClosed = thread.status !== "OPEN";
  const canEditOp = thread.authorId === currentUserId || isCoordinator;

  // Resolve reaction author IDs to names so reactions aren't anonymous — a
  // bare count hides who is acknowledging whom (session 141; "a community
  // isn't anonymous"). hubMembers covers the team, currentUser covers "you",
  // and anyone no longer in the hub falls back to "Someone".
  const reactorNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of hubMembers) m.set(mem.id, displayName(mem));
    m.set(currentUserId, displayName(currentUser));
    return m;
  }, [hubMembers, currentUserId, currentUser]);

  function reactorNames(userIds: string[]): string {
    const names = userIds.map((id) =>
      id === currentUserId ? "You" : (reactorNameById.get(id) ?? "Someone"),
    );
    names.sort((a, b) => (a === "You" ? -1 : b === "You" ? 1 : 0)); // "You" first
    if (names.length === 0) return "";
    if (names.length === 1) return names[0];
    if (names.length <= 4) return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    return `${names.slice(0, 3).join(", ")} and ${names.length - 3} others`;
  }

  async function postReply() {
    // Synchronous guard: the disabled attribute updates on the next render, so
    // a fast second click (or a click after a post that "looked" unsent) can
    // slip through before then. The ref stops that immediately.
    if (!hasContent(replyBody) || sendingReplyRef.current) return;
    sendingReplyRef.current = true;
    setSaving(true);
    setReplyError(null);
    try {
      const res = await fetch(
        `/api/hub/${hubSlug}/conversations/${thread.id}/replies`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ body: replyBody, notifyUserIds: replyNotifyIds }),
        }
      );
      if (!res.ok) throw new Error("post failed");
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
      // Update local subscriptions: replier is auto-subscribed; any picked
      // members are now subscribed. Mirrors what the server just did.
      const nowIso = new Date().toISOString();
      setSubscriptions((prev) => {
        const seen = new Set(prev.map((s) => s.userId));
        const additions: Subscription[] = [];
        if (!seen.has(currentUserId)) {
          additions.push({ userId: currentUserId, source: "ADDED", subscribedAt: nowIso });
          seen.add(currentUserId);
        }
        for (const uid of replyNotifyIds) {
          if (!seen.has(uid)) {
            additions.push({ userId: uid, source: "ADDED", subscribedAt: nowIso });
            seen.add(uid);
          }
        }
        return additions.length > 0 ? [...prev, ...additions] : prev;
      });
      if (!currentUserSubscribed) setCurrentUserSubscribed(true);
      setReplyBody("");
      setReplyNotifyIds([]);
      setNotifyExpanded(false);
      // Remount the editor so it actually clears — Tiptap keeps its initial
      // content otherwise, which made a successful post look unsent and
      // invited a duplicate submit.
      setReplyEditorKey((k) => k + 1);
    } catch {
      setReplyError("Your reply didn't post. Please try again.");
    } finally {
      setSaving(false);
      sendingReplyRef.current = false;
    }
  }

  async function deleteReply(replyId: string) {
    if (!window.confirm("Delete this reply? This can't be undone.")) return;
    const res = await fetch(
      `/api/hub/${hubSlug}/conversations/${thread.id}/replies/${replyId}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setThread((prev) => ({ ...prev, replies: prev.replies.filter((r) => r.id !== replyId) }));
    } else {
      setReplyError("Couldn't delete that reply. Please try again.");
    }
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

  async function softDeleteThread() {
    setMenuOpen(false);
    if (!window.confirm("Delete this archived thread? It will move to the trash, where admins or coordinators can restore or permanently delete it.")) return;
    const res = await fetch(`/api/hub/${hubSlug}/conversations/${thread.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      // Navigate back to the list — the thread is no longer visible to this user.
      window.location.href = `/account/hub/${hubSlug}/conversations`;
    }
  }

  return (
    <div className="hub-conv-thread">
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
        <div className="hub-conv-thread__head-meta">
          {thread.replies.length > 0 && (
            <span>
              {thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"}
            </span>
          )}
          {isClosed && <span className="hub-conv-thread__closed">Archived</span>}
          <button
            type="button"
            className={`hub-conv-thread__follow${currentUserSubscribed ? " hub-conv-thread__follow--on" : ""}`}
            onClick={toggleFollow}
            disabled={followBusy}
            aria-pressed={currentUserSubscribed}
            title={currentUserSubscribed ? "You're getting reply emails" : "Get an email for every reply"}
          >
            {currentUserSubscribed ? <Bell size={13} /> : <BellOff size={13} />}
            <span>{currentUserSubscribed ? "Following" : "Follow"}</span>
          </button>
        </div>
        {(isCoordinator || canEditOp) && editingId !== "op" && (
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
                {isCoordinator && (
                  <button className="hub-conv-menu__item" onClick={togglePin} role="menuitem">
                    {thread.isPinned ? "Unpin thread" : "Pin to top"}
                  </button>
                )}
                {canEditOp && (
                  isClosed ? (
                    <button className="hub-conv-menu__item" onClick={() => setStatus("OPEN")} role="menuitem">
                      Unarchive thread
                    </button>
                  ) : (
                    <button className="hub-conv-menu__item" onClick={() => setStatus("CLOSED")} role="menuitem">
                      Archive thread
                    </button>
                  )
                )}
                {/* Delete only appears on archived threads — three-stage flow:
                    Active → Archived → Trash (manager review). */}
                {canEditOp && isClosed && (
                  <button
                    className="hub-conv-menu__item hub-conv-menu__item--danger"
                    onClick={softDeleteThread}
                    role="menuitem"
                  >
                    Delete
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
                    {(isAuthor || isCoordinator) && !isEditing && (
                      <button
                        className="hub-conv-post__delete"
                        onClick={() => deleteReply(r.id)}
                        aria-label="Delete reply"
                      >
                        <span>Delete</span>
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
                              const who = reactorNames(users);
                              return (
                                <button
                                  key={emoji}
                                  className={`hub-conv-reaction${youReacted ? " hub-conv-reaction--mine" : ""}`}
                                  onClick={() => react(r.id, emoji)}
                                  aria-pressed={youReacted}
                                  title={who}
                                  aria-label={`${emoji} reaction from ${who} — ${youReacted ? "tap to remove yours" : "tap to add yours"}`}
                                >
                                  <span>{emoji}</span>
                                  <span className="hub-conv-reaction__count">{users.length}</span>
                                </button>
                              );
                            })}
                            <button
                              className="hub-conv-reaction-who"
                              onClick={() => setWhoOpenFor(whoOpenFor === r.id ? null : r.id)}
                              aria-expanded={whoOpenFor === r.id}
                              aria-label={whoOpenFor === r.id ? "Hide who reacted" : "Show who reacted"}
                            >
                              <Users size={13} />
                            </button>
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
                        {whoOpenFor === r.id && reactions.length > 0 && (
                          <div className="hub-conv-reactors">
                            {reactions.map(([emoji, users]) => (
                              <div key={emoji} className="hub-conv-reactors__row">
                                <span className="hub-conv-reactors__emoji" aria-hidden="true">{emoji}</span>
                                <span className="hub-conv-reactors__names">{reactorNames(users)}</span>
                              </div>
                            ))}
                          </div>
                        )}
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
              key={replyEditorKey}
              value={replyBody}
              onChange={setReplyBody}
              placeholder="Write a reply…"
              variant="message"
            />
            {notifyExpanded ? (
              <HubDocNotifyPanel
                members={hubMembers}
                selectedIds={replyNotifyIds}
                onChange={setReplyNotifyIds}
                notifiedMap={subscribedMap}
              />
            ) : (
              <button
                type="button"
                className="hub-conv-replybox__notify-toggle"
                onClick={() => setNotifyExpanded(true)}
              >
                + Notify someone new…
              </button>
            )}
            {replyError && <p className="hub-conv-replybox__error">{replyError}</p>}
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
          This conversation is archived — no new replies can be added.
        </p>
      )}
    </div>
  );
}
