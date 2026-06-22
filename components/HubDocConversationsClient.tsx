"use client";

/**
 * HubDocConversationsClient — Comments panel on a document view page.
 * CSS prefix: doc-conv-
 *
 * The document is the subject, so there's no separate topic title — you just
 * add a comment. We derive a short heading from the comment's first line so the
 * shared thread/list/detail surfaces (which key off `title`) keep working
 * without a schema change. Clicking a comment opens the shared thread detail
 * page which shows "← Back to [Document]"; replies live there.
 */

import { useState, useRef } from "react";
import Link from "next/link";
import { MessageSquare, Plus } from "lucide-react";
import dynamic from "next/dynamic";
const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div style={{ minHeight: 60 }} /> },
);
import { avatarColorFor } from "@/lib/avatarColor";
import HubDocNotifyPanel, { type NotifyMember } from "@/components/HubDocNotifyPanel";

interface ThreadAuthor {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
}

interface Thread {
  id: string;
  title: string;
  body: any;
  authorId: string;
  author: ThreadAuthor;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  hubSlug: string;
  docId: string;
  initialThreads: Thread[];
  hubMembers: NotifyMember[];
  coordinatorIds: string[];
  currentUserId: string;
}

function displayName(u: ThreadAuthor) {
  const first = u.preferredName || u.firstName;
  return [first, u.lastName].filter(Boolean).join(" ") || "Someone";
}

function initialsOf(u: ThreadAuthor) {
  if (u.firstName && u.lastName) return (u.firstName[0] + u.lastName[0]).toUpperCase();
  const name = u.preferredName || u.firstName || u.lastName || "";
  if (!name) return "?";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function hasContent(value: any): boolean {
  if (!value) return false;
  if (typeof value === "string") return value.replace(/<[^>]+>/g, "").trim().length > 0;
  if (Array.isArray(value)) {
    const inline = (c: any[] = []) => c.map((x: any) => x.text ?? "").join("");
    const text = value.map((b: any) => inline(b.content)).join("");
    return text.trim().length > 0;
  }
  return false;
}

/** A short heading derived from the comment's first line (the document is the
 *  subject — there's no separate topic). Falls back to "Comment". */
function deriveTitle(value: any): string {
  let text = "";
  if (typeof value === "string") {
    text = value.replace(/<[^>]+>/g, " ");
  } else if (Array.isArray(value)) {
    const inline = (c: any[] = []) => c.map((x: any) => x.text ?? "").join(" ");
    text = value.map((b: any) => inline(b.content)).join(" ");
  }
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return "Comment";
  return text.length > 80 ? `${text.slice(0, 80).trimEnd()}…` : text;
}

export default function HubDocConversationsClient({
  hubSlug,
  docId,
  initialThreads,
  hubMembers,
  coordinatorIds,
  currentUserId,
}: Props) {
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [showCompose, setShowCompose] = useState(false);
  const [body, setBody] = useState<string>("");
  const [notifyIds, setNotifyIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false); // synchronous double-submit guard for submitThread
  const [error, setError] = useState<string | null>(null);

  const coordinatorSet = new Set(coordinatorIds);
  const nonCoordinatorMembers = hubMembers.filter(
    (m) => !coordinatorSet.has(m.id) && m.id !== currentUserId
  );
  const coordinatorCount = coordinatorIds.filter((c) => c !== currentUserId).length;

  async function submitThread() {
    if (!hasContent(body) || submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/hub/${hubSlug}/documents/${docId}/conversations`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        // No separate topic — derive a short heading from the comment's first line.
        body:    JSON.stringify({ title: deriveTitle(body), body, notifyUserIds: notifyIds }),
      });
      if (!res.ok) throw new Error("Failed to post");
      const thread = await res.json();
      setThreads((prev) => [
        { ...thread, replyCount: 0 },
        ...prev,
      ]);
      setBody("");
      setNotifyIds([]);
      setShowCompose(false);
    } catch {
      setError("Couldn't post the comment. Try again.");
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  }

  return (
    <section className="doc-conv" id="doc-conversations">
      <div className="doc-conv__header">
        <h2 className="doc-conv__heading">
          <MessageSquare size={16} strokeWidth={1.75} />
          Comments
          {threads.length > 0 && (
            <span className="doc-conv__count">{threads.length}</span>
          )}
        </h2>
        {!showCompose && (
          <button
            className="btn--ghost doc-conv__new-btn"
            onClick={() => setShowCompose(true)}
          >
            <Plus size={14} strokeWidth={2} />
            Add a comment
          </button>
        )}
      </div>

      {showCompose && (
        <div className="doc-conv__compose">
          <RimTiptapEditor
            variant="message"
            value={body}
            onChange={setBody}
            placeholder="Add a comment…"
          />

          <div className="doc-conv__compose-footer">
            {coordinatorCount > 0 && (
              <p className="doc-conv__notify-note">
                {coordinatorCount} coordinator{coordinatorCount > 1 ? "s are" : " is"} always notified.
              </p>
            )}
            <HubDocNotifyPanel
              members={nonCoordinatorMembers}
              selectedIds={notifyIds}
              onChange={setNotifyIds}
            />
            <div className="doc-conv__compose-actions">
              {error && <span className="doc-conv__error">{error}</span>}
              <button
                className="btn--ghost"
                onClick={() => { setShowCompose(false); setBody(""); setNotifyIds([]); }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="btn--primary"
                onClick={submitThread}
                disabled={saving || !hasContent(body)}
              >
                {saving ? "Posting…" : "Post comment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {threads.length === 0 && !showCompose ? (
        <p className="doc-conv__empty">No comments yet. Add the first one.</p>
      ) : (
        <ul className="doc-conv__list">
          {threads.map((t) => {
            const color = avatarColorFor(t.authorId);
            return (
              <li key={t.id} className="doc-conv__item">
                <Link
                  href={`/account/hub/${hubSlug}/conversations/${t.id}`}
                  className="doc-conv__item-link"
                >
                  <div
                    className="doc-conv__avatar"
                    style={{ background: color }}
                    aria-hidden="true"
                  >
                    {initialsOf(t.author)}
                  </div>
                  <div className="doc-conv__item-body">
                    <span className="doc-conv__item-title">{t.title}</span>
                    <span className="doc-conv__item-meta">
                      {displayName(t.author)}
                      {t.replyCount > 0 && (
                        <> · {t.replyCount} {t.replyCount === 1 ? "reply" : "replies"}</>
                      )}
                      {" · "}{relativeTime(t.updatedAt)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
