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

import { useState } from "react";
import { relativeDate } from "@/lib/relativeDate";

const REACTIONS = ["👍", "❤️", "🙏", "💡", "😊"] as const;
const GENERIC_ERROR = "Something went wrong. Please try again.";

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
}

export default function FileConversation({
  fileId,
  viewerId,
  canModerate,
  initialComments,
}: Props) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/${fileId}/conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? GENERIC_ERROR);
        return;
      }
      setComments(data.comments ?? []);
      setDraft("");
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/files/${fileId}/conversation/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? GENERIC_ERROR);
        return;
      }
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError(GENERIC_ERROR);
    }
  }

  async function react(id: string, emoji: string) {
    // Optimistic-free: apply the server's authoritative reaction map on return.
    try {
      const res = await fetch(`/api/files/${fileId}/conversation/${id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? GENERIC_ERROR);
        return;
      }
      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, reactions: data.reactions ?? {} } : c)),
      );
    } catch {
      setError(GENERIC_ERROR);
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
              <li key={c.id} className="gf-comment">
                <div className="gf-comment__head">
                  <span className="gf-comment__author">{c.authorName}</span>
                  <span className="gf-comment__time">{relativeDate(c.createdAt)}</span>
                  {canDelete && (
                    <button
                      className="gf-comment__delete"
                      onClick={() => remove(c.id)}
                      aria-label="Delete comment"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="gf-comment__body">{c.body}</p>
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
          placeholder="Add a comment…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") post();
          }}
          rows={3}
          disabled={busy}
        />
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
