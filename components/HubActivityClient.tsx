"use client";

/**
 * HubActivityClient — the hub activity stream.
 * CSS prefix: hub-act-
 *
 * New conversation threads and replies in one chronological river (native
 * Documents were retired session 165). Filter pills: All / Mine.
 *
 * Each item shows: [icon] [label] — [author] · [relative time]; clicking
 * opens the conversation thread.
 */

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, CornerDownRight } from "lucide-react";

type ActivityItem =
  | { type: "hub_thread"; id: string; threadId: string; threadTitle: string; authorId: string; authorName: string; ts: string }
  | { type: "hub_reply";  id: string; threadId: string; threadTitle: string; authorId: string; authorName: string; ts: string };

type Filter = "all" | "mine";

interface Props {
  hubSlug: string;
  currentUserId: string;
  initialItems: ActivityItem[];
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

function ItemIcon({ type }: { type: ActivityItem["type"] }) {
  if (type === "hub_reply") {
    return <CornerDownRight size={15} strokeWidth={1.75} className="hub-act-item__icon hub-act-item__icon--reply" />;
  }
  return <MessageSquare size={15} strokeWidth={1.75} className="hub-act-item__icon hub-act-item__icon--conv" />;
}

function ItemLabel({ item }: { item: ActivityItem }) {
  switch (item.type) {
    case "hub_thread":
      return <><strong>{item.authorName}</strong> started <em>{item.threadTitle}</em></>;
    case "hub_reply":
      return <><strong>{item.authorName}</strong> replied to <em>{item.threadTitle}</em></>;
  }
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",  label: "All" },
  { key: "mine", label: "Mine" },
];

export default function HubActivityClient({ hubSlug, currentUserId, initialItems }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<ActivityItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const visible = items.filter((i) => (filter === "mine" ? i.authorId === currentUserId : true));

  async function loadMore() {
    if (!nextCursor || loading) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ cursor: nextCursor, limit: "30" });
      if (filter === "mine") qs.set("mine", "true");
      const res = await fetch(`/api/hub/${hubSlug}/activity?${qs}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems((prev) => {
        const ids = new Set(prev.map((i) => i.id));
        return [...prev, ...data.items.filter((i: ActivityItem) => !ids.has(i.id))];
      });
      setNextCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hub-act">
      <header className="hub-act__header">
        <h1 className="hub-act__title">Activity</h1>
        <div className="hub-act__filters" role="group" aria-label="Filter activity">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`hub-act__filter${filter === f.key ? " hub-act__filter--active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {visible.length === 0 ? (
        <p className="hub-act__empty">
          {filter === "mine" ? "Nothing here yet — your activity will appear as you post." : "No activity yet."}
        </p>
      ) : (
        <ul className="hub-act__list">
          {visible.map((item) => (
            <li key={item.id} className="hub-act__item">
              <Link href={`/account/hub/${hubSlug}/conversations/${item.threadId}`} className="hub-act__item-link">
                <ItemIcon type={item.type} />
                <span className="hub-act__item-label">
                  <ItemLabel item={item} />
                </span>
                <span className="hub-act__item-time">{relativeTime(item.ts)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {nextCursor && (
        <button
          className="hub-act__load-more"
          onClick={loadMore}
          disabled={loading}
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
