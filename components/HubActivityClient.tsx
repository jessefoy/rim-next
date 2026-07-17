"use client";

import { useState } from "react";
import Link from "next/link";
import { Briefcase, CornerDownRight, FileText, MessageSquare, UserPlus } from "lucide-react";
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

function ItemIcon({ type }: { type: HubActivityItem["type"] }) {
  const common = { size: 16, strokeWidth: 1.75, className: "hub-act-item__icon" };
  if (type === "reply") return <CornerDownRight {...common} />;
  if (type === "file") return <FileText {...common} />;
  if (type === "member") return <UserPlus {...common} />;
  if (type === "app") return <Briefcase {...common} />;
  return <MessageSquare {...common} />;
}

const FILTERS: { key: HubActivityFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "My activity" },
];

export default function HubActivityClient({ hubSlug, initialItems, initialNextCursor }: Props) {
  const [filter, setFilter] = useState<HubActivityFilter>("all");
  const [pages, setPages] = useState<Record<HubActivityFilter, ActivityPageState>>({
    all: { items: initialItems, nextCursor: initialNextCursor, loaded: true },
    mine: { items: [], nextCursor: null, loaded: false },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const current = pages[filter];

  async function fetchPage(nextFilter: HubActivityFilter, cursor?: string | null) {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ limit: "30" });
      if (nextFilter === "mine") qs.set("mine", "true");
      if (cursor) qs.set("cursor", cursor);
      const res = await fetch(`/api/hub/${hubSlug}/activity?${qs}`);
      if (!res.ok) throw new Error("Activity could not be loaded.");
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
      setError("Activity couldn’t be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function changeFilter(next: HubActivityFilter) {
    setFilter(next);
    if (!pages[next].loaded) void fetchPage(next);
  }

  return (
    <div className="hub-act">
      <header className="hub-act__header">
        <div>
          <h1 className="hub-act__title">Activity</h1>
          <p className="hub-act__intro">Conversations, files, and people — in one shared history.</p>
        </div>
        <div className="hub-act__filters" role="group" aria-label="Filter activity">
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
      </header>

      {error && <p className="hub-act__error" role="alert">{error}</p>}

      {loading && !current.loaded ? (
        <p className="hub-act__empty">Loading activity…</p>
      ) : current.items.length === 0 ? (
        <p className="hub-act__empty">
          {filter === "mine" ? "You haven’t added anything here yet." : "No activity yet."}
        </p>
      ) : (
        <ul className="hub-act__list">
          {current.items.map((item) => (
            <li key={item.id} className="hub-act__item">
              <Link href={item.href} className="hub-act__item-link">
                <ItemIcon type={item.type} />
                <span className="hub-act__item-label">
                  <strong>{item.authorName}</strong> {item.verb}
                  {item.subject && <> <em>{item.subject}</em></>}
                </span>
                <span className="hub-act__item-time">{relativeTime(item.ts)}</span>
              </Link>
            </li>
          ))}
        </ul>
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
