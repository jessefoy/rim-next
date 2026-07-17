"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, FileText, MessageSquare, UserPlus } from "lucide-react";
import type { HubActivityFilter, HubActivityItem } from "@/lib/hubActivity";

interface ActivityPageState {
  items: HubActivityItem[];
  nextCursor: string | null;
  loaded: boolean;
}

interface Props {
  hubSlug: string;
  initialItems: HubActivityItem[];
  initialNextCursor: string | null;
  initialFilter: HubActivityFilter;
  newSince: string | null;
}

type ActivityView = "recent" | "category";

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

function ItemIcon({ sourceKey }: { sourceKey: HubActivityItem["sourceKey"] }) {
  const common = { size: 17, strokeWidth: 1.75, className: "hub-act-item__icon" };
  if (sourceKey === "files") return <FileText {...common} />;
  if (sourceKey === "members") return <UserPlus {...common} />;
  if (sourceKey.startsWith("app:")) return <CalendarDays {...common} />;
  return <MessageSquare {...common} />;
}

const FILTERS: { key: HubActivityFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "for-me", label: "For me" },
];

function categoryLabel(item: HubActivityItem): string {
  if (item.sourceKey === "conversations") return "Conversations";
  if (item.sourceKey === "files") return "Files";
  if (item.sourceKey === "members") return "Members";
  return item.sourceLabel;
}

function groupByCategory(items: HubActivityItem[]) {
  const groups = new Map<string, { label: string; items: HubActivityItem[] }>();
  for (const item of items) {
    const existing = groups.get(item.sourceKey);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(item.sourceKey, { label: categoryLabel(item), items: [item] });
    }
  }
  return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
}

function ActivityItemRow({
  item,
  showNew,
}: {
  item: HubActivityItem;
  showNew: boolean;
}) {
  return (
    <li className="hub-act__item">
      <Link href={item.href} className="hub-act__item-link">
        <ItemIcon sourceKey={item.sourceKey} />
        <span className="hub-act__item-content">
          <span className="hub-act__item-source">
            {item.sourceLabel}
            {showNew && item.isNew && <span className="hub-act__item-new">New</span>}
          </span>
          <span className="hub-act__item-label">
            <strong>{item.authorName}</strong> {item.verb}
            {item.subject && <> <em>{item.subject}</em></>}
          </span>
        </span>
        <span className="hub-act__item-time">{relativeTime(item.ts)}</span>
      </Link>
    </li>
  );
}

export default function HubActivityClient({
  hubSlug,
  initialItems,
  initialNextCursor,
  initialFilter,
  newSince,
}: Props) {
  const emptyState = (): ActivityPageState => ({ items: [], nextCursor: null, loaded: false });
  const [filter, setFilter] = useState<HubActivityFilter>(initialFilter);
  const [view, setView] = useState<ActivityView>("recent");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Record<HubActivityFilter, ActivityPageState>>({
    all: initialFilter === "all" ? { items: initialItems, nextCursor: initialNextCursor, loaded: true } : emptyState(),
    new: initialFilter === "new" ? { items: initialItems, nextCursor: initialNextCursor, loaded: true } : emptyState(),
    "for-me": initialFilter === "for-me" ? { items: initialItems, nextCursor: initialNextCursor, loaded: true } : emptyState(),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const current = pages[filter];
  const categoryGroups = groupByCategory(current.items);

  useEffect(() => {
    if (!viewMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(event.target as Node)) {
        setViewMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [viewMenuOpen]);

  async function fetchPage(nextFilter: HubActivityFilter, cursor?: string | null) {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ limit: "30", filter: nextFilter });
      if (cursor) qs.set("cursor", cursor);
      if (newSince) qs.set("newSince", newSince);
      const res = await fetch(`/api/hub/${hubSlug}/activity?${qs}`);
      if (!res.ok) throw new Error("Updates could not be loaded.");
      const data = await res.json() as { items: HubActivityItem[]; nextCursor: string | null };
      setPages((prev) => {
        const existing = cursor ? prev[nextFilter].items : [];
        const ids = new Set(existing.map((item) => item.id));
        return {
          ...prev,
          [nextFilter]: {
            items: [...existing, ...data.items.filter((item) => !ids.has(item.id))],
            nextCursor: data.nextCursor,
            loaded: true,
          },
        };
      });
    } catch {
      setError("Updates couldn’t be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function changeFilter(next: HubActivityFilter) {
    setFilter(next);
    if (!pages[next].loaded) void fetchPage(next);
  }

  const emptyCopy = filter === "new"
    ? "You’re caught up."
    : filter === "for-me"
      ? "Nothing needs your attention here."
      : "No updates yet.";

  return (
    <div className="hub-act">
      <header className="hub-act__header">
        <div>
          <h1 className="hub-act__title">Updates</h1>
          <p className="hub-act__intro">Meaningful changes from Conversations, Files, Members, and this Space’s apps.</p>
        </div>
        <div className="hub-act__controls">
          <div className="hub-act__filters" role="group" aria-label="Filter updates">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`hub-act__filter${filter === item.key ? " hub-act__filter--active" : ""}`}
                onClick={() => changeFilter(item.key)}
                aria-pressed={filter === item.key}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="hub-act__view" ref={viewMenuRef}>
            <span className="hub-act__view-label">View</span>
            <div className="hub-act__view-picker">
              <button
                type="button"
                className="hub-act__view-button"
                aria-haspopup="menu"
                aria-expanded={viewMenuOpen}
                onClick={() => setViewMenuOpen((open) => !open)}
              >
                <span>{view === "recent" ? "Recent" : "By category"}</span>
                <span className="hub-act__view-caret" aria-hidden="true">▾</span>
              </button>
              {viewMenuOpen && (
                <div className="hub-act__view-menu" role="menu" aria-label="Organize updates">
                  <button
                    type="button"
                    role="menuitem"
                    className={`hub-act__view-option${view === "recent" ? " hub-act__view-option--active" : ""}`}
                    onClick={() => {
                      setView("recent");
                      setViewMenuOpen(false);
                    }}
                  >
                    Recent
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={`hub-act__view-option${view === "category" ? " hub-act__view-option--active" : ""}`}
                    onClick={() => {
                      setView("category");
                      setViewMenuOpen(false);
                    }}
                  >
                    By category
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {error && <p className="hub-act__error" role="alert">{error}</p>}

      {loading && !current.loaded ? (
        <p className="hub-act__empty">Loading updates…</p>
      ) : current.items.length === 0 ? (
        <p className="hub-act__empty">{emptyCopy}</p>
      ) : view === "recent" ? (
        <ul className="hub-act__list">
          {current.items.map((item) => (
            <ActivityItemRow key={item.id} item={item} showNew={filter === "all"} />
          ))}
        </ul>
      ) : (
        <div className="hub-act__groups">
          {categoryGroups.map((group) => (
            <section key={group.key} className="hub-act__group">
              <header className="hub-act__group-header">
                <h2 className="hub-act__group-title">{group.label}</h2>
                <span className="hub-act__group-count">
                  {group.items.length} {group.items.length === 1 ? "update" : "updates"}
                </span>
              </header>
              <ul className="hub-act__list hub-act__list--grouped">
                {group.items.map((item) => (
                  <ActivityItemRow key={item.id} item={item} showNew={filter === "all"} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {current.nextCursor && (
        <button
          type="button"
          className="hub-act__load-more"
          onClick={() => void fetchPage(filter, current.nextCursor)}
          disabled={loading}
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
