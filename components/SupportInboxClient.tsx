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
import { upload } from "@vercel/blob/client";
import type { Editor } from "@tiptap/react";
import RimProseEditor from "@/components/RimProseEditor";

interface StagedFile {
  file: File;
  url?: string; // Blob URL after upload
  uploading?: boolean;
  error?: string;
}

const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25 MB

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

interface FileAttachment {
  id: string;
  gmailAttachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface TimelineEntry {
  type: "message" | "note";
  id: string;
  gmailMessageId?: string;
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
  fileAttachments?: FileAttachment[];
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

interface ContactHistoryItem {
  id: string;
  subject: string;
  status: string;
  lastMessageAt: string;
}

interface ThreadDetail {
  id: string;
  subject: string;
  senderEmail: string;
  senderName: string | null;
  status: string;
  deletedAt: string | null;
  assignee: { id: string; name: string } | null;
  member: MemberContext | null;
  timeline: TimelineEntry[];
  contactHistory: ContactHistoryItem[];
  lastMessageAt: string;
  createdAt: string;
}

interface TeamMember {
  id: string;
  name: string;
}

interface TemplateOption {
  id: string;
  name: string;
  subject: string;
  body: any;
}

interface Props {
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
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

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  isAdmin,
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

  // Reply composer (anchored to bottom of main panel)
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState<any>(null);
  const [replySending, setReplySending] = useState(false);
  const [replyFiles, setReplyFiles] = useState<StagedFile[]>([]);
  const [replyFileError, setReplyFileError] = useState<string | null>(null);
  const replyFileRef = useRef<HTMLInputElement>(null);

  // Note panel (appears above timeline, separate from reply)
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState<any>(null);
  const [noteSending, setNoteSending] = useState(false);

  // Compose new email modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeDraft, setComposeDraft] = useState<any>(null);
  const [composeSending, setComposeSending] = useState(false);
  const [composeFiles, setComposeFiles] = useState<StagedFile[]>([]);
  const [composeFileError, setComposeFileError] = useState<string | null>(null);
  const composeFileRef = useRef<HTMLInputElement>(null);
  const [contactResults, setContactResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [contactsOpen, setContactsOpen] = useState(false);
  const contactSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Templates
  const [tplList, setTplList] = useState<TemplateOption[]>([]);
  const [tplLoaded, setTplLoaded] = useState(false);
  const [replyTplOpen, setReplyTplOpen] = useState(false);
  const [composeTplOpen, setComposeTplOpen] = useState(false);

  const replyEditorRef = useRef<Editor | null>(null);
  const composeEditorRef = useRef<Editor | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // ─── Fetch threads ──────────────────────────────────────────────────────

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter === "trash") {
      params.set("trash", "true");
    } else if (filter === "active") {
      params.set("status", "OPEN,CLAIMED,WAITING");
    } else if (filter === "mine") {
      params.set("status", "OPEN,CLAIMED,WAITING");
      params.set("assignedTo", "me");
    } else if (filter === "closed") {
      params.set("status", "CLOSED");
    }
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
    setReplyOpen(false);
    setReplyDraft(null);
    setReplyFiles([]);
    setReplyFileError(null);
    setNoteOpen(false);
    setNoteDraft(null);
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

  // ─── Templates ───────────────────────────────────────────────────────

  const fetchTemplates = useCallback(async () => {
    if (tplLoaded) return;
    const res = await fetch("/api/support/templates");
    if (res.ok) {
      const data = await res.json();
      setTplList(data.templates ?? []);
    }
    setTplLoaded(true);
  }, [tplLoaded]);

  const applyReplyTemplate = (t: TemplateOption) => {
    if (replyEditorRef.current && t.body) {
      replyEditorRef.current.commands.setContent(t.body);
    }
    setReplyDraft(t.body);
    setReplyTplOpen(false);
  };

  const applyComposeTemplate = (t: TemplateOption) => {
    if (t.subject && !composeSubject) setComposeSubject(t.subject);
    if (composeEditorRef.current && t.body) {
      composeEditorRef.current.commands.setContent(t.body);
    }
    setComposeDraft(t.body);
    setComposeTplOpen(false);
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

  // ─── Reply file attachments ─────────────────────────────────────────

  const handleAddFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setReplyFileError(null);

    const newFiles = Array.from(files);
    const currentSize = replyFiles.reduce((s, f) => s + f.file.size, 0);
    const addedSize = newFiles.reduce((s, f) => s + f.size, 0);

    if (currentSize + addedSize > MAX_TOTAL_SIZE) {
      setReplyFileError(`Total attachments exceed 25 MB limit.`);
      return;
    }

    // Add files as staged (not yet uploaded)
    const staged: StagedFile[] = newFiles.map((f) => ({ file: f, uploading: true }));
    setReplyFiles((prev) => [...prev, ...staged]);

    // Upload each file via Vercel Blob
    for (let i = 0; i < staged.length; i++) {
      try {
        const blob = await upload(staged[i].file.name, staged[i].file, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });
        setReplyFiles((prev) =>
          prev.map((f) =>
            f.file === staged[i].file ? { ...f, url: blob.url, uploading: false } : f
          )
        );
      } catch {
        setReplyFiles((prev) =>
          prev.map((f) =>
            f.file === staged[i].file ? { ...f, error: "Upload failed", uploading: false } : f
          )
        );
      }
    }

    // Reset input so the same file can be re-selected
    if (replyFileRef.current) replyFileRef.current.value = "";
  };

  const removeReplyFile = (idx: number) => {
    setReplyFiles((prev) => prev.filter((_, i) => i !== idx));
    setReplyFileError(null);
  };

  // ─── Send reply (bottom composer) ────────────────────────────────────

  const handleSendReply = async () => {
    if (!selectedId || !replyDraft) return;
    // Check all files uploaded
    if (replyFiles.some((f) => f.uploading)) return;
    if (replyFiles.some((f) => f.error)) {
      setReplyFileError("Remove failed uploads before sending.");
      return;
    }

    setReplySending(true);
    const attachments = replyFiles
      .filter((f) => f.url)
      .map((f) => ({
        url: f.url!,
        filename: f.file.name,
        mimeType: f.file.type || "application/octet-stream",
        size: f.file.size,
      }));

    const res = await fetch(`/api/support/threads/${selectedId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: replyDraft, attachments }),
    });
    if (res.ok) {
      setReplyDraft(null);
      setReplyOpen(false);
      setReplyFiles([]);
      setReplyFileError(null);
      fetchDetail(selectedId);
      fetchThreads();
    }
    setReplySending(false);
  };

  const handleCancelReply = () => {
    if ((replyDraft || replyFiles.length > 0) && !window.confirm("Discard reply?")) return;
    setReplyDraft(null);
    setReplyOpen(false);
    setReplyFiles([]);
    setReplyFileError(null);
    setReplyTplOpen(false);
  };

  // ─── Save note (separate panel) ────────────────────────────────────

  const handleSaveNote = async () => {
    if (!selectedId || !noteDraft) return;
    setNoteSending(true);
    const res = await fetch(`/api/support/threads/${selectedId}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: noteDraft }),
    });
    if (res.ok) {
      setNoteDraft(null);
      setNoteOpen(false);
      fetchDetail(selectedId);
    }
    setNoteSending(false);
  };

  const handleCancelNote = () => {
    if (noteDraft && !window.confirm("Discard note?")) return;
    setNoteDraft(null);
    setNoteOpen(false);
  };

  const claimThread = (id: string) => {
    updateThread(id, { status: "CLAIMED", assignedToId: currentUserId });
  };

  // ─── Soft delete / restore / permanent delete ─────────────────────

  const handleSoftDelete = async (id: string) => {
    const res = await fetch(`/api/support/threads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deletedAt: "now" }),
    });
    if (res.ok) {
      setSelectedId(null);
      setDetail(null);
      fetchThreads();
    }
  };

  const handleRestore = async (id: string) => {
    const res = await fetch(`/api/support/threads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deletedAt: null }),
    });
    if (res.ok) {
      setSelectedId(null);
      setDetail(null);
      fetchThreads();
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!window.confirm("This cannot be undone. Delete permanently?")) return;
    const res = await fetch(`/api/support/threads/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setSelectedId(null);
      setDetail(null);
      fetchThreads();
    }
  };

  // ─── Compose new email ──────────────────────────────────────────────

  const searchContacts = (query: string) => {
    setComposeTo(query);
    setContactsOpen(false);
    if (contactSearchTimeout.current) clearTimeout(contactSearchTimeout.current);
    if (query.length < 2) {
      setContactResults([]);
      return;
    }
    contactSearchTimeout.current = setTimeout(async () => {
      const res = await fetch(`/api/support/contacts?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setContactResults(data.contacts ?? []);
        setContactsOpen(true);
      }
    }, 250);
  };

  const selectContact = (email: string) => {
    setComposeTo(email);
    setContactResults([]);
    setContactsOpen(false);
  };

  const handleComposeAddFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setComposeFileError(null);
    const newFiles = Array.from(files);
    const currentSize = composeFiles.reduce((s, f) => s + f.file.size, 0);
    const addedSize = newFiles.reduce((s, f) => s + f.size, 0);
    if (currentSize + addedSize > MAX_TOTAL_SIZE) {
      setComposeFileError("Total attachments exceed 25 MB limit.");
      return;
    }
    const staged: StagedFile[] = newFiles.map((f) => ({ file: f, uploading: true }));
    setComposeFiles((prev) => [...prev, ...staged]);
    for (let i = 0; i < staged.length; i++) {
      try {
        const blob = await upload(staged[i].file.name, staged[i].file, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });
        setComposeFiles((prev) =>
          prev.map((f) =>
            f.file === staged[i].file ? { ...f, url: blob.url, uploading: false } : f
          )
        );
      } catch {
        setComposeFiles((prev) =>
          prev.map((f) =>
            f.file === staged[i].file ? { ...f, error: "Upload failed", uploading: false } : f
          )
        );
      }
    }
    if (composeFileRef.current) composeFileRef.current.value = "";
  };

  const removeComposeFile = (idx: number) => {
    setComposeFiles((prev) => prev.filter((_, i) => i !== idx));
    setComposeFileError(null);
  };

  const handleSendCompose = async () => {
    if (!composeTo || !composeSubject || !composeDraft) return;
    if (composeFiles.some((f) => f.uploading)) return;
    if (composeFiles.some((f) => f.error)) {
      setComposeFileError("Remove failed uploads before sending.");
      return;
    }

    setComposeSending(true);
    const attachments = composeFiles
      .filter((f) => f.url)
      .map((f) => ({
        url: f.url!,
        filename: f.file.name,
        mimeType: f.file.type || "application/octet-stream",
        size: f.file.size,
      }));

    const res = await fetch("/api/support/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: composeTo,
        subject: composeSubject,
        body: composeDraft,
        attachments: attachments.length > 0 ? attachments : undefined,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      // Reset compose state
      setComposeOpen(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeDraft(null);
      setComposeFiles([]);
      setComposeFileError(null);
      // Navigate to new thread
      fetchThreads();
      setSelectedId(data.threadId);
    }
    setComposeSending(false);
  };

  const handleCancelCompose = () => {
    if ((composeTo || composeSubject || composeDraft) && !window.confirm("Discard this email?")) return;
    setComposeOpen(false);
    setComposeTo("");
    setComposeSubject("");
    setComposeDraft(null);
    setComposeFiles([]);
    setComposeFileError(null);
    setComposeTplOpen(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────

  const layoutCls = [
    "si-layout",
    !sidebarOpen && "si-layout--sidebar-closed",
    sidebarOpen && "si-layout--sidebar-open",
    selectedId && "si-layout--detail-open",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={layoutCls}>
      {/* ── Left: thread list ── */}
      <div className="si-list">
        <div className="si-compose-row">
          <button
            className="si-btn si-btn--compose"
            onClick={() => setComposeOpen(true)}
          >
            New Email
          </button>
        </div>

        <div className="si-toolbar">
          <div className="si-filters">
            {(["active", "mine", "closed", "all", "trash"] as const).map((f) => (
              <button
                key={f}
                className={`si-pill${filter === f ? " si-pill--active" : ""}${f === "trash" ? " si-pill--trash" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "active"
                  ? "Active"
                  : f === "mine"
                    ? "Mine"
                    : f === "closed"
                      ? "Closed"
                      : f === "trash"
                        ? "Trash"
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
                : filter === "trash"
                  ? "Trash is empty."
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
        {/* Mobile back button */}
        {selectedId && (
          <button
            className="si-back-btn"
            onClick={() => { setSelectedId(null); setDetail(null); }}
          >
            ← Back to threads
          </button>
        )}

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

            {/* Note composer — appears above timeline, completely separate from reply */}
            {noteOpen && (
              <div className="si-note-composer">
                <div className="si-note-composer__header">
                  <span className="si-note-composer__label">
                    🔒 Internal Note — not sent to the member
                  </span>
                  <button
                    className="si-note-composer__close"
                    onClick={handleCancelNote}
                    title="Cancel"
                  >
                    ×
                  </button>
                </div>
                <div className="si-note-composer__editor">
                  <RimProseEditor
                    key="note-editor"
                    value={noteDraft}
                    onChange={setNoteDraft}
                    placeholder="Write an internal note…"
                    minHeight={80}
                  />
                </div>
                <div className="si-note-composer__footer">
                  <button
                    className="si-btn"
                    onClick={handleCancelNote}
                  >
                    Cancel
                  </button>
                  <button
                    className="si-btn si-btn--note"
                    onClick={handleSaveNote}
                    disabled={noteSending || !noteDraft}
                  >
                    {noteSending ? "Saving…" : "Save Note"}
                  </button>
                </div>
              </div>
            )}

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
                          __html: entry.bodyHtml ?? "",
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
                    {entry.fileAttachments && entry.fileAttachments.length > 0 && (
                      <div className="si-attachments">
                        {entry.fileAttachments.map((att) => (
                          <a
                            key={att.id}
                            className="si-attachment-chip"
                            href={`/api/support/attachment/${entry.gmailMessageId}/${att.gmailAttachmentId}?ct=${encodeURIComponent(att.mimeType)}&dl=${encodeURIComponent(att.filename)}`}
                            download={att.filename}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <span className="si-attachment-chip__icon">📎</span>
                            <span className="si-attachment-chip__name">{att.filename}</span>
                            <span className="si-attachment-chip__size">{fmtFileSize(att.size)}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reply composer — anchored to bottom, only for outbound replies */}
            {detail.status !== "CLOSED" && !detail.deletedAt && (
              <div className="si-composer">
                {!replyOpen ? (
                  <button
                    className="si-composer__prompt"
                    onClick={() => setReplyOpen(true)}
                  >
                    Reply…
                  </button>
                ) : (
                  <>
                    <div className="si-composer__editor">
                      <RimProseEditor
                        key="reply-editor"
                        value={replyDraft}
                        onChange={setReplyDraft}
                        placeholder="Type your reply…"
                        minHeight={100}
                      />
                    </div>
                    {/* Staged attachments */}
                    {replyFiles.length > 0 && (
                      <div className="si-staged-files">
                        {replyFiles.map((sf, idx) => (
                          <div key={idx} className={`si-staged-file${sf.error ? " si-staged-file--error" : ""}`}>
                            <span className="si-staged-file__icon">📎</span>
                            <span className="si-staged-file__name">{sf.file.name}</span>
                            <span className="si-staged-file__size">{fmtFileSize(sf.file.size)}</span>
                            {sf.uploading && <span className="si-staged-file__status">Uploading…</span>}
                            {sf.error && <span className="si-staged-file__status si-staged-file__status--error">{sf.error}</span>}
                            <button
                              className="si-staged-file__remove"
                              onClick={() => removeReplyFile(idx)}
                              title="Remove"
                            >×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {replyFileError && (
                      <div className="si-composer__error">{replyFileError}</div>
                    )}
                    <div className="si-composer__footer">
                      <div className="si-composer__actions-left">
                        <input
                          ref={replyFileRef}
                          type="file"
                          multiple
                          style={{ display: "none" }}
                          onChange={(e) => handleAddFiles(e.target.files)}
                        />
                        <button
                          className="si-btn si-btn--attach"
                          onClick={() => replyFileRef.current?.click()}
                          title="Attach file"
                          type="button"
                        >
                          📎
                        </button>
                        <div className="si-tpl-picker">
                          <button
                            className="si-btn si-btn--template"
                            onClick={() => {
                              fetchTemplates();
                              setReplyTplOpen(!replyTplOpen);
                            }}
                            type="button"
                          >
                            Use Template
                          </button>
                          {replyTplOpen && (
                            <div className="si-tpl-picker__dropdown">
                              {tplList.length === 0 ? (
                                <div className="si-tpl-picker__empty">
                                  {tplLoaded ? "No templates yet" : "Loading…"}
                                </div>
                              ) : (
                                tplList.map((t) => (
                                  <button
                                    key={t.id}
                                    className="si-tpl-picker__item"
                                    onMouseDown={() => applyReplyTemplate(t)}
                                  >
                                    <span className="si-tpl-picker__name">{t.name}</span>
                                    {t.subject && (
                                      <span className="si-tpl-picker__subject">{t.subject}</span>
                                    )}
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="si-composer__actions-right">
                        <button
                          className="si-btn"
                          onClick={handleCancelReply}
                        >
                          Cancel
                        </button>
                        <button
                          className="si-btn si-btn--send"
                          onClick={handleSendReply}
                          disabled={replySending || !replyDraft || replyFiles.some((f) => f.uploading)}
                        >
                          {replySending ? "Sending…" : "Send Reply"}
                        </button>
                      </div>
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
                style={{ background: detail.deletedAt ? "#95a5a6" : STATUS_COLORS[detail.status] }}
              >
                {detail.deletedAt ? "Deleted" : STATUS_LABELS[detail.status]}
              </span>
              {!detail.deletedAt && detail.status === "OPEN" && (
                <button
                  className="si-btn si-btn--claim"
                  onClick={() => claimThread(detail.id)}
                >
                  Claim
                </button>
              )}
              {!detail.deletedAt && ["OPEN", "CLAIMED", "WAITING"].includes(detail.status) && (
                <button
                  className="si-btn si-btn--close"
                  onClick={() =>
                    updateThread(detail.id, { status: "CLOSED" })
                  }
                >
                  Close
                </button>
              )}
              {!detail.deletedAt && detail.status === "CLOSED" && (
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

            {/* Trash actions */}
            {detail.deletedAt && (
              <div className="si-sidebar__row" style={{ marginTop: 8 }}>
                <button
                  className="si-btn si-btn--reopen"
                  onClick={() => handleRestore(detail.id)}
                >
                  Restore
                </button>
                {isAdmin && (
                  <button
                    className="si-btn si-btn--danger"
                    onClick={() => handlePermanentDelete(detail.id)}
                  >
                    Delete Permanently
                  </button>
                )}
              </div>
            )}

            {/* Soft delete button — visible when not already deleted */}
            {!detail.deletedAt && (
              <div style={{ marginTop: 8 }}>
                <button
                  className="si-btn si-btn--small si-btn--danger"
                  onClick={() => handleSoftDelete(detail.id)}
                >
                  Delete Thread
                </button>
              </div>
            )}
          </div>

          {/* Add Note — separate from Reply */}
          {detail.status !== "CLOSED" && !detail.deletedAt && (
            <div className="si-sidebar__section">
              <button
                className={`si-btn si-btn--add-note${noteOpen ? " si-btn--add-note-active" : ""}`}
                onClick={() => setNoteOpen(!noteOpen)}
              >
                {noteOpen ? "Writing note…" : "＋ Add Note"}
              </button>
            </div>
          )}

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

          {/* Contact History */}
          {detail.contactHistory && detail.contactHistory.length > 0 && (
            <div className="si-sidebar__section">
              <div className="si-sidebar__label">
                Conversation History
              </div>
              <div className="si-sidebar__meta" style={{ marginBottom: 8 }}>
                {detail.contactHistory.length} other thread{detail.contactHistory.length === 1 ? "" : "s"} with{" "}
                {detail.senderName || detail.senderEmail}
              </div>
              <div className="si-contact-history">
                {detail.contactHistory.map((ct) => (
                  <button
                    key={ct.id}
                    className="si-contact-history__item"
                    onClick={() => selectThread(ct.id)}
                  >
                    <span className="si-contact-history__subject">{ct.subject}</span>
                    <span className="si-contact-history__meta">
                      <span
                        className="si-status-dot"
                        style={{ background: STATUS_COLORS[ct.status] }}
                        title={STATUS_LABELS[ct.status]}
                      />
                      {fmtDate(ct.lastMessageAt)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Compose new email modal ── */}
      {composeOpen && (
        <div className="si-modal-overlay" onClick={handleCancelCompose}>
          <div className="si-modal" onClick={(e) => e.stopPropagation()}>
            <div className="si-modal__header">
              <h3 className="si-modal__title">New Email</h3>
              <button className="si-modal__close" onClick={handleCancelCompose}>×</button>
            </div>

            <div className="si-modal__body">
              {/* From */}
              <div className="si-modal__field">
                <label className="si-modal__label">From</label>
                <div className="si-modal__static">{connectedEmail}</div>
              </div>

              {/* To — with typeahead */}
              <div className="si-modal__field">
                <label className="si-modal__label">To</label>
                <div className="si-modal__to-wrap">
                  <input
                    type="text"
                    className="si-modal__input"
                    value={composeTo}
                    onChange={(e) => searchContacts(e.target.value)}
                    onBlur={() => setTimeout(() => setContactsOpen(false), 200)}
                    placeholder="Name or email address"
                    autoFocus
                  />
                  {contactsOpen && contactResults.length > 0 && (
                    <div className="si-modal__dropdown">
                      {contactResults.map((c) => (
                        <button
                          key={c.id}
                          className="si-modal__dropdown-item"
                          onMouseDown={() => selectContact(c.email)}
                        >
                          <span className="si-modal__dropdown-name">{c.name}</span>
                          <span className="si-modal__dropdown-email">{c.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div className="si-modal__field">
                <label className="si-modal__label">Subject</label>
                <input
                  type="text"
                  className="si-modal__input"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Subject"
                />
              </div>

              {/* Body */}
              <div className="si-modal__field si-modal__field--editor">
                <RimProseEditor
                  key="compose-editor"
                  value={composeDraft}
                  onChange={setComposeDraft}
                  placeholder="Write your message…"
                  minHeight={200}
                />
              </div>

              {/* Staged attachments */}
              {composeFiles.length > 0 && (
                <div className="si-staged-files">
                  {composeFiles.map((sf, idx) => (
                    <div key={idx} className={`si-staged-file${sf.error ? " si-staged-file--error" : ""}`}>
                      <span className="si-staged-file__icon">📎</span>
                      <span className="si-staged-file__name">{sf.file.name}</span>
                      <span className="si-staged-file__size">{fmtFileSize(sf.file.size)}</span>
                      {sf.uploading && <span className="si-staged-file__status">Uploading…</span>}
                      {sf.error && <span className="si-staged-file__status si-staged-file__status--error">{sf.error}</span>}
                      <button
                        className="si-staged-file__remove"
                        onClick={() => removeComposeFile(idx)}
                        title="Remove"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
              {composeFileError && (
                <div className="si-composer__error">{composeFileError}</div>
              )}
            </div>

            <div className="si-modal__footer">
              <div className="si-composer__actions-left">
                <input
                  ref={composeFileRef}
                  type="file"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => handleComposeAddFiles(e.target.files)}
                />
                <button
                  className="si-btn si-btn--attach"
                  onClick={() => composeFileRef.current?.click()}
                  title="Attach file"
                  type="button"
                >📎</button>
                <div className="si-tpl-picker">
                  <button
                    className="si-btn si-btn--template"
                    onClick={() => {
                      fetchTemplates();
                      setComposeTplOpen(!composeTplOpen);
                    }}
                    type="button"
                  >
                    Use Template
                  </button>
                  {composeTplOpen && (
                    <div className="si-tpl-picker__dropdown si-tpl-picker__dropdown--up">
                      {tplList.length === 0 ? (
                        <div className="si-tpl-picker__empty">
                          {tplLoaded ? "No templates yet" : "Loading…"}
                        </div>
                      ) : (
                        tplList.map((t) => (
                          <button
                            key={t.id}
                            className="si-tpl-picker__item"
                            onMouseDown={() => applyComposeTemplate(t)}
                          >
                            <span className="si-tpl-picker__name">{t.name}</span>
                            {t.subject && (
                              <span className="si-tpl-picker__subject">{t.subject}</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="si-composer__actions-right">
                <button className="si-btn" onClick={handleCancelCompose}>Cancel</button>
                <button
                  className="si-btn si-btn--send"
                  onClick={handleSendCompose}
                  disabled={composeSending || !composeTo || !composeSubject || !composeDraft || composeFiles.some((f) => f.uploading)}
                >
                  {composeSending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
