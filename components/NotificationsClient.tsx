"use client";

/**
 * A person's Notifications (2026-10-20). Jesse: "like text meets email,
 * where there's the right information with a dropdown… truly informative and
 * useful, not just having these features with checkboxes to organize… and
 * where they can go into the hub when they click them."
 *
 * Each row is one line, like a text: where it's from, what happened, when.
 * Tapping it opens the rest right there (the details, earlier notices about
 * the same thing) and one button that goes to it. Opening marks it read.
 * Filters are the shared grammar (components/FilterBar.tsx): All · Unread,
 * From (which team) and View (what kind: Schedule, Conversations, Files,
 * Programs, Your account; Jesse, 2026-10-20: categorized "just like in the
 * team hubs… like a big inbox"). Needs you, at the top, is what the person
 * could take now, from every team they're on.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilterPills, ViewPicker } from "@/components/FilterBar";
import { NeedCard, dayHeading, timeOf } from "@/components/HubActivityClient";
import type { HubActivityItem } from "@/lib/hubActivity";
import type { NoticeFacet, NoticeRow } from "@/lib/notifications";

interface Facets { sources: NoticeFacet[]; types: NoticeFacet[]; unread: number }

interface Props {
  initialRows: NoticeRow[];
  initialNextCursor: string | null;
  initialShow: "all" | "unread";
  initialSource: string;
  initialType: string;
  initialFacets: Facets;
  needs: HubActivityItem[];
  loadedAt: string;
}

/** A thread: notices about one thing on one day, newest first. */
interface Thread { key: string; rows: NoticeRow[] }

function threadsOf(rows: NoticeRow[]): { heading: string; threads: Thread[] }[] {
  const days: { heading: string; threads: Thread[] }[] = [];
  for (const row of rows) {
    const heading = dayHeading(row.ts);
    let day = days[days.length - 1];
    if (!day || day.heading !== heading) {
      day = { heading, threads: [] };
      days.push(day);
    }
    const key = row.threadKey ? `${row.threadKey}~${heading}` : row.id;
    const thread = day.threads.find((t) => t.key === key);
    if (thread) thread.rows.push(row);
    else day.threads.push({ key, rows: [row] });
  }
  return days;
}

/** The one button, named for where it goes. */
function goLabel(href: string): string {
  if (href.includes("/conversations/")) return "Open the conversation";
  if (href.startsWith("/account/files/")) return "Open the file";
  if (href.startsWith("/tools/schedule")) return "Open the schedule";
  if (href.startsWith("/programs/") || href.startsWith("/course/")) return "See the program";
  if (href.startsWith("/account/hub/")) return "Open the team";
  if (href.startsWith("/tools/programs")) return "Open the Program Manager";
  return "Open";
}

function ThreadRow({ thread, onOpen }: { thread: Thread; onOpen: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const latest = thread.rows[0];
  const unread = thread.rows.some((r) => r.unread);
  const more = thread.rows.length - 1;
  const panelId = `ib-${thread.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <li className={`hub-inbox__row ib-row${unread ? " hub-inbox__row--unread" : ""}`}>
      <button
        type="button"
        className="ib-row__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((v) => !v);
          if (unread) onOpen(thread.rows.filter((r) => r.unread).map((r) => r.id));
        }}
      >
        <span className="hub-inbox__dot" aria-hidden="true" />
        <span className="hub-inbox__body">
          <span className="hub-inbox__meta">
            {unread && <span className="rim-sr-only">Unread. </span>}
            <span className="hub-inbox__type">
              {latest.sourceLabel}
              {latest.typeLabel && latest.typeLabel !== latest.sourceLabel && <> · {latest.typeLabel}</>}
            </span>
            {more > 0 && <span className="ib-row__more">{more === 1 ? "1 more" : `${more} more`}</span>}
          </span>
          <span className="hub-inbox__sentence">{latest.title}</span>
        </span>
        <span className="hub-inbox__time">{timeOf(latest.ts)}</span>
        <span className="ib-row__caret" aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="ib-row__panel" id={panelId}>
          {thread.rows.map((r, i) => (
            <div key={r.id} className="ib-row__item">
              {(i > 0 || thread.rows.length > 1) && <p className="ib-row__item-title">{r.title} <span className="ib-row__item-time">{timeOf(r.ts)}</span></p>}
              {r.detail && <p className="ib-row__detail">{r.detail}</p>}
            </div>
          ))}
          <Link href={latest.href} className="btn ib-row__go">{goLabel(latest.href)}</Link>
        </div>
      )}
    </li>
  );
}

export default function NotificationsClient({
  initialRows,
  initialNextCursor,
  initialShow,
  initialSource,
  initialType,
  initialFacets,
  needs,
  loadedAt,
}: Props) {
  const [show, setShow] = useState<"all" | "unread">(initialShow);
  const [source, setSource] = useState(initialSource);
  const [type, setType] = useState(initialType);
  const [facets, setFacets] = useState(initialFacets);
  const [rows, setRows] = useState(initialRows);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [allNeeds, setAllNeeds] = useState(false);
  const router = useRouter();
  // Only the latest request's answer is shown (filters changed quickly).
  const latest = useRef(0);

  async function load(nextShow: "all" | "unread", nextSource: string, nextType: string, cursor?: string | null) {
    const ticket = ++latest.current;
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ show: nextShow, source: nextSource, type: nextType });
      if (cursor) qs.set("cursor", cursor);
      const res = await fetch(`/api/account/notifications?${qs}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { rows: NoticeRow[]; nextCursor: string | null; facets: Facets | null };
      if (ticket !== latest.current) return;
      setRows((prev) => (cursor ? [...prev, ...data.rows.filter((r) => !prev.some((p) => p.id === r.id))] : data.rows));
      setNextCursor(data.nextCursor);
      if (data.facets) setFacets(data.facets);
    } catch {
      if (ticket === latest.current) setError("Notifications couldn't be loaded. Check your connection and try again.");
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }

  function choose(nextShow: "all" | "unread", nextSource: string, nextType: string) {
    setShow(nextShow);
    setSource(nextSource);
    setType(nextType);
    setNote("");
    const qs = new URLSearchParams();
    if (nextShow !== "all") qs.set("show", nextShow);
    if (nextSource !== "all") qs.set("from", nextSource);
    if (nextType !== "all") qs.set("type", nextType);
    const q = qs.toString();
    window.history.replaceState(null, "", `/account/notifications${q ? `?${q}` : ""}`);
    void load(nextShow, nextSource, nextType);
  }

  function markRead(ids: string[]) {
    if (!ids.length) return;
    // The pickers' counts follow at once: each opened notice leaves its team's
    // and its type's count.
    const opened = rows.filter((r) => ids.includes(r.id) && r.unread);
    const less = (list: NoticeFacet[], keyOf: (r: NoticeRow) => string | null) =>
      list.map((f) => ({ ...f, unread: Math.max(0, f.unread - opened.filter((r) => keyOf(r) === f.key).length) }));
    setFacets((f) => ({
      sources: less(f.sources, (r) => r.sourceKey),
      types: less(f.types, (r) => f.types.find((t) => t.label === r.typeLabel)?.key ?? null),
      unread: Math.max(0, f.unread - opened.length),
    }));
    setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, unread: false } : r)));
    void fetch("/api/account/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
      keepalive: true,
    })
      // The rail's number follows.
      .then(() => router.refresh())
      .catch(() => {});
  }

  async function markAll() {
    setNote("");
    // If a filter changes while this is sent, that choice's own load wins.
    const ticket = latest.current;
    try {
      const res = await fetch("/api/account/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, asOf: loadedAt, source, type }),
      });
      if (!res.ok) throw new Error();
      setNote(source === "all" && type === "all" ? "Everything here is marked as read." : `Everything in ${shownLabel} is marked as read.`);
      // The rows and counts as they now stand.
      if (latest.current === ticket) void load(show, source, type);
      router.refresh();
    } catch {
      setNote("That didn't go through. Please try again.");
    }
  }

  const sourceOptions = [
    // Everything includes Programs and Your account, which aren't teams.
    { key: "all", label: "Everywhere", dividerAfter: true },
    ...facets.sources.map((s) => ({ key: s.key, label: s.label, count: s.unread })),
  ];
  const typeOptions = [
    { key: "all", label: "Everything", dividerAfter: true },
    ...facets.types.map((t) => ({ key: t.key, label: t.label, count: t.unread })),
  ];
  const sourceLabel = sourceOptions.find((o) => o.key === source)?.label ?? "Everywhere";
  const typeLabel = typeOptions.find((o) => o.key === type)?.label ?? "Everything";
  // What's on screen, in words: "Hosting Team", "Files", "Hosting Team: Files".
  const shownLabel = source === "all"
    ? typeLabel
    : type === "all" ? sourceLabel : `${sourceLabel}: ${typeLabel}`;
  const teamSlug = source.startsWith("team:") ? source.slice(5) : null;
  const shownNeeds = type !== "all" && type !== "schedule"
    ? []
    : teamSlug
      ? needs.filter((n) => (n.action?.hubSlug ?? new URLSearchParams(n.href.split("?")[1] ?? "").get("hub")) === teamSlug)
      : needs;
  const days = threadsOf(rows);

  const empty = show === "unread"
    ? `You're all caught up${source === "all" && type === "all" ? "" : ` in ${shownLabel}`}.`
    : source === "all" && type === "all"
      ? "Nothing yet. When there's news about your sessions, your teams, your programs or your account, it will be here, and in your email as before."
      : `Nothing in ${shownLabel} yet.`;

  return (
    <div className="ac-member-page ib">
      <header className="ac-page-head ib__head">
        <div>
          <h1 className="ac-page-title">Notifications</h1>
          <p className="ac-page-sub">News about you, your teams, your programs and your account. Tap one to read it.</p>
        </div>
        {facets.unread > 0 && (
          <button type="button" className="btn--ghost ib__mark-all" onClick={() => void markAll()}>
            Mark all as read
          </button>
        )}
      </header>
      {note && <p className="ib__note" role="status">{note}</p>}

      <FilterPills
        label="Show notifications"
        value={show}
        onChange={(k) => choose(k, source, type)}
        options={[
          { key: "all" as const, label: "All" },
          { key: "unread" as const, label: "Unread", count: facets.unread },
        ]}
      >
        {facets.sources.length > 0 && (
          <ViewPicker
            label="From"
            menuLabel="Choose a team"
            value={source}
            active={source !== "all"}
            onChoose={(k) => choose(show, k, type)}
            options={sourceOptions}
          />
        )}
        <ViewPicker
          label="View"
          menuLabel="Choose a kind of notification"
          value={type}
          active={type !== "all"}
          onChoose={(k) => choose(show, source, k)}
          options={typeOptions}
        />
      </FilterPills>

      {shownNeeds.length > 0 && (
        <section className="hub-inbox__section ib__section" aria-labelledby="ib-needs">
          <h2 id="ib-needs" className="hub-inbox__section-label">Needs you</h2>
          <p className="hub-inbox__section-sub">Sessions in the next two weeks your teams need someone for. They leave this list once someone takes them.</p>
          <ul className="hub-inbox__needs">
            {(allNeeds ? shownNeeds : shownNeeds.slice(0, 3)).map((item) => (
              <NeedCard key={item.id} item={item} onOpen={() => {}} onTaken={() => {}} />
            ))}
          </ul>
          {shownNeeds.length > 3 && (
            <button type="button" className="btn--ghost hub-inbox__more" aria-expanded={allNeeds} onClick={() => setAllNeeds((v) => !v)}>
              {allNeeds ? "Show only the next three" : `Show all ${shownNeeds.length} sessions that need someone`}
            </button>
          )}
        </section>
      )}

      <section className="hub-inbox__section ib__section" aria-label={source === "all" && type === "all" ? "Notifications" : `Notifications: ${shownLabel}`}>
        {error && <p className="hub-inbox__problem" role="alert">{error}</p>}
        {loading && rows.length === 0 ? (
          <p className="hub-inbox__empty">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="hub-inbox__empty">{empty}</p>
        ) : (
          days.map((day) => (
            <div key={day.heading} className="hub-inbox__day">
              <h2 className="hub-inbox__day-heading">{day.heading}</h2>
              <ul className="hub-inbox__list">
                {day.threads.map((t) => <ThreadRow key={t.key} thread={t} onOpen={markRead} />)}
              </ul>
            </div>
          ))
        )}
        {nextCursor && (
          <button type="button" className="btn--ghost hub-inbox__more" onClick={() => void load(show, source, type, nextCursor)} disabled={loading}>
            {loading ? "Loading…" : "Show earlier notifications"}
          </button>
        )}
      </section>
    </div>
  );
}
