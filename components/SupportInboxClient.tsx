"use client";

/**
 * SupportInboxClient — Split-pane support inbox.
 * CSS prefix: si-
 *
 * Left panel: thread list with filter pills + search + sync button.
 * Right panel: thread detail with messages, notes, reply composer.
 * Expand mode: detail takes full width, list hidden, "Back" to return.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import FormattedEditor from "./FormattedEditor";
import { renderFormattedText } from "@/lib/renderRichContent";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ThreadSummary {
  id: string;
  subject: string;
  senderEmail: string;
  senderName: string | null;
  status: string;
  lastMessageAt: string;
  messageCount: number;
  snippet: string;
  assignee: { id: string; name: string } | null;
  member: { id: string; name: string } | null;
}

interface TimelineEntry {
  type: "message" | "note";
  id: string;
  // Message fields
  fromEmail?: string;
  fromName?: string;
  bodyHtml?: string;
  bodyText?: string;
  isOutbound?: boolean;
  sentBy?: { name: string } | null;
  // Note fields
  body?: any;
  author?: { name: string };
  // Shared
  sentAt?: string;
  createdAt?: string;
}

interface ThreadDetail {
  id: string;
  subject: string;
  senderEmail: string;
  senderName: string | null;
  status: string;
  assignee: { id: string; name: string } | null;
  member: { id: string; name: string } | null;
  timeline: TimelineEntry[];
}

interface TeamMember {
  id: string;
  name: string;
}

interface Props {
  currentUserId: string;
  currentUserName: string;
  teamMembers: TeamMember[];
  connectedEmail: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  CLAIMED: "Claimed",
  WAITING: "Waiting",
  CLOSED: "Closed",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "#c0392b",
  CLAIMED: "#2980b9",
  WAITING: "#e67e22",
  CLOSED: "#7f8c8d",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function SupportInboxClient({
  currentUserId,
  currentUserName,
  teamMembers,
  connectedEmail,
}: Props) {
  // Thread list state
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<string>("active");
  const [search, setSearch] = useState("");

  // Thread detail state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Reply state
  const [replyMode, setReplyMode] = useState<"reply" | "note">("reply");
  const [replyBody, setReplyBody] = useState<any>(null);
  const [sending, setSending] = useState(false);

  const detailRef = useRef<HTMLDivElement>(null);

  // ─── Fetch threads ──────────────────────────────────────────────────────

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter === "active") params.set("status", "OPEN,CLAIMED,WAITING");
    else if (filter === "mine") {
      params.set("status", "OPEN,CLAIMED,WAITING");
      params.set("assignedTo", "me");
    } else if (filter === "closed") params.set("status", "CLOSED");
    if (search) params.set("search", search);

    const res = await fetch(`/api/support/threads?${params}`);
    if (res.ok) {
      const data = await res.json();
      setThreads(data.threads ?? []);
    }
    setLoading(false);
  }, [filter, search]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // ─── Fetch thread detail ────────────────────────────────────────────────

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    const res = await fetch(`/api/support/threads/${id}`);
    if (res.ok) {
      const data = await res.json();
      setDetail(data);
    }
    setDetailLoading(false);
  }, []);

  const selectThread = (id: string) => {
    setSelectedId(id);
    setExpanded(true);
  };

  const goBack = () => {
    setExpanded(false);
  };

  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId);
      setReplyBody(null);
      setReplyMode("reply");
    }
  }, [selectedId, fetchDetail]);

  // Scroll to bottom of timeline when detail loads
  useEffect(() => {
    if (detail && detailRef.current) {
      const timeline = detailRef.current.querySelector(".si-timeline");
      if (timeline) timeline.scrollTop = timeline.scrollHeight;
    }
  }, [detail]);

  // ─── Sync ───────────────────────────────────────────────────────────────

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/support/sync", { method: "POST" });
      if (res.ok) {
        await fetchThreads();
        if (selectedId) fetchDetail(selectedId);
      }
    } finally {
      setSyncing(false);
    }
  };

  // ─── Status / Assignment ────────────────────────────────────────────────

  const updateThread = async (
    id: string,
    data: { status?: string; assignedToId?: string | null }
  ) => {
    const res = await fetch(`/api/support/threads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      fetchThreads();
      if (selectedId === id) fetchDetail(id);
    }
  };

  // ─── Send reply ─────────────────────────────────────────────────────────

  const handleSendReply = async () => {
    if (!selectedId || !replyBody) return;
    setSending(true);

    if (replyMode === "reply") {
      const html = renderFormattedText(replyBody);
      const res = await fetch(`/api/support/threads/${selectedId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyHtml: html }),
      });
      if (res.ok) {
        setReplyBody(null);
        fetchDetail(selectedId);
        fetchThreads();
      }
    } else {
      const res = await fetch(`/api/support/threads/${selectedId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody }),
      });
      if (res.ok) {
        setReplyBody(null);
        fetchDetail(selectedId);
      }
    }

    setSending(false);
  };

  // ─── Claim shortcut ────────────────────────────────────────────────────

  const claimThread = (id: string) => {
    updateThread(id, { status: "CLAIMED", assignedToId: currentUserId });
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className={`si-layout${expanded ? " si-layout--expanded" : ""}`}>
      {/* ── Left panel: thread list ── */}
      <div className="si-list-panel">
        <div className="si-toolbar">
          <div className="si-filters">
            {(["active", "mine", "closed", "all"] as const).map((f) => (
              <button
                key={f}
                className={`si-pill${filter === f ? " si-pill--active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "active"
                  ? "Active"
                  : f === "mine"
                    ? "Mine"
                    : f === "closed"
                      ? "Closed"
                      : "All"}
              </button>
            ))}
          </div>
          <button
            className="si-sync-btn"
            onClick={handleSync}
            disabled={syncing}
            title="Sync Gmail"
          >
            {syncing ? "Syncing…" : "Sync"}
          </button>
        </div>

        <div className="si-search">
          <input
            type="text"
            className="si-search__input"
            placeholder="Search threads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchThreads();
            }}
          />
        </div>

        <div className="si-thread-list">
          {loading && <div className="si-loading">Loading…</div>}
          {!loading && threads.length === 0 && (
            <div className="si-empty-list">
              {filter === "mine"
                ? "No threads assigned to you."
                : "No threads found."}
            </div>
          )}
          {!loading &&
            threads.map((t) => (
              <button
                key={t.id}
                className={`si-thread-item${selectedId === t.id ? " si-thread-item--selected" : ""}`}
                onClick={() => selectThread(t.id)}
              >
                <div className="si-thread-item__top">
                  <span className="si-thread-item__sender">
                    {t.senderName || t.senderEmail}
                  </span>
                  <span className="si-thread-item__date">
                    {fmtDate(t.lastMessageAt)}
                  </span>
                </div>
                <div className="si-thread-item__subject">{t.subject}</div>
                <div className="si-thread-item__bottom">
                  <span
                    className="si-status-dot"
                    style={{ background: STATUS_COLORS[t.status] }}
                    title={STATUS_LABELS[t.status]}
                  />
                  <span className="si-thread-item__snippet">{t.snippet}</span>
                  <span className="si-thread-item__count">
                    {t.messageCount}
                  </span>
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* ── Right panel: thread detail ── */}
      <div className="si-detail-panel" ref={detailRef}>
        {!selectedId && (
          <div className="si-detail-empty">
            <p>Select a thread to view</p>
          </div>
        )}

        {selectedId && detailLoading && (
          <div className="si-detail-empty">
            <p>Loading…</p>
          </div>
        )}

        {selectedId && !detailLoading && detail && (
          <>
            {/* Header */}
            <div className="si-detail-header">
              <div className="si-detail-header__top">
                <button className="si-back-btn" onClick={goBack} title="Back to inbox">
                  &larr;
                </button>
                <h2 className="si-detail-header__subject">
                  {detail.subject}
                </h2>
                <span
                  className="si-status-badge"
                  style={{
                    background: STATUS_COLORS[detail.status],
                  }}
                >
                  {STATUS_LABELS[detail.status]}
                </span>
              </div>
              <div className="si-detail-header__meta">
                <span>
                  From: {detail.senderName || detail.senderEmail}
                  {detail.senderName && (
                    <span className="si-meta-email">
                      {" "}
                      &lt;{detail.senderEmail}&gt;
                    </span>
                  )}
                </span>
                {detail.member && (
                  <span className="si-member-badge">Member</span>
                )}
              </div>
              <div className="si-detail-actions">
                {/* Assignment */}
                <label className="si-action-label">
                  Assign:
                  <select
                    className="si-select"
                    value={detail.assignee?.id ?? ""}
                    onChange={(e) =>
                      updateThread(detail.id, {
                        assignedToId: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Status actions */}
                {detail.status === "OPEN" && (
                  <button
                    className="si-btn si-btn--claim"
                    onClick={() => claimThread(detail.id)}
                  >
                    Claim
                  </button>
                )}
                {(detail.status === "OPEN" ||
                  detail.status === "CLAIMED" ||
                  detail.status === "WAITING") && (
                  <button
                    className="si-btn si-btn--close"
                    onClick={() =>
                      updateThread(detail.id, { status: "CLOSED" })
                    }
                  >
                    Close
                  </button>
                )}
                {detail.status === "CLOSED" && (
                  <button
                    className="si-btn si-btn--reopen"
                    onClick={() =>
                      updateThread(detail.id, { status: "OPEN" })
                    }
                  >
                    Reopen
                  </button>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="si-timeline">
              {detail.timeline.map((entry) => {
                if (entry.type === "note") {
                  return (
                    <div key={entry.id} className="si-note">
                      <div className="si-note__header">
                        <span className="si-note__label">Internal Note</span>
                        <span className="si-note__author">
                          {entry.author?.name}
                        </span>
                        <span className="si-note__date">
                          {fmtDateTime(entry.createdAt!)}
                        </span>
                      </div>
                      <div
                        className="si-note__body"
                        dangerouslySetInnerHTML={{
                          __html: renderFormattedText(entry.body),
                        }}
                      />
                    </div>
                  );
                }

                // Message
                return (
                  <div
                    key={entry.id}
                    className={`si-message${entry.isOutbound ? " si-message--outbound" : ""}`}
                  >
                    <div className="si-message__header">
                      <span className="si-message__from">
                        {entry.isOutbound
                          ? entry.sentBy?.name || connectedEmail
                          : entry.fromName || entry.fromEmail}
                      </span>
                      <span className="si-message__date">
                        {fmtDateTime(entry.sentAt!)}
                      </span>
                    </div>
                    <div
                      className="si-message__body"
                      dangerouslySetInnerHTML={{
                        __html: entry.bodyHtml || `<pre>${entry.bodyText}</pre>`,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Reply / Note composer */}
            {detail.status !== "CLOSED" && (
              <div className="si-composer">
                <div className="si-composer__tabs">
                  <button
                    className={`si-composer__tab${replyMode === "reply" ? " si-composer__tab--active" : ""}`}
                    onClick={() => setReplyMode("reply")}
                  >
                    Reply
                  </button>
                  <button
                    className={`si-composer__tab${replyMode === "note" ? " si-composer__tab--active" : ""}`}
                    onClick={() => setReplyMode("note")}
                  >
                    Internal Note
                  </button>
                </div>
                {replyMode === "note" && (
                  <div className="si-composer__note-banner">
                    This note is only visible to the support team.
                  </div>
                )}
                <div className="si-composer__editor">
                  <FormattedEditor
                    value={replyBody}
                    onChange={setReplyBody}
                    placeholder={
                      replyMode === "reply"
                        ? "Type your reply…"
                        : "Add an internal note…"
                    }
                    minHeight={120}
                  />
                </div>
                <div className="si-composer__footer">
                  <button
                    className={`si-btn ${replyMode === "reply" ? "si-btn--send" : "si-btn--note"}`}
                    onClick={handleSendReply}
                    disabled={sending || !replyBody}
                  >
                    {sending
                      ? "Sending…"
                      : replyMode === "reply"
                        ? "Send Reply"
                        : "Add Note"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
