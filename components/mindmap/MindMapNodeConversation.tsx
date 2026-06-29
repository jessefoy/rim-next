"use client";

/**
 * MindMapNodeConversation — the per-topic conversation in the editor side panel
 * (Slice 3). One thread per node; comments are plain text. Reuses RIM's
 * conversation tables behind map-scoped routes. Anyone who can see the map can
 * comment; the canvas's edit gate is separate.
 */

import { useCallback, useEffect, useState } from "react";
import { relativeDate } from "@/lib/relativeDate";

const EMOJIS = ["👍", "❤️", "🙏", "💡", "😊"];

interface Comment {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  reactions: Record<string, string[]>;
}

interface Props {
  mapId: string;
  nodeId: string;
  currentUserId: string;
  /** Persist any pending canvas edits so a brand-new node exists before its first comment. */
  flushSave: () => Promise<void>;
}

export default function MindMapNodeConversation({ mapId, nodeId, currentUserId, flushSave }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [hasHub, setHasHub] = useState(true);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [paletteFor, setPaletteFor] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/mindmaps/${mapId}/nodes/${nodeId}/conversation`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        setComments(data.comments ?? []);
        setSubscribed(!!data.currentUserSubscribed);
        setHasHub(!!data.hasHub);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [mapId, nodeId]);

  const post = useCallback(
    (value: string) =>
      fetch(`/api/mindmaps/${mapId}/nodes/${nodeId}/conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: value }),
      }),
    [mapId, nodeId],
  );

  async function submit() {
    const value = text.trim();
    if (!value || posting) return;
    setPosting(true);
    try {
      await flushSave(); // ensure the node is persisted
      let res = await post(value);
      if (res.status === 409) { await flushSave(); res = await post(value); }
      if (!res.ok) throw new Error();
      const comment: Comment = await res.json();
      setComments((c) => [...c, comment]);
      setText("");
      setSubscribed(true);
    } catch {
      /* leave the text in place so nothing is lost */
    } finally {
      setPosting(false);
    }
  }

  async function toggleFollow() {
    const method = subscribed ? "DELETE" : "POST";
    const res = await fetch(`/api/mindmaps/${mapId}/nodes/${nodeId}/follow`, { method });
    if (res.ok) setSubscribed((s) => !s);
  }

  async function toggleReaction(commentId: string, emoji: string) {
    setPaletteFor(null);
    const res = await fetch(`/api/mindmaps/${mapId}/comments/${commentId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (res.ok) {
      const { reactions } = await res.json();
      setComments((c) => c.map((x) => (x.id === commentId ? { ...x, reactions } : x)));
    }
  }

  return (
    <div className="mm-convo">
      <div className="mm-convo__head">
        <span className="mm-convo__title">Conversation</span>
        {comments.length > 0 && (
          <button className="mm-convo__follow" onClick={toggleFollow}>
            {subscribed ? "Following" : "Follow"}
          </button>
        )}
      </div>

      {!hasHub ? (
        <p className="mm-panel__note">Place this map in a hub (Share →) to start conversations on its topics.</p>
      ) : (
        <>
          {loading ? (
            <p className="mm-convo__empty">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="mm-convo__empty">No comments yet. Start the conversation on this topic.</p>
          ) : (
            <ul className="mm-convo__list">
              {comments.map((c) => (
                <li key={c.id} className="mm-convo__item">
                  <div className="mm-convo__meta">
                    <span className="mm-convo__author">{c.authorName}</span>
                    <span className="mm-convo__when">{relativeDate(c.createdAt)}</span>
                  </div>
                  <p className="mm-convo__body">{c.body}</p>
                  <div className="mm-convo__reactions">
                    {EMOJIS.filter((e) => (c.reactions[e]?.length ?? 0) > 0).map((e) => {
                      const ids = c.reactions[e] ?? [];
                      return (
                        <button
                          key={e}
                          className={`mm-react${ids.includes(currentUserId) ? " is-mine" : ""}`}
                          onClick={() => toggleReaction(c.id, e)}
                        >
                          {e} {ids.length}
                        </button>
                      );
                    })}
                    {paletteFor === c.id ? (
                      <span className="mm-react-palette">
                        {EMOJIS.map((e) => (
                          <button key={e} className="mm-react mm-react--pick" onClick={() => toggleReaction(c.id, e)}>{e}</button>
                        ))}
                      </span>
                    ) : (
                      <button className="mm-react mm-react--add" onClick={() => setPaletteFor(c.id)} aria-label="Add reaction">+</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mm-convo__compose">
            <textarea
              className="mm-convo__input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment…"
              rows={2}
            />
            <button className="mm-btn" onClick={submit} disabled={posting || !text.trim()}>
              {posting ? "Posting…" : "Comment"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
