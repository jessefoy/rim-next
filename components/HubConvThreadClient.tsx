"use client";

/**
 * HubConvThreadClient — Thread detail + replies for all hubs.
 * CSS prefix: hub-conv- (shared with conversation list)
 */

import { useState } from "react";
import Link from "next/link";
import RimProseEditor from "@/components/RimProseEditor";
import { renderBlockNoteHtml } from "@/lib/renderRichContent";

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
  reactions: Record<string, number>;
  createdAt: string;
}

interface Thread {
  id: string;
  title: string;
  body: any;
  bodyHtml: string;
  status: string;
  isPinned: boolean;
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
  currentUserName: string;
}

function displayName(u: PersonName) {
  return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown";
}

function relativeTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 2) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMs / 3600000);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Check if JSON has meaningful content — handles both Tiptap and BlockNote JSON */
function hasContent(json: any): boolean {
  if (!json) return false;
  if (Array.isArray(json)) return json.some((b: any) => b.content?.some((c: any) => c.text?.trim()));
  function extractText(node: any): string {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (node.text) return node.text;
    if (node.content) return node.content.map(extractText).join(" ");
    return "";
  }
  return extractText(json).trim().length > 0;
}

const ALLOWED_EMOJIS = ["👍", "❤️", "🙏", "💡", "😊"] as const;

export default function HubConvThreadClient({
  hubSlug,
  initialThread,
  isCoordinator,
  currentUserId,
  currentUserName,
}: Props) {
  const [thread, setThread] = useState<Thread>(initialThread);
  const [replyBody, setReplyBody] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState<any>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const isClosed = thread.status !== "OPEN";

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
        author: {
          firstName:     null,
          lastName:      null,
          preferredName: currentUserName,
        },
        edited:    false,
        editedAt:  null,
        reactions: {},
        createdAt: reply.createdAt,
      };
      setThread((prev) => ({ ...prev, replies: [...prev.replies, newReply] }));
      setReplyBody(null);
    }
    setSaving(false);
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
      setEditingReplyId(null);
      setEditBody(null);
    }
    setSavingEdit(false);
  }

  async function react(replyId: string, emoji: string) {
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
    const res = await fetch(`/api/hub/${hubSlug}/conversations/${thread.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    if (res.ok) {
      setThread((prev) => ({ ...prev, status }));
    }
  }

  async function togglePin() {
    const action = thread.isPinned ? "unpin" : "pin";
    const res = await fetch(`/api/hub/${hubSlug}/conversations/${thread.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action }),
    });
    if (res.ok) {
      setThread((prev) => ({ ...prev, isPinned: !prev.isPinned }));
    }
  }

  function startEdit(reply: Reply) {
    setEditingReplyId(reply.id);
    setEditBody(reply.body);
  }

  return (
    <div className="hub-conv-container">

      {/* Back link */}
      <div className="hub-conv-back">
        <Link href={`/account/hub/${hubSlug}/conversations`} className="hub-conv-back__link">
          ← Conversations
        </Link>
      </div>

      {/* Thread header */}
      <div className="hub-conv-thread-hdr">
        <div className="hub-conv-thread-hdr__title">
          {thread.isPinned && <span className="hub-conv-pin-badge">📌</span>}
          {thread.title}
        </div>
        <div className="hub-conv-thread-hdr__meta">
          {relativeTime(thread.createdAt)} · {displayName(thread.author)}
          {isClosed && <span className="hub-conv-status-badge hub-conv-status-badge--closed"> · Closed</span>}
        </div>
        {isCoordinator && (
          <div className="hub-conv-thread-hdr__actions">
            <button className="hub-action-btn" onClick={togglePin}>
              {thread.isPinned ? "Unpin" : "Pin this thread 📌"}
            </button>
            {isClosed ? (
              <button className="hub-action-btn" onClick={() => setStatus("OPEN")}>Reopen</button>
            ) : (
              <button className="hub-action-btn" onClick={() => setStatus("CLOSED")}>Close thread</button>
            )}
          </div>
        )}
      </div>

      {/* Original post body */}
      <div className="hub-conv-post hub-conv-post--op">
        <div
          className="hub-conv-post__body"
          dangerouslySetInnerHTML={{ __html: thread.bodyHtml }}
        />
      </div>

      {/* Replies */}
      {thread.replies.length > 0 && (
        <div className="hub-conv-replies">
          {thread.replies.map((r) => (
            <div key={r.id} className={`hub-conv-post${r.authorId === currentUserId ? " hub-conv-post--mine" : ""}`}>
              <div className="hub-conv-post__author">
                {displayName(r.author)}
                {r.authorId === currentUserId && <em className="hub-conv-post__you"> (you)</em>}
                {r.edited && <span className="hub-conv-post__edited"> · edited</span>}
              </div>

              {editingReplyId === r.id ? (
                <div className="hub-conv-post__edit-form">
                  <RimProseEditor
                    value={editBody}
                    onChange={setEditBody}
                    placeholder="Edit your reply…"
                    variant="compact"
                  />
                  <div className="form-actions" style={{ justifyContent: "flex-end", gap: 8 }}>
                    <button className="btn--ghost" onClick={() => { setEditingReplyId(null); setEditBody(null); }}>
                      Cancel
                    </button>
                    <button className="btn btn--sm" onClick={() => saveReplyEdit(r.id)} disabled={savingEdit}>
                      {savingEdit ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="hub-conv-post__body"
                    dangerouslySetInnerHTML={{ __html: r.bodyHtml }}
                  />
                  <div className="hub-conv-post__footer">
                    <span className="hub-conv-post__date">{relativeTime(r.createdAt)}</span>

                    {/* Reactions display */}
                    {Object.entries(r.reactions).filter(([, count]) => count > 0).length > 0 && (
                      <span className="hub-conv-reactions">
                        {Object.entries(r.reactions).filter(([, count]) => count > 0).map(([emoji, count]) => (
                          <button
                            key={emoji}
                            className="hub-conv-reaction"
                            onClick={() => react(r.id, emoji)}
                          >
                            {emoji} {count}
                          </button>
                        ))}
                      </span>
                    )}

                    {/* Actions */}
                    <span className="hub-conv-post__actions">
                      {ALLOWED_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          className="hub-conv-reaction-btn"
                          onClick={() => react(r.id, emoji)}
                          title={`React with ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                      {r.authorId === currentUserId && (
                        <button className="hub-conv-edit-btn" onClick={() => startEdit(r)}>
                          Edit
                        </button>
                      )}
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply form */}
      {!isClosed ? (
        <div className="hub-conv-reply-form">
          <RimProseEditor
            value={replyBody}
            onChange={setReplyBody}
            placeholder="Add a reply…"
            variant="compact"
          />
          <div className="form-actions" style={{ justifyContent: "flex-end" }}>
            <button
              className="btn"
              onClick={postReply}
              disabled={saving || !hasContent(replyBody)}
            >
              {saving ? "Posting…" : "Reply"}
            </button>
          </div>
        </div>
      ) : (
        <p className="hub-conv-closed-note">This conversation is closed. No new replies.</p>
      )}
    </div>
  );
}
