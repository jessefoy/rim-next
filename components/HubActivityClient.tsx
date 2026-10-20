"use client";

/**
 * A team's Updates, read like an inbox (2026-10-19, Jesse: "read it like an
 * inbox and by type… it should also go to the item specifically").
 *
 * Types are folders in plain sight (For you, Everything, then each kind), each
 * with what's unread. "Needs you" sits on top: what the viewer could take now,
 * taken right here with the Scheduler's own rules and words. Below, what
 * happened, by day, each row one sentence that opens the exact thing. Opening
 * marks it read; nothing ever leaves Everything. Server: lib/hubActivity.ts.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, FileText, MessageSquare, UserPlus } from "lucide-react";
import type {
  HubActivityItem,
  HubActivitySourceKey,
  HubActivitySourceOption,
} from "@/lib/hubActivity";
import { useArrival } from "@/components/FormDone";
import { FilterPills, ViewPicker } from "@/components/FilterBar";

const TZ = "America/Chicago";
const NEEDS_SHOWN = 3;

interface Counts {
  forYou: number;
  all: number;
  bySource: Partial<Record<HubActivitySourceKey, number>>;
}

interface Props {
  hubSlug: string;
  initialItems: HubActivityItem[];
  initialNextCursor: string | null;
  initialScope: Scope;
  initialType: TypeKey;
  needs: HubActivityItem[];
  counts: Counts;
  sourceOptions: HubActivitySourceOption[];
  /** A guiding teacher looking in on a team they aren't on has no read state. */
  hasReadState: boolean;
  isLead: boolean;
  /** When the page was built: "Mark all as read" covers what was on screen. */
  loadedAt: string;
}

interface PageState {
  items: HubActivityItem[];
  nextCursor: string | null;
  loaded: boolean;
}

/** Which items: all, those for you, or unread. */
export type Scope = "all" | "for-you" | "unread";
/** Which kind: everything, or one type. */
export type TypeKey = "all" | HubActivitySourceKey;

function pageKey(scope: Scope, type: TypeKey) {
  return `${scope}:${type}`;
}

function ItemIcon({ sourceKey }: { sourceKey: HubActivitySourceKey }) {
  const common = { size: 18, strokeWidth: 1.75, className: "hub-inbox__icon", "aria-hidden": true };
  if (sourceKey === "files") return <FileText {...common} />;
  if (sourceKey === "members") return <UserPlus {...common} />;
  if (sourceKey.startsWith("app:")) return <CalendarDays {...common} />;
  return <MessageSquare {...common} />;
}

/** The Central day of a moment, "YYYY-MM-DD". */
function centralDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** "Today", "Yesterday", "Monday" (this week), else "October 12". */
export function dayHeading(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const day = centralDay(d);
  if (day === centralDay(now)) return "Today";
  if (day === centralDay(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  if (now.getTime() - d.getTime() < 6 * 86_400_000) {
    return d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "long" });
  }
  const sameYear = d.toLocaleDateString("en-US", { timeZone: TZ, year: "numeric" }) ===
    now.toLocaleDateString("en-US", { timeZone: TZ, year: "numeric" });
  return d.toLocaleDateString("en-US", { timeZone: TZ, month: "long", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

function sessionWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" })} at ${timeOf(iso)}`;
}

function groupByDay(items: HubActivityItem[]) {
  const groups: { heading: string; items: HubActivityItem[] }[] = [];
  for (const item of items) {
    const heading = dayHeading(item.ts);
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) last.items.push(item);
    else groups.push({ heading, items: [item] });
  }
  return groups;
}

/** Tell the server these were opened. Survives the navigation that follows. */
function sendRead(hubSlug: string, body: { keys: string[]; all?: boolean; asOf?: string }) {
  return fetch(`/api/hub/${hubSlug}/activity/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  });
}

function Sentence({ item }: { item: HubActivityItem }) {
  return (
    <span className="hub-inbox__sentence">
      {item.authorName && <strong>{item.authorName}</strong>}
      {item.verb && <> {item.verb}</>}
      {item.subject && <> <strong className="hub-inbox__what">{item.subject}</strong></>}
    </span>
  );
}

function StateChip({ state }: { state: HubActivityItem["state"] }) {
  if (!state) return null;
  return <span className={`hub-inbox__state hub-inbox__state--${state.tone}`}>{state.label}</span>;
}

function HistoryRow({ item, onOpen }: { item: HubActivityItem; onOpen: (item: HubActivityItem) => void }) {
  return (
    <li className={`hub-inbox__row${item.unread ? " hub-inbox__row--unread" : ""}`}>
      <Link href={item.href} className="hub-inbox__row-link" onClick={() => onOpen(item)}>
        <span className="hub-inbox__dot" aria-hidden="true" />
        <ItemIcon sourceKey={item.sourceKey} />
        <span className="hub-inbox__body">
          <span className="hub-inbox__meta">
            {item.unread && <span className="rim-sr-only">Unread. </span>}
            <span className="hub-inbox__type">{item.sourceLabel}</span>
            {item.leadsOnly && <span className="hub-inbox__leads">Leads only</span>}
          </span>
          <Sentence item={item} />
          {(item.state || item.note) && (
            <span className="hub-inbox__after">
              <StateChip state={item.state} />
              {item.note && <span className="hub-inbox__note">{item.note}</span>}
            </span>
          )}
        </span>
        <span className="hub-inbox__time">{timeOf(item.ts)}</span>
      </Link>
    </li>
  );
}

type NeedPhase =
  | { kind: "idle" }
  | { kind: "confirm" }
  | { kind: "working" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

export function NeedCard({
  item,
  onOpen,
  onTaken,
}: {
  item: HubActivityItem;
  onOpen: (item: HubActivityItem) => void;
  onTaken: (item: HubActivityItem) => void;
}) {
  const [phase, setPhase] = useState<NeedPhase>({ kind: "idle" });
  const answerRef = useArrival<HTMLParagraphElement>(phase.kind, phase.kind === "done");
  const confirmRef = useRef<HTMLParagraphElement>(null);
  const mainButtonRef = useRef<HTMLButtonElement>(null);
  const lastPhase = useRef<NeedPhase["kind"]>("idle");
  const action = item.action ?? null;

  // Focus follows the step: into the question, and back to the button when
  // the question closes ("Not now", or a problem to try again from).
  useEffect(() => {
    if (phase.kind === "confirm") confirmRef.current?.focus();
    else if ((phase.kind === "idle" || phase.kind === "error") && (lastPhase.current === "confirm" || lastPhase.current === "working")) {
      mainButtonRef.current?.focus();
    }
    lastPhase.current = phase.kind;
  }, [phase.kind]);

  async function take() {
    if (!action) return;
    setPhase({ kind: "working" });
    try {
      const res = action.kind === "cover" && action.subRequestId
        ? await fetch(`/api/host/sub-requests/${action.subRequestId}/claim`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
          })
        : await fetch(`/api/host/assignments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              programSlug: action.programSlug,
              sessionDate: action.sessionDate,
              action: "claim",
              hubSlug: action.hubSlug,
            }),
          });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "That didn't go through. Please try again.");
      }
      const when = sessionWhen(action.sessionDate);
      setPhase({
        kind: "done",
        message: action.kind === "cover"
          ? `You're covering for ${action.forName ?? "them"}: ${action.programName}, ${when}. We'll let them know, and email you a confirmation.`
          : `You're ${action.coverageVerb} ${action.programName}, ${when}. Thank you. We'll email you a confirmation.`,
      });
      onTaken(item);
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "That didn't go through. Please try again." });
    }
  }

  const buttonLabel = !action
    ? null
    : action.kind === "cover"
      ? "I'll cover this"
      : action.kind === "sign-up"
        ? `Sign up to ${action.coverageAction}`
        : "Take this session";

  return (
    <li className={`hub-inbox__need${item.unread ? " hub-inbox__need--unread" : ""}`}>
      <div className="hub-inbox__need-text">
        <span className="hub-inbox__meta">
          {item.unread && <span className="rim-sr-only">New. </span>}
          <span className="hub-inbox__dot" aria-hidden="true" />
          <span className="hub-inbox__type">{item.sourceLabel}</span>
        </span>
        <Sentence item={item} />
      </div>

      {phase.kind === "done" ? (
        <p className="hub-inbox__answer" role="status" tabIndex={-1} ref={answerRef}>{phase.message}</p>
      ) : phase.kind === "confirm" || (phase.kind === "working" && action?.kind !== "sign-up") ? (
        <div className="hub-inbox__confirm">
          <p className="hub-inbox__confirm-q" tabIndex={-1} ref={confirmRef}>
            {action?.kind === "cover"
              ? <>You&apos;ll cover for <strong>{action.forName ?? "the person who asked"}</strong> at <strong>{action.programName}</strong> on <strong>{sessionWhen(action.sessionDate)}</strong>. They&apos;ll be told you&apos;re stepping in.</>
              : action
                ? <><strong>{action.programName}</strong> on <strong>{sessionWhen(action.sessionDate)}</strong> will be yours. We&apos;ll email you a confirmation.</>
                : null}
          </p>
          <div className="hub-inbox__actions">
            <button type="button" className="btn" onClick={take} disabled={phase.kind === "working"}>
              {phase.kind === "working"
                ? "Saving…"
                : action?.kind === "cover" ? "Yes, I'll cover this" : `Yes, I'll ${action?.coverageAction ?? "take it"}`}
            </button>
            <button type="button" className="btn--ghost" onClick={() => setPhase({ kind: "idle" })} disabled={phase.kind === "working"}>
              Not now
            </button>
          </div>
        </div>
      ) : (
        <div className="hub-inbox__actions">
          {action && (
            <button
              ref={mainButtonRef}
              type="button"
              className="btn"
              disabled={phase.kind === "working"}
              // Open sign-up is one tap, as in the Scheduler; taking a seat asks first.
              onClick={() => (action.kind === "sign-up" ? void take() : setPhase({ kind: "confirm" }))}
            >
              {phase.kind === "working" ? "Saving…" : buttonLabel}
            </button>
          )}
          <Link href={item.href} className="hub-inbox__see" onClick={() => onOpen(item)}>
            See it in the Scheduler
          </Link>
        </div>
      )}
      {phase.kind === "error" && <p className="hub-inbox__problem" role="alert">{phase.message}</p>}
    </li>
  );
}

export default function HubActivityClient({
  hubSlug,
  initialItems,
  initialNextCursor,
  initialScope,
  initialType,
  needs: initialNeeds,
  counts: initialCounts,
  sourceOptions,
  hasReadState,
  isLead,
  loadedAt,
}: Props) {
  // The Scheduler's grammar (components/FilterBar.tsx): pills choose which
  // (All · For you · Unread), the View picker chooses the type.
  const [scope, setScope] = useState<Scope>(hasReadState ? initialScope : initialScope === "unread" ? "all" : initialScope);
  const [type, setType] = useState<TypeKey>(initialType);
  const [pages, setPages] = useState<Record<string, PageState>>({
    [pageKey(initialScope, initialType)]: { items: initialItems, nextCursor: initialNextCursor, loaded: true },
  });
  const [needs, setNeeds] = useState(initialNeeds);
  const [counts, setCounts] = useState(initialCounts);
  // Read keys marked here, so every loaded page agrees at once.
  const [readHere, setReadHere] = useState<Set<string>>(new Set());
  const [allReadAt, setAllReadAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [markNote, setMarkNote] = useState("");
  // Needs you shows the next three; the rest on request, so history stays in view.
  const [allNeeds, setAllNeeds] = useState(false);
  const pending = useRef(0);

  const current = pages[pageKey(scope, type)] ?? { items: [], nextCursor: null, loaded: false };

  const isUnread = (item: HubActivityItem) =>
    item.unread &&
    !item.readKeys.every((k) => readHere.has(k)) &&
    !(allReadAt !== null && !item.id.startsWith("need-") && new Date(item.ts).getTime() <= allReadAt);
  const view = (item: HubActivityItem): HubActivityItem => ({ ...item, unread: isUnread(item) });

  const shownNeeds = type === "all" || type === "app:schedule"
    // Unread by the server's word, so a card taken or opened here stays to
    // show its answer until the list is reloaded.
    ? needs.filter((n) => scope !== "unread" || n.unread).map(view)
    : [];
  // Read here stays on screen (plain, not bold) until the list is reloaded,
  // so nothing jumps out from under the person.
  const history = current.items.map(view);

  async function fetchPage(nextScope: Scope, nextType: TypeKey, cursor?: string | null) {
    pending.current += 1;
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        limit: "30",
        folder: nextScope === "for-you" ? "for-you" : nextType,
        show: nextScope === "unread" ? "unread" : "all",
      });
      if (nextScope === "for-you") qs.set("source", nextType);
      if (cursor) qs.set("cursor", cursor);
      const res = await fetch(`/api/hub/${hubSlug}/activity?${qs}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as { items: HubActivityItem[]; nextCursor: string | null };
      setPages((prev) => {
        const key = pageKey(nextScope, nextType);
        const existing = cursor ? (prev[key]?.items ?? []) : [];
        // A day's replies can straddle two pages: join them.
        const byId = new Map(existing.map((item) => [item.id, item]));
        for (const item of data.items) {
          const had = byId.get(item.id);
          byId.set(item.id, had
            ? { ...had, unread: had.unread || item.unread, readKeys: [...new Set([...had.readKeys, ...item.readKeys])] }
            : item);
        }
        return { ...prev, [key]: { items: [...byId.values()], nextCursor: data.nextCursor, loaded: true } };
      });
    } catch {
      setError("Updates couldn't be loaded. Check your connection and try again.");
    } finally {
      pending.current -= 1;
      if (pending.current === 0) setLoading(false);
    }
  }

  function choose(nextScope: Scope, nextType: TypeKey) {
    setScope(nextScope);
    setType(nextType);
    setMarkNote("");
    const qs = new URLSearchParams();
    if (nextScope !== "all") qs.set("show", nextScope);
    if (nextType !== "all") qs.set("type", nextType);
    const q = qs.toString();
    window.history.replaceState(null, "", `/account/hub/${hubSlug}/activity${q ? `?${q}` : ""}`);
    // Unread lists are fetched fresh each time: they change as you read.
    if (!pages[pageKey(nextScope, nextType)]?.loaded || nextScope === "unread") void fetchPage(nextScope, nextType);
  }

  function lowerCounts(item: HubActivityItem) {
    if (!isUnread(item)) return;
    setCounts((c) => {
      const isNeed = item.id.startsWith("need-");
      const bySource = { ...c.bySource };
      if (!isNeed) bySource[item.sourceKey] = Math.max(0, (bySource[item.sourceKey] ?? 0) - 1);
      return {
        forYou: item.isForUser ? Math.max(0, c.forYou - 1) : c.forYou,
        all: isNeed ? c.all : Math.max(0, c.all - 1),
        bySource,
      };
    });
  }

  function open(item: HubActivityItem) {
    if (!hasReadState || !isUnread(item)) return;
    lowerCounts(item);
    setReadHere((prev) => new Set([...prev, ...item.readKeys]));
    void sendRead(hubSlug, { keys: item.readKeys }).catch(() => {});
  }

  function taken(item: HubActivityItem) {
    open(item);
    // It leaves Needs you on the next visit; for now it shows its answer.
    setTimeout(() => setNeeds((prev) => prev.filter((n) => n.id !== item.id)), 60_000);
  }

  async function markAllRead() {
    setMarkNote("");
    const needKeys = needs.map((n) => n.id);
    try {
      const res = await sendRead(hubSlug, { keys: needKeys, all: true, asOf: loadedAt });
      if (!res.ok) throw new Error();
      setAllReadAt(new Date(loadedAt).getTime());
      setReadHere((prev) => new Set([...prev, ...needKeys]));
      setCounts({ forYou: 0, all: 0, bySource: {} });
      setMarkNote("Everything here is marked as read.");
    } catch {
      setMarkNote("That didn't go through. Please try again.");
    }
  }

  const unreadNeeds = needs.filter((n) => isUnread(n)).length;
  const typeOptions = [
    { key: "all" as TypeKey, label: "Everything", count: hasReadState ? counts.all : undefined, dividerAfter: true },
    ...sourceOptions.map((o) => ({
      key: o.key as TypeKey,
      label: o.label,
      count: hasReadState ? (counts.bySource[o.key] ?? 0) : undefined,
    })),
  ];
  const typeLabel = typeOptions.find((o) => o.key === type)?.label ?? "Everything";
  const anyUnread = counts.all > 0 || counts.forYou > 0;

  const emptyCopy = scope === "unread"
    ? `You're all caught up${type === "all" ? "" : ` on ${typeLabel.toLowerCase()}`}.`
    : scope === "for-you"
      ? "Nothing here is about you yet. When someone replies to a conversation you follow, comments on your file, or changes your sessions, it will show here."
      : type === "all"
        ? "Nothing has happened on this team yet."
        : `No ${typeLabel.toLowerCase()} updates yet.`;

  return (
    <div className="hub-act hub-inbox">
      <header className="hub-act__header hub-inbox__header">
        <div>
          <h1 className="hub-act__title">Updates</h1>
          <p className="hub-act__intro">
            {isLead
              ? "What's happening on the team, and what needs you. As a lead you also see who has stepped back from sessions."
              : "What's happening on the team, and what needs you."}
          </p>
        </div>
        {hasReadState && anyUnread && (
          <button type="button" className="btn--ghost hub-inbox__mark-all" onClick={() => void markAllRead()}>
            Mark all as read
          </button>
        )}
      </header>
      {markNote && <p className="hub-inbox__mark-note" role="status">{markNote}</p>}

      <div className="hub-inbox__main">
        <FilterPills
          label="Show updates"
          value={scope}
          onChange={(k) => choose(k, type)}
          options={[
            { key: "all" as Scope, label: "All" },
            { key: "for-you" as Scope, label: "For you", count: hasReadState ? counts.forYou : undefined },
            ...(hasReadState ? [{ key: "unread" as Scope, label: "Unread", count: counts.all + unreadNeeds }] : []),
          ]}
        >
          <ViewPicker
            label="View"
            menuLabel="Choose a kind of update"
            value={type}
            active={type !== "all"}
            onChoose={(k) => choose(scope, k)}
            options={typeOptions}
          />
        </FilterPills>

        {shownNeeds.length > 0 && (
          <section className="hub-inbox__section" aria-labelledby="hub-inbox-needs">
            <h2 id="hub-inbox-needs" className="hub-inbox__section-label">Needs you</h2>
            <p className="hub-inbox__section-sub">
              Sessions in the next two weeks that need someone. They leave this list once someone takes them.
            </p>
            <ul className="hub-inbox__needs">
              {(allNeeds ? shownNeeds : shownNeeds.slice(0, NEEDS_SHOWN)).map((item) => (
                <NeedCard key={item.id} item={item} onOpen={open} onTaken={taken} />
              ))}
            </ul>
            {shownNeeds.length > NEEDS_SHOWN && (
              <button
                type="button"
                className="btn--ghost hub-inbox__more"
                aria-expanded={allNeeds}
                onClick={() => setAllNeeds((v) => !v)}
              >
                {allNeeds ? "Show only the next three" : `Show all ${shownNeeds.length} sessions that need someone`}
              </button>
            )}
          </section>
        )}

        <section className="hub-inbox__section" aria-label={`${typeLabel}, ${scope === "for-you" ? "for you" : scope}`}>
          {error && <p className="hub-inbox__problem" role="alert">{error}</p>}
          {loading && !current.loaded ? (
            <p className="hub-inbox__empty">Loading updates…</p>
          ) : history.length === 0 ? (
            <p className="hub-inbox__empty">
              {current.nextCursor ? "Nothing here in the most recent stretch. Show earlier updates to keep looking." : emptyCopy}
            </p>
          ) : (
            groupByDay(history).map((group) => (
              <div key={group.heading} className="hub-inbox__day">
                <h2 className="hub-inbox__day-heading">{group.heading}</h2>
                <ul className="hub-inbox__list">
                  {group.items.map((item) => (
                    <HistoryRow key={item.id} item={item} onOpen={open} />
                  ))}
                </ul>
              </div>
            ))
          )}

          {current.nextCursor && (
            <button
              type="button"
              className="hub-act__load-more"
              onClick={() => void fetchPage(scope, type, current.nextCursor)}
              disabled={loading}
            >
              {loading ? "Loading…" : "Show earlier updates"}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
