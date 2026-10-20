/**
 * The conversation on a file's detail page (RIM_GoogleWorkspace.md, file-detail
 * slice). A single flat discussion anchored to the Google file: plain-text
 * comments, five-emoji reactions, delete-your-own (coordinators/GT/ADMIN can
 * moderate). The server passes the initial comments so there's no load flash;
 * this component owns them afterward and reconciles from each mutation's
 * response (post returns the full list, react returns the comment's reactions,
 * delete removes locally) rather than refetching the whole detail page.
 *
 * CSS prefix: gf-conv-
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useHashArrival } from "@/components/hooks/useHashArrival";
import { relativeDate } from "@/lib/relativeDate";
import NotifyPicker, { type NotifyValue, NOTIFY_NONE } from "@/components/NotifyPicker";

const REACTIONS = ["👍", "❤️", "🙏", "💡", "😊"] as const;
const GENERIC_ERROR = "Something went wrong. Please try again.";

/** A plain answer for a refused request: sign-in, permission and missing
    things in people's words; the server's own reason only when it is a
    sentence written for people; otherwise the kind fallback. */
function readableError(status: number, serverError: unknown, fallback: string): string {
  if (status === 401) return "You\u2019ve been signed out. Sign in again, then try once more.";
  if (status === 404) return "That isn\u2019t here any more. Refresh the page.";
  // Keep the server's words only when they are a sentence written for people
  // (several words, ending in a full stop), never a code like "Hub not found".
  const text = typeof serverError === "string" ? serverError.trim() : "";
  if (/\s/.test(text) && /[.?!]$/.test(text) && !/\b(hubs?|spaces?)\b/i.test(text)) return text;
  // A refusal says why when the server wrote it for people ("Open this from
  // within RIM."); otherwise plainly.
  if (status === 403) return "You don\u2019t have permission to do that here.";
  return fallback;
}

interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  reactions: Record<string, string[]>;
}

interface Props {
  fileId: string;
  viewerId: string;
  /** May the viewer delete other people's comments (coordinator/GT/ADMIN)? */
  canModerate: boolean;
  initialComments: Comment[];
  /** The Space's members, for the "Notify → Choose people" picker. */
  members: { id: string; name: string }[];
  /** In the team's Leads only area: notify reaches the leads alone. */
  leadsOnly?: boolean;
}

export default function FileConversation({
  fileId,
  viewerId,
  canModerate,
  initialComments,
  members,
  leadsOnly = false,
}: Props) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  // An Updates link can open the file at one comment (#comment-…).
  useHashArrival();
  const [draft, setDraft] = useState("");
  const [notify, setNotify] = useState<NotifyValue>(NOTIFY_NONE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Deleting a comment asks first, in the comment itself; a problem with a
  // comment (delete, reaction) is said beside it, not down at the compose box.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [commentError, setCommentError] = useState<{ id: string; msg: string } | null>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmDeleteId) cancelDeleteRef.current?.focus();
  }, [confirmDeleteId]);

  async function post() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/${fileId}/conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, notify }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(readableError(res.status, data.error, GENERIC_ERROR));
        return;
      }
      setComments(data.comments ?? []);
      setDraft("");
      setNotify(NOTIFY_NONE);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (deleting) return;
    setDeleting(true);
    setCommentError(null);
    try {
      const res = await fetch(`/api/files/${fileId}/conversation/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCommentError({ id, msg: readableError(res.status, data.error, "This comment was not deleted. Please try again.") });
        return;
      }
      setComments((prev) => prev.filter((c) => c.id !== id));
      setConfirmDeleteId(null);
    } catch {
      setCommentError({ id, msg: "This comment was not deleted. Please check your connection and try again." });
    } finally {
      setDeleting(false);
    }
  }

  async function react(id: string, emoji: string) {
    // Optimistic-free: apply the server's authoritative reaction map on return.
    setCommentError(null);
    try {
      const res = await fetch(`/api/files/${fileId}/conversation/${id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCommentError({ id, msg: readableError(res.status, data.error, GENERIC_ERROR) });
        return;
      }
      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, reactions: data.reactions ?? {} } : c)),
      );
    } catch {
      setCommentError({ id, msg: GENERIC_ERROR });
    }
  }

  return (
    <section className="gf-conv" aria-label="Conversation">
      <h2 className="gf-conv__title">Conversation</h2>

      {comments.length === 0 ? (
        <p className="gf-conv__empty">No comments yet. Start the conversation about this file.</p>
      ) : (
        <ul className="gf-conv__list">
          {comments.map((c) => {
            const canDelete = c.authorId === viewerId || canModerate;
            return (
              <li key={c.id} id={`comment-${c.id}`} tabIndex={-1} className="gf-comment">
                <div className="gf-comment__head">
                  <span className="gf-comment__author">{c.authorName}</span>
                  <span className="gf-comment__time">{relativeDate(c.createdAt)}</span>
                  {canDelete && confirmDeleteId !== c.id && (
                    <button
                      className="gf-comment__delete"
                      onClick={() => { setConfirmDeleteId(c.id); setCommentError(null); }}
                      aria-label="Delete comment"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="gf-comment__body">{c.body}</p>
                {confirmDeleteId === c.id && (
                  <div role="group" aria-labelledby={`gf-del-${c.id}`}>
                    <p className="gf-comment__body" id={`gf-del-${c.id}`}>
                      {c.authorId === viewerId
                        ? "Delete your comment? This can\u2019t be undone."
                        : `Delete ${c.authorName}\u2019s comment? This can\u2019t be undone.`}
                    </p>
                    <div className="gf-detail__actions">
                      <button
                        ref={cancelDeleteRef}
                        className="gf-detail__btn gf-detail__btn--ghost"
                        onClick={() => { setConfirmDeleteId(null); setCommentError(null); }}
                        disabled={deleting}
                      >
                        Cancel
                      </button>
                      <button
                        className="gf-detail__btn gf-detail__btn--danger"
                        onClick={() => remove(c.id)}
                        disabled={deleting}
                      >
                        {deleting ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
                {commentError?.id === c.id && (
                  <p className="gf-detail__error" role="alert">{commentError.msg}</p>
                )}
                <div className="gf-comment__reactions">
                  {REACTIONS.map((emoji) => {
                    const who = c.reactions[emoji] ?? [];
                    const mine = who.includes(viewerId);
                    return (
                      <button
                        key={emoji}
                        className={`gf-react${mine ? " gf-react--mine" : ""}`}
                        onClick={() => react(c.id, emoji)}
                        aria-pressed={mine}
                        aria-label={`React ${emoji}${who.length ? ` (${who.length})` : ""}`}
                      >
                        <span aria-hidden="true">{emoji}</span>
                        {who.length > 0 && <span className="gf-react__count">{who.length}</span>}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="gf-conv__compose">
        <textarea
          className="gf-conv__input"
          aria-label="Add a comment"
          placeholder="Add a comment…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") post();
          }}
          rows={3}
          disabled={busy}
        />
        <NotifyPicker members={members} value={notify} onChange={setNotify} disabled={busy} leadsOnly={leadsOnly} />
        <div className="gf-conv__compose-actions">
          {error && (
            <span className="gf-conv__error" role="alert">
              {error}
            </span>
          )}
          <button
            className="gf-conv__post"
            onClick={post}
            disabled={busy || !draft.trim()}
          >
            {busy ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </section>
  );
}
