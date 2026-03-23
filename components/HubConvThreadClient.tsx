"use client";

/**
 * HubConvThreadClient — Thread detail + replies for generic hubs.
 * CSS prefix: cv- (shared with conversation list)
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Check if JSON has meaningful content — handles both Tiptap and BlockNote JSON */
function hasContent(json: any): boolean {
  if (!json) return false;
  // BlockNote JSON: array of blocks
  if (Array.isArray(json)) return json.some((b: any) => b.content?.some((c: any) => c.text?.trim()));
  // Tiptap JSON: traverse content tree
  function extractText(node: any): string {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (node.text) return node.text;
    if (node.content) return node.content.map(extractText).join(" ");
    return "";
  }
  return extractText(json).trim().length > 0;
}

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
        id:       reply.id,
        body:     reply.body,
        bodyHtml: renderBlockNoteHtml(reply.body),
        authorId: reply.authorId,
        author: {
          firstName:     null,
          lastName:      null,
          preferredName: currentUserName,
        },
        createdAt: reply.createdAt,
      };
      setThread((prev) => ({ ...prev, replies: [...prev.replies, newReply] }));
      setReplyBody(null);
    }
    setSaving(false);
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

  return (
    <div style={{ maxWidth: 680 }}>

      {/* Back link */}
      <div className="cv-back">
        <Link href={`/account/hub/${hubSlug}/conversations`} className="cv-back__link">
          ← Conversations
        </Link>
      </div>

      {/* Thread header */}
      <div className="cv-thread-hdr">
        <div className="cv-thread-hdr__title">
          {thread.isPinned && <span className="hub-conv__pin-badge">‼️</span>}
          {thread.title}
        </div>
        <div className="cv-thread-hdr__meta">
          {fmtDate(thread.createdAt)} · {displayName(thread.author)}
          {isClosed && <span className="cv-status-badge cv-status-badge--closed"> · Closed</span>}
        </div>
        {isCoordinator && (
          <div className="cv-thread-hdr__actions">
            <button className="ann-btn" onClick={togglePin}>
              {thread.isPinned ? "Unpin" : "Pin this thread ‼️"}
            </button>
            {isClosed ? (
              <button className="ann-btn" onClick={() => setStatus("OPEN")}>Reopen</button>
            ) : (
              <button className="ann-btn" onClick={() => setStatus("CLOSED")}>Close thread</button>
            )}
          </div>
        )}
      </div>

      {/* Original post body */}
      <div className="cv-post cv-post--op">
        <div
          className="cv-post__body"
          dangerouslySetInnerHTML={{ __html: thread.bodyHtml }}
        />
      </div>

      {/* Replies */}
      {thread.replies.length > 0 && (
        <div className="cv-replies">
          {thread.replies.map((r) => (
            <div key={r.id} className={`cv-post${r.authorId === currentUserId ? " cv-post--mine" : ""}`}>
              <div className="cv-post__author">
                {displayName(r.author)}
                {r.authorId === currentUserId && <em className="cv-post__you"> (you)</em>}
              </div>
              <div
                className="cv-post__body"
                dangerouslySetInnerHTML={{ __html: r.bodyHtml }}
              />
              <div className="cv-post__date">{fmtDate(r.createdAt)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Reply form */}
      {!isClosed ? (
        <div className="cv-reply-form">
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
        <p className="cv-closed-note">This conversation is closed. No new replies.</p>
      )}
    </div>
  );
}
