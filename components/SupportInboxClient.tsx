"use client";

/**
 * SupportInboxClient — Three-column support inbox.
 * CSS prefix: si-
 *
 * Left: thread list (300px fixed, scrolls independently)
 * Center: messages (scrolls) + composer (anchored bottom)
 * Right: sidebar with status, assignment, member context (collapsible)
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
  fromEmail?: string;
  fromName?: string;
  bodyHtml?: string;
  bodyText?: string;
  isOutbound?: boolean;
  sentBy?: { name: string } | null;
  body?: any;
  author?: { name: string };
  sentAt?: string;
  createdAt?: string;
}

interface MemberContext {
  id: string;
  name: string;
  email: string;
  memberSince: string;
  memberStatus: string;
  registrations: {
    id: string;
    programTitle: string;
    programSlug: string;
    status: string;
    createdAt: string;
  }[];
}

interface ThreadDetail {
  id: string;
  subject: string;
  senderEmail: string;
  senderName: string | null;
  status: string;
  assignee: { id: string; name: string } | null;
  member: MemberContext | null;
  timeline: TimelineEntry[];
  lastMessageAt: string;
  createdAt: string;
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

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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

const REG_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  WAITLISTED: "Waitlisted",
  PENDING: "Pending",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function SupportInboxClient({
  currentUserId,
  currentUserName,
  teamMembers,
  connectedEmail,
}: Props) {
  // Thread list
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<string>("active");
  const [search, setSearch] = useState("");

  // Thread detail
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Composer
  const [composerOpen, setComposerOpen] = useState(false);
  const [replyMode, setReplyMode] = useState<"reply" | "note">("reply");
  const [replyBody, setReplyBody] = useState<any>(null);
  const [sending, setSending] = useState(false);

  const timelineRef = useRef<HTMLDivElement>(null);

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

  // ─── Fetch detail ──────────────────────────────────────────────────────

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
    setComposerOpen(false);
    setReplyBody(null);
    setReplyMode("reply");
  };

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
  }, [selectedId, fetchDetail]);

  // Scroll timeline to top when detail loads
  useEffect(() => {
    if (detail && timelineRef.current) {
      timelineRef.current.scrollTop = 0;
    }
  }, [detail]);

  // ─── Sync ─────────────────────────────────────────────────────────────

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

  // ─── Status / Assignment ──────────────────────────────────────────────

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

  // ─── Send reply ───────────────────────────────────────────────────────

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
        setComposerOpen(false);
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
        setComposerOpen(false);
        fetchDetail(selectedId);
      }
    }

    setSending(false);
  };

  const claimThread = (id: string) => {
    updateThread(id, { status: "CLAIMED", assignedToId: currentUserId });
  };

  // ─── Render ───────────────────────────────────────────────────────────

  const layoutCls = [
    "si-layout",
    !sidebarOpen && "si-layout--sidebar-closed",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={layoutCls}>
      {/* ── Left: thread list ── */}
      <div className="si-list">
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

      {/* ── Center: messages + composer ── */}
      <div className="si-main">
        {!selectedId && (
          <div className="si-main__empty">
            <p>Select a thread to view</p>
          </div>
        )}

        {selectedId && detailLoading && (
          <div className="si-main__empty">
            <p>Loading…</p>
          </div>
        )}

        {selectedId && !detailLoading && detail && (
          <>
            {/* Subject header */}
            <div className="si-subject-bar">
              <h2 className="si-subject-bar__title">{detail.subject}</h2>
              <span
                className="si-status-badge"
                style={{ background: STATUS_COLORS[detail.status] }}
              >
                {STATUS_LABELS[detail.status]}
              </span>
              <button
                className="si-sidebar-toggle"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              >
                {sidebarOpen ? "▸" : "◂"}
              </button>
            </div>

            {/* Timeline — scrolls independently */}
            <div className="si-timeline" ref={timelineRef}>
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
                        __html:
                          entry.bodyHtml || `<pre>${entry.bodyText}</pre>`,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Composer — anchored to bottom */}
            {detail.status !== "CLOSED" && (
              <div className="si-composer">
                {!composerOpen ? (
                  <button
                    className="si-composer__prompt"
                    onClick={() => setComposerOpen(true)}
                  >
                    Reply…
                  </button>
                ) : (
                  <>
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
                      <button
                        className="si-composer__collapse"
                        onClick={() => setComposerOpen(false)}
                        title="Collapse"
                      >
                        ▾
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
                        minHeight={100}
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
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Right: sidebar ── */}
      {selectedId && !detailLoading && detail && (
        <div className="si-sidebar">
          {/* Status & Actions */}
          <div className="si-sidebar__section">
            <div className="si-sidebar__label">Status</div>
            <div className="si-sidebar__row">
              <span
                className="si-status-badge"
                style={{ background: STATUS_COLORS[detail.status] }}
              >
                {STATUS_LABELS[detail.status]}
              </span>
              {detail.status === "OPEN" && (
                <button
                  className="si-btn si-btn--claim"
                  onClick={() => claimThread(detail.id)}
                >
                  Claim
                </button>
              )}
              {["OPEN", "CLAIMED", "WAITING"].includes(detail.status) && (
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

          {/* Assignment */}
          <div className="si-sidebar__section">
            <div className="si-sidebar__label">Assigned To</div>
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
          </div>

          {/* From */}
          <div className="si-sidebar__section">
            <div className="si-sidebar__label">From</div>
            <div className="si-sidebar__value">
              {detail.senderName || detail.senderEmail}
            </div>
            {detail.senderName && (
              <div className="si-sidebar__meta">{detail.senderEmail}</div>
            )}
          </div>

          {/* Thread info */}
          <div className="si-sidebar__section">
            <div className="si-sidebar__label">Thread</div>
            <div className="si-sidebar__meta">
              Created {fmtDateShort(detail.createdAt)}
            </div>
            <div className="si-sidebar__meta">
              Last message {fmtDateShort(detail.lastMessageAt)}
            </div>
            <div className="si-sidebar__meta">
              {detail.timeline.filter((e) => e.type === "message").length}{" "}
              messages
            </div>
          </div>

          {/* Member context */}
          {detail.member && (
            <div className="si-sidebar__section">
              <div className="si-sidebar__label">
                Member
                <span className="si-member-badge">
                  {detail.member.memberStatus === "ACTIVE"
                    ? "Active"
                    : detail.member.memberStatus}
                </span>
              </div>
              <div className="si-sidebar__value">{detail.member.name}</div>
              <div className="si-sidebar__meta">{detail.member.email}</div>
              <div className="si-sidebar__meta">
                Since {fmtDateShort(detail.member.memberSince)}
              </div>

              {detail.member.registrations.length > 0 && (
                <div className="si-sidebar__regs">
                  <div className="si-sidebar__sublabel">
                    Recent Registrations
                  </div>
                  {detail.member.registrations.map((r) => (
                    <div key={r.id} className="si-sidebar__reg">
                      <span className="si-sidebar__reg-title">
                        {r.programTitle}
                      </span>
                      <span
                        className="si-sidebar__reg-status"
                        data-status={r.status}
                      >
                        {REG_STATUS_LABELS[r.status] || r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!detail.member && (
            <div className="si-sidebar__section">
              <div className="si-sidebar__label">Member</div>
              <div className="si-sidebar__meta">Not a member</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
