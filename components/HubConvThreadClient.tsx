"use client";

/**
 * HubConvThreadClient — Thread detail + replies for generic hubs.
 * CSS prefix: cv- (shared with conversation list)
 */

import { useState } from "react";
import Link from "next/link";
import FormattedEditor from "./FormattedEditor";
import { renderFormattedText } from "@/lib/renderRichContent";

interface PersonName {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
}

interface Reply {
  id: string;
  body: any; // Tiptap JSON
  authorId: string;
  author: PersonName;
  createdAt: string;
}

interface Thread {
  id: string;
  title: string;
  body: any; // Tiptap JSON
  status: string;
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
        <div className="cv-thread-hdr__title">{thread.title}</div>
        <div className="cv-thread-hdr__meta">
          {fmtDate(thread.createdAt)} · {displayName(thread.author)}
          {isClosed && <span className="cv-status-badge cv-status-badge--closed"> · Closed</span>}
        </div>
        {isCoordinator && (
          <div className="cv-thread-hdr__actions">
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
          dangerouslySetInnerHTML={{ __html: renderFormattedText(thread.body) }}
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
                dangerouslySetInnerHTML={{ __html: renderFormattedText(r.body) }}
              />
              <div className="cv-post__date">{fmtDate(r.createdAt)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Reply form */}
      {!isClosed ? (
        <div className="cv-reply-form">
          <FormattedEditor
            value={replyBody}
            onChange={setReplyBody}
            placeholder="Add a reply…"
            minHeight={120}
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
