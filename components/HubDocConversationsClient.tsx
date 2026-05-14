"use client";

/**
 * HubDocConversationsClient — Conversations panel on a document view page.
 * CSS prefix: doc-conv-
 *
 * Stripped-down version of HubConvClient: no categories, no pinning, no
 * status filter. Just a thread list + compose. Clicking a thread navigates
 * to the shared thread detail page which shows "← Back to [Document]".
 */

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MessageSquare, Plus, X } from "lucide-react";
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
  const [title, setTitle] = useState("");
  const [body, setBody] = useState<string>("");
  const [notifyIds, setNotifyIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showCompose) titleRef.current?.focus();
  }, [showCompose]);

  const coordinatorSet = new Set(coordinatorIds);
  const nonCoordinatorMembers = hubMembers.filter(
    (m) => !coordinatorSet.has(m.id) && m.id !== currentUserId
  );
  const coordinatorCount = coordinatorIds.filter((c) => c !== currentUserId).length;

  async function submitThread() {
    if (!title.trim() || !hasContent(body)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/hub/${hubSlug}/documents/${docId}/conversations`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: title.trim(), body, notifyUserIds: notifyIds }),
      });
      if (!res.ok) throw new Error("Failed to post");
      const thread = await res.json();
      setThreads((prev) => [
        { ...thread, replyCount: 0 },
        ...prev,
      ]);
      setTitle("");
      setBody("");
      setNotifyIds([]);
      setShowCompose(false);
    } catch {
      setError("Couldn't post the conversation. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="doc-conv" id="doc-conversations">
      <div className="doc-conv__header">
        <h2 className="doc-conv__heading">
          <MessageSquare size={16} strokeWidth={1.75} />
          Conversations
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
            New topic
          </button>
        )}
      </div>

      {showCompose && (
        <div className="doc-conv__compose">
          <div className="doc-conv__compose-head">
            <input
              ref={titleRef}
              className="doc-conv__title-input"
              type="text"
              placeholder="What do you want to discuss?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
            />
            <button
              className="doc-conv__compose-close"
              aria-label="Cancel"
              onClick={() => { setShowCompose(false); setTitle(""); setBody(""); setNotifyIds([]); }}
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>

          <RimTiptapEditor
            variant="message"
            initialContent={body}
            onChange={setBody}
            placeholder="Add a message…"
          />

          <div className="doc-conv__compose-footer">
            <HubDocNotifyPanel
              hubSlug={hubSlug}
              members={nonCoordinatorMembers}
              selectedIds={notifyIds}
              onChange={setNotifyIds}
              helpNote={
                coordinatorCount > 0
                  ? `${coordinatorCount} coordinator${coordinatorCount > 1 ? "s are" : " is"} always notified.`
                  : undefined
              }
              alreadyNotified={[]}
            />
            <div className="doc-conv__compose-actions">
              {error && <span className="doc-conv__error">{error}</span>}
              <button
                className="btn--ghost"
                onClick={() => { setShowCompose(false); setTitle(""); setBody(""); setNotifyIds([]); }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="btn--primary"
                onClick={submitThread}
                disabled={saving || !title.trim() || !hasContent(body)}
              >
                {saving ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        </div>
      )}

      {threads.length === 0 && !showCompose ? (
        <p className="doc-conv__empty">No conversations yet. Start one to discuss this document.</p>
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
