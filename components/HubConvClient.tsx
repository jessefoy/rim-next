"use client";

/**
 * HubConvClient — Conversations list for all hubs.
 * CSS prefix: hub-conv-
 *
 * Layout:
 *   [Header: title · filter pills · "+ New" button]
 *   [Inline compose card, when opened]
 *   [Thread list — each row: avatar | title + excerpt + activity summary]
 *
 * Design notes:
 *   - Breathing space between rows
 *   - Pinned threads get a subtle left accent (not a separate section header)
 *   - Unread indicator (blue dot) is derived from `lastVisitedAt` compared to `updatedAt`
 *   - Coordinator actions appear on hover only
 *   - "+ New Topic" expands an inline card; focus lands on the subject field
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pin, X, Plus, MessageSquare, Pencil, Trash2, Check } from "lucide-react";
import dynamic from "next/dynamic";
const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div style={{ minHeight: 80 }} /> },
);
import { avatarColorFor } from "@/lib/avatarColor";

interface ThreadAuthor {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
}

interface Thread {
  id: string;
  title: string;
  body: any;
  category: string;
  status: string;
  isPinned: boolean;
  authorId: string;
  author: ThreadAuthor;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  hubSlug: string;
  initialThreads: Thread[];
  categories: string[];
  isCoordinator: boolean;
  currentUserId: string;
  currentUserName: string;
  lastVisitedAt: string | null;
}

function displayName(u: ThreadAuthor) {
  const first = u.preferredName || u.firstName;
  const full = [first, u.lastName].filter(Boolean).join(" ");
  return full || u.preferredName || u.firstName || u.lastName || "Someone";
}

function initialsOf(u: ThreadAuthor) {
  if (u.firstName && u.lastName) {
    return (u.firstName[0] + u.lastName[0]).toUpperCase();
  }
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

function extractText(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!Array.isArray(value)) return "";
  const inline = (content: any[] = []) => content.map((c: any) => c.text ?? "").join("");
  const blockText = (b: any): string =>
    [inline(b.content), ...(b.children || []).map(blockText)].filter(Boolean).join(" ");
  return value.map(blockText).filter(Boolean).join(" ");
}

function hasContent(value: any): boolean {
  return extractText(value).trim().length > 0;
}

function AddCategoryForm({
  onAdd,
  busy,
}: {
  onAdd: (name: string) => Promise<string | null>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState("");
  return (
    <form
      className="hub-conv-manage__add"
      onSubmit={async (e) => {
        e.preventDefault();
        const added = await onAdd(draft);
        if (added) setDraft("");
      }}
    >
      <input
        className="hub-conv-manage__input"
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Add a category"
        maxLength={40}
      />
      <button
        type="submit"
        className="btn--ghost hub-conv-manage__addbtn"
        disabled={busy || !draft.trim()}
      >
        Add
      </button>
    </form>
  );
}

export default function HubConvClient({
  hubSlug,
  initialThreads,
  categories,
  isCoordinator,
  currentUserId,
  currentUserName,
  lastVisitedAt,
}: Props) {
  const searchParams = useSearchParams();
  const newTopicParam = searchParams.get("newTopic") ?? "";

  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [categoryList, setCategoryList] = useState<string[]>(categories);
  const [showCompose, setShowCompose] = useState(!!newTopicParam);
  const [title, setTitle] = useState(newTopicParam);
  const [body, setBody] = useState<string>("");
  const [composeCategory, setComposeCategory] = useState(categories[0] ?? "General");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"open" | "closed">("open");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [loadingClosed, setLoadingClosed] = useState(false);
  const [closedThreads, setClosedThreads] = useState<Thread[] | null>(null);
  const [showManage, setShowManage] = useState(false);
  const [renamingCat, setRenamingCat] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [catError, setCatError] = useState<string | null>(null);
  const [catBusy, setCatBusy] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (showCompose) titleRef.current?.focus();
  }, [showCompose]);

  const hasMultipleCategories = categoryList.length > 1;

  async function addCategory(name: string): Promise<string | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    setCatBusy(true);
    setCatError(null);
    const res = await fetch(`/api/hub/${hubSlug}/categories`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: trimmed }),
    });
    setCatBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCatError(data?.error ?? "Could not add category");
      return null;
    }
    const data = await res.json();
    setCategoryList(data.categories);
    return trimmed;
  }

  async function renameCategory(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) {
      setRenamingCat(null);
      return;
    }
    setCatBusy(true);
    setCatError(null);
    const res = await fetch(`/api/hub/${hubSlug}/categories`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ oldName, newName: trimmed }),
    });
    setCatBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCatError(data?.error ?? "Could not rename category");
      return;
    }
    const data = await res.json();
    setCategoryList(data.categories);
    setRenamingCat(null);
    // Reflect rename on threads in view
    const remap = (t: Thread) =>
      t.category === oldName ? { ...t, category: trimmed } : t;
    setThreads((prev) => prev.map(remap));
    setClosedThreads((prev) => prev ? prev.map(remap) : null);
    if (filterCategory === oldName) setFilterCategory(trimmed);
    if (composeCategory === oldName) setComposeCategory(trimmed);
  }

  async function deleteCategory(name: string) {
    if (!window.confirm(
      `Delete "${name}"? Any topics in this category will move to a remaining category.`,
    )) return;
    setCatBusy(true);
    setCatError(null);
    const res = await fetch(
      `/api/hub/${hubSlug}/categories?name=${encodeURIComponent(name)}`,
      { method: "DELETE" },
    );
    setCatBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCatError(data?.error ?? "Could not delete category");
      return;
    }
    const data = await res.json();
    setCategoryList(data.categories);
    const reassigned: string = data.reassignedTo;
    const remap = (t: Thread) =>
      t.category === name ? { ...t, category: reassigned } : t;
    setThreads((prev) => prev.map(remap));
    setClosedThreads((prev) => prev ? prev.map(remap) : null);
    if (filterCategory === name) setFilterCategory(null);
    if (composeCategory === name) setComposeCategory(data.categories[0] ?? "General");
  }
  const visitedAt = lastVisitedAt ? new Date(lastVisitedAt).getTime() : 0;

  const displayed = view === "open" ? threads : (closedThreads ?? []);
  const filtered = filterCategory
    ? displayed.filter((t) => t.category === filterCategory)
    : displayed;
  const pinnedThreads = filtered.filter((t) => t.isPinned);
  const regularThreads = filtered.filter((t) => !t.isPinned);

  async function loadClosed() {
    if (closedThreads !== null) return;
    setLoadingClosed(true);
    const res = await fetch(`/api/hub/${hubSlug}/conversations?status=CLOSED`);
    if (res.ok) {
      const data = await res.json();
      setClosedThreads(
        data.map((t: any) => ({
          id:         t.id,
          title:      t.title,
          body:       t.body,
          category:   t.category ?? "General",
          status:     t.status,
          isPinned:   t.isPinned ?? false,
          authorId:   t.authorId,
          author:     t.author,
          replyCount: t._count?.replies ?? 0,
          createdAt:  t.createdAt,
          updatedAt:  t.updatedAt,
        }))
      );
    }
    setLoadingClosed(false);
  }

  async function postThread() {
    if (!title.trim() || !hasContent(body)) return;
    setSaving(true);
    const res = await fetch(`/api/hub/${hubSlug}/conversations`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ title: title.trim(), body, category: composeCategory }),
    });
    if (res.ok) {
      const t = await res.json();
      const thread: Thread = {
        id:         t.id,
        title:      t.title,
        body:       t.body,
        category:   t.category ?? composeCategory,
        status:     t.status,
        isPinned:   false,
        authorId:   t.authorId,
        author: {
          firstName:     null,
          lastName:      null,
          preferredName: currentUserName,
        },
        replyCount: 0,
        createdAt:  t.createdAt,
        updatedAt:  t.updatedAt,
      };
      setThreads((prev) => [thread, ...prev]);
      setTitle(""); setBody(""); setShowCompose(false);
    }
    setSaving(false);
  }

  async function setStatus(id: string, status: string) {
    const res = await fetch(`/api/hub/${hubSlug}/conversations/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    if (res.ok) {
      if (status === "OPEN") {
        const updated = await res.json();
        const thread: Thread = {
          id:         updated.id,
          title:      updated.title,
          body:       updated.body,
          category:   updated.category ?? "General",
          status:     updated.status,
          isPinned:   updated.isPinned ?? false,
          authorId:   updated.authorId,
          author:     updated.author,
          replyCount: updated._count?.replies ?? 0,
          createdAt:  updated.createdAt,
          updatedAt:  updated.updatedAt,
        };
        setThreads((prev) => [thread, ...prev]);
        setClosedThreads((prev) => prev ? prev.filter((t) => t.id !== id) : null);
      } else {
        setThreads((prev) => prev.filter((t) => t.id !== id));
        setClosedThreads(null);
      }
    }
  }

  async function togglePin(id: string, currentlyPinned: boolean) {
    const action = currentlyPinned ? "unpin" : "pin";
    const res = await fetch(`/api/hub/${hubSlug}/conversations/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action }),
    });
    if (res.ok) {
      const updateFn = (prev: Thread[]) =>
        prev.map((t) => t.id === id ? { ...t, isPinned: !currentlyPinned } : t);
      setThreads(updateFn);
      if (closedThreads) setClosedThreads((prev) => prev ? updateFn(prev) : null);
    }
  }

  function ThreadRow({ thread }: { thread: Thread }) {
    const excerpt = extractText(thread.body);
    const unread = visitedAt > 0 && new Date(thread.updatedAt).getTime() > visitedAt;
    const summary = thread.replyCount > 0
      ? `${thread.replyCount} ${thread.replyCount === 1 ? "reply" : "replies"} · ${relativeTime(thread.updatedAt)}`
      : `Started ${relativeTime(thread.createdAt)}`;
    const inits = initialsOf(thread.author);

    return (
      <div className={`hub-conv-row${thread.isPinned ? " hub-conv-row--pinned" : ""}${unread ? " hub-conv-row--unread" : ""}`}>
        <Link
          href={`/account/hub/${hubSlug}/conversations/${thread.id}`}
          className="hub-conv-row__link"
        >
          <div
            className="hub-conv-avatar"
            aria-hidden="true"
            style={{ background: avatarColorFor(inits) }}
          >
            {inits}
          </div>
          <div className="hub-conv-row__body">
            <div className="hub-conv-row__title-line">
              {thread.isPinned && <Pin size={13} className="hub-conv-row__pin" aria-label="Pinned" />}
              <span className="hub-conv-row__title">{thread.title}</span>
            </div>
            {excerpt && (
              <div className="hub-conv-row__excerpt">{excerpt}</div>
            )}
            <div className="hub-conv-row__meta">
              <span className="hub-conv-row__author">{displayName(thread.author)}</span>
              <span className="hub-conv-row__dot">·</span>
              <span className="hub-conv-row__summary">{summary}</span>
              {thread.category && hasMultipleCategories && (
                <>
                  <span className="hub-conv-row__dot">·</span>
                  <span className="hub-conv-row__cat">{thread.category}</span>
                </>
              )}
            </div>
          </div>
        </Link>
        {isCoordinator && (
          <div className="hub-conv-row__actions">
            <button
              className="hub-conv-iconbtn"
              onClick={() => togglePin(thread.id, thread.isPinned)}
              title={thread.isPinned ? "Unpin" : "Pin to top"}
              aria-label={thread.isPinned ? "Unpin" : "Pin to top"}
            >
              <Pin size={15} />
            </button>
            {thread.status === "OPEN" ? (
              <button
                className="hub-conv-iconbtn"
                onClick={() => setStatus(thread.id, "CLOSED")}
                title="Close thread"
                aria-label="Close thread"
              >
                <X size={16} />
              </button>
            ) : (
              <button
                className="hub-conv-iconbtn hub-conv-iconbtn--text"
                onClick={() => setStatus(thread.id, "OPEN")}
              >
                Reopen
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="hub-conv">
      {/* Header */}
      <header className="hub-conv__head">
        <h1 className="hub-conv__title">Conversations</h1>
        <div className="hub-conv__head-actions">
          <div className="hub-conv-segment" role="tablist" aria-label="View">
            <button
              role="tab"
              aria-selected={view === "open"}
              className={`hub-conv-segment__btn${view === "open" ? " hub-conv-segment__btn--active" : ""}`}
              onClick={() => setView("open")}
            >
              Open
            </button>
            <button
              role="tab"
              aria-selected={view === "closed"}
              className={`hub-conv-segment__btn${view === "closed" ? " hub-conv-segment__btn--active" : ""}`}
              onClick={() => { setView("closed"); loadClosed(); }}
            >
              Closed
            </button>
          </div>
          <button
            className="hub-conv-newbtn"
            onClick={() => setShowCompose((v) => !v)}
          >
            <Plus size={16} strokeWidth={2} />
            <span>New topic</span>
          </button>
        </div>
      </header>

      {/* Category filter + manage */}
      <div className="hub-conv__filter">
        {hasMultipleCategories && (
          <>
            <button
              className={`hub-conv-chip${!filterCategory ? " hub-conv-chip--active" : ""}`}
              onClick={() => setFilterCategory(null)}
            >
              All
            </button>
            {categoryList.map((cat) => (
              <button
                key={cat}
                className={`hub-conv-chip${filterCategory === cat ? " hub-conv-chip--active" : ""}`}
                onClick={() => setFilterCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </>
        )}
        <button
          className="hub-conv-chip hub-conv-chip--ghost"
          onClick={() => { setShowManage((v) => !v); setCatError(null); setRenamingCat(null); }}
          aria-label="Manage categories"
          aria-expanded={showManage}
          title="Manage categories"
        >
          <Pencil size={13} aria-hidden="true" />
          <span>Manage</span>
        </button>
      </div>

      {/* Manage categories panel */}
      {showManage && (
        <div className="hub-conv-manage">
          <div className="hub-conv-manage__head">
            <span className="hub-conv-manage__title">Categories</span>
            <button
              className="hub-conv-manage__close"
              onClick={() => { setShowManage(false); setRenamingCat(null); setCatError(null); }}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          {catError && <div className="hub-conv-manage__err">{catError}</div>}
          <ul className="hub-conv-manage__list">
            {categoryList.map((cat) => (
              <li key={cat} className="hub-conv-manage__row">
                {renamingCat === cat ? (
                  <>
                    <input
                      className="hub-conv-manage__input"
                      type="text"
                      value={renameDraft}
                      autoFocus
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameCategory(cat, renameDraft);
                        if (e.key === "Escape") setRenamingCat(null);
                      }}
                      maxLength={40}
                    />
                    <button
                      className="hub-conv-iconbtn"
                      onClick={() => renameCategory(cat, renameDraft)}
                      disabled={catBusy}
                      title="Save"
                      aria-label="Save"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      className="hub-conv-iconbtn"
                      onClick={() => setRenamingCat(null)}
                      title="Cancel"
                      aria-label="Cancel"
                    >
                      <X size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="hub-conv-manage__name">{cat}</span>
                    <button
                      className="hub-conv-iconbtn"
                      onClick={() => { setRenamingCat(cat); setRenameDraft(cat); setCatError(null); }}
                      title="Rename"
                      aria-label={`Rename ${cat}`}
                    >
                      <Pencil size={14} />
                    </button>
                    {isCoordinator && categoryList.length > 1 && (
                      <button
                        className="hub-conv-iconbtn"
                        onClick={() => deleteCategory(cat)}
                        disabled={catBusy}
                        title="Delete"
                        aria-label={`Delete ${cat}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          <AddCategoryForm onAdd={addCategory} busy={catBusy} />
          {!isCoordinator && (
            <p className="hub-conv-manage__note">
              Anyone on the team can add or rename categories. Coordinators can also delete.
            </p>
          )}
        </div>
      )}

      {/* Compose card */}
      {showCompose && (
        <div className="hub-conv-compose">
          <div className="hub-conv-compose__head">
            <span className="hub-conv-compose__label">New topic</span>
            <button
              className="hub-conv-compose__close"
              onClick={() => { setShowCompose(false); setTitle(""); setBody(""); }}
              aria-label="Cancel"
            >
              <X size={16} />
            </button>
          </div>
          <input
            ref={titleRef}
            className="hub-conv-compose__subject"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What would you like to discuss?"
          />
          <select
            className="hub-conv-compose__cat"
            value={composeCategory}
            onChange={async (e) => {
              const val = e.target.value;
              if (val === "__add__") {
                const name = window.prompt("New category name");
                if (name) {
                  const added = await addCategory(name);
                  if (added) setComposeCategory(added);
                }
                return;
              }
              setComposeCategory(val);
            }}
          >
            {categoryList.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
            <option value="__add__">+ Add new category…</option>
          </select>
          <div className="hub-conv-compose__editor">
            <RimTiptapEditor
              value={body}
              onChange={setBody}
              placeholder="Share your thoughts…"
              variant="message"
            />
          </div>
          <div className="hub-conv-compose__actions">
            <button
              className="btn--ghost"
              onClick={() => { setShowCompose(false); setTitle(""); setBody(""); }}
            >
              Cancel
            </button>
            <button
              className="btn"
              onClick={postThread}
              disabled={saving || !title.trim() || !hasContent(body)}
            >
              {saving ? "Posting…" : "Post topic"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loadingClosed ? (
        <div className="hub-conv__empty">Loading…</div>
      ) : displayed.length === 0 ? (
        <div className="hub-conv__empty">
          <MessageSquare size={36} strokeWidth={1.5} aria-hidden="true" />
          <p className="hub-conv__empty-title">
            {view === "open" ? "No conversations yet." : "No closed conversations."}
          </p>
          {view === "open" && (
            <p className="hub-conv__empty-sub">Start a topic to get the conversation going.</p>
          )}
        </div>
      ) : (
        <div className="hub-conv__list">
          {pinnedThreads.map((t) => <ThreadRow key={t.id} thread={t} />)}
          {regularThreads.map((t) => <ThreadRow key={t.id} thread={t} />)}
        </div>
      )}
    </div>
  );
}
