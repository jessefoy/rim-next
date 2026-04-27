"use client";

/**
 * Host schedule — team agenda view with filters.
 *
 * Architecture:
 * - Default view shows the team's full upcoming schedule (collective awareness first).
 * - Filter pills narrow to: All / Needs help / Mine / My requests.
 * - Agenda rows grouped by week (this week, next week, week of X).
 * - One unified row design for every state — color accent + status text differs.
 * - Responsive: 4-column grid on desktop, stacked on phone.
 * - Email deep links: ?action=take|cover|cancel&id=… opens the matching modal.
 * - Cancel cover request: if I asked for help and changed my mind, undo it.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RimProseEditor from "@/components/RimProseEditor";
import { extractBlockNoteText } from "@/lib/renderRichContent";

interface Session {
  id: string;
  programId: string | null;
  programSlug: string;
  programName: string;
  sessionDate: string | null;
  status: "unclaimed" | "claimed" | "sub_needed";
  hostUserId: string | null;
  hostName: string | null;
  subRequestId: string | null;
  subMessage: any;
  programFormat: string | null;
  livekitRoom?: string | null;
}

interface Program {
  id: string | null;
  slug: string;
  name: string;
  programFormat: string | null;
}

interface Props {
  initialSessions: Session[];
  programs: Program[];
  initialYear: number;
  initialMonth: number;
  currentUserId: string;
  currentUserName: string;
  coordinatorName?: string;
  isHostManager?: boolean;
  apiBase?: string;
}

const TZ = "America/Chicago";
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type FilterKey = "all" | "needs" | "mine" | "my-requests";
type RowKind = "needs-host" | "needs-sub" | "mine" | "mine-asking" | "covered";

// ── Formatters ──────────────────────────────────────────────

function fmtDateLong(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: TZ,
  });
}
function fmtDateShort(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: TZ,
  });
}
function fmtTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: TZ,
  });
}
function fmtFormat(fmt: string | null): string {
  if (fmt === "virtual") return "Virtual";
  if (fmt === "hybrid") return "In-person and virtual";
  if (fmt === "in-person") return "In person";
  return "";
}

// ── Time helpers ────────────────────────────────────────────

function getCtNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}
function getTodayStart(): Date {
  const ct = getCtNow();
  ct.setHours(0, 0, 0, 0);
  return ct;
}
function getWeekStart(date: Date): Date {
  const ct = new Date(date.toLocaleString("en-US", { timeZone: TZ }));
  const dow = ct.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  ct.setDate(ct.getDate() + diff);
  ct.setHours(0, 0, 0, 0);
  return ct;
}
function getWeekLabel(weekStart: Date, todayWeekStart: Date): string {
  const diffDays = Math.round((weekStart.getTime() - todayWeekStart.getTime()) / 86400000);
  if (diffDays === 0) return "This week";
  if (diffDays === 7) return "Next week";
  if (diffDays === -7) return "Last week";
  return `Week of ${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function rowKind(s: Session, currentUserId: string): RowKind {
  if (s.hostUserId === currentUserId) {
    return s.subRequestId ? "mine-asking" : "mine";
  }
  if (s.status === "sub_needed") return "needs-sub";
  if (s.status === "unclaimed" || !s.hostUserId) return "needs-host";
  return "covered";
}

interface Bucket {
  weekStartMs: number;
  label: string;
  sessions: Session[];
}

function bucketByWeek(sessions: Session[]): Bucket[] {
  const todayWS = getWeekStart(new Date());
  const map = new Map<number, Session[]>();
  for (const s of sessions) {
    if (!s.sessionDate) continue;
    const ws = getWeekStart(new Date(s.sessionDate)).getTime();
    if (!map.has(ws)) map.set(ws, []);
    map.get(ws)!.push(s);
  }
  const sortByDate = (a: Session, b: Session) => {
    if (!a.sessionDate) return 1;
    if (!b.sessionDate) return -1;
    return new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime();
  };
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ws, list]) => ({
      weekStartMs: ws,
      label: getWeekLabel(new Date(ws), todayWS),
      sessions: list.slice().sort(sortByDate),
    }));
}

function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="hub-toast">{msg}</div>;
}

// ── Modal ───────────────────────────────────────────────────

type ModalKind = "take" | "cover" | "ask-cover" | "cancel-request" | "reassign" | null;

interface ModalProps {
  kind: ModalKind;
  session: Session | null;
  onConfirm: (extra?: any) => Promise<void> | void;
  onCancel: () => void;
  submitting: boolean;
}

function HsModal({ kind, session, onConfirm, onCancel, submitting }: ModalProps) {
  const [coverNote, setCoverNote] = useState<any>(null);

  useEffect(() => {
    if (kind === "ask-cover") setCoverNote(null);
  }, [kind, session?.id]);

  if (!kind || !session) return null;

  const dateStr = fmtDateLong(session.sessionDate);
  const timeStr = fmtTime(session.sessionDate);

  let title = "";
  let body: React.ReactNode = "";
  let primaryLabel = "";
  let extraInput: React.ReactNode = null;
  let cancelLabel = "Not yet";

  if (kind === "take") {
    title = "Confirm hosting";
    body = (
      <>You'll host <strong>{session.programName}</strong> on{" "}
      <strong>{dateStr}</strong> at <strong>{timeStr}</strong>. The team
      will be notified.</>
    );
    primaryLabel = "Yes, I'll host this";
  } else if (kind === "cover") {
    title = "Confirm covering";
    body = (
      <>You'll cover for <strong>{session.hostName ?? "the original host"}</strong>{" "}
      on <strong>{dateStr}</strong> for <strong>{session.programName}</strong>.
      They'll be notified that you're stepping in.</>
    );
    primaryLabel = "Yes, I'll cover this";
  } else if (kind === "ask-cover") {
    title = "Ask the team to cover";
    body = (
      <>Let your teammates know you can't make <strong>{dateStr}</strong> for{" "}
      <strong>{session.programName}</strong>. They'll receive an email and
      someone may step in.</>
    );
    primaryLabel = "Send to the team";
    extraInput = (
      <div className="hs-modal__field">
        <label className="hs-modal__field-label">Add a note (optional)</label>
        <RimProseEditor
          value={coverNote}
          onChange={setCoverNote}
          placeholder="Anything the replacement should know…"
          variant="compact"
        />
      </div>
    );
  } else if (kind === "cancel-request") {
    title = "Cancel your request?";
    body = (
      <>You'll go back to hosting <strong>{session.programName}</strong> on{" "}
      <strong>{dateStr}</strong> yourself. The team will know your request
      is closed.</>
    );
    primaryLabel = "Yes, cancel the request";
    cancelLabel = "Keep the request";
  } else if (kind === "reassign") {
    title = "Reassign to yourself";
    body = session.hostUserId
      ? (
        <>This will remove <strong>{session.hostName ?? "the current host"}</strong>{" "}
        from <strong>{session.programName}</strong> on <strong>{dateStr}</strong>{" "}
        and assign you. They will be notified. Any open cover request will be closed.</>
      )
      : (
        <>This will assign you to <strong>{session.programName}</strong> on{" "}
        <strong>{dateStr}</strong>.</>
      );
    primaryLabel = "Yes, reassign to me";
  }

  return (
    <div className="hs-modal-backdrop" onClick={onCancel}>
      <div className="hs-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="hs-modal__title">{title}</h2>
        <div className="hs-modal__body">{body}</div>
        {extraInput}
        <div className="hs-modal__actions">
          <button
            className="lr-btn lr-btn--host hs-modal__primary"
            onClick={() => onConfirm(kind === "ask-cover" ? coverNote : undefined)}
            disabled={submitting}
          >
            {submitting ? "Working…" : primaryLabel}
          </button>
          <button
            className="hs-modal__cancel"
            onClick={onCancel}
            disabled={submitting}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Agenda row ──────────────────────────────────────────────

interface RowProps {
  session: Session;
  kind: RowKind;
  onTake: (s: Session) => void;
  onCover: (s: Session) => void;
  onAskCover: (s: Session) => void;
  onCancelRequest: (s: Session) => void;
  onReassign: (s: Session) => void;
  isHostManager: boolean;
}

function HsRow({
  session, kind,
  onTake, onCover, onAskCover, onCancelRequest, onReassign,
  isHostManager,
}: RowProps) {
  const dateShort = fmtDateShort(session.sessionDate);
  const timeStr = fmtTime(session.sessionDate);
  const fmt = fmtFormat(session.programFormat);

  const showManagerReassign = isHostManager &&
    (kind === "needs-host" || kind === "needs-sub" || kind === "covered");

  let statusEl: React.ReactNode = null;
  let actionEl: React.ReactNode = null;

  switch (kind) {
    case "needs-host":
      statusEl = <span className="hs-row__status hs-row__status--needs">Needs a host</span>;
      actionEl = (
        <button className="lr-btn lr-btn--host" onClick={() => onTake(session)}>
          Yes, I can host
        </button>
      );
      break;
    case "needs-sub":
      statusEl = (
        <span className="hs-row__status hs-row__status--needs">
          {session.hostName ? `${session.hostName} needs help` : "Needs a sub"}
        </span>
      );
      actionEl = (
        <button className="lr-btn lr-btn--host" onClick={() => onCover(session)}>
          Yes, I can cover
        </button>
      );
      break;
    case "mine":
      statusEl = <span className="hs-row__status hs-row__status--mine">You're hosting</span>;
      actionEl = (
        <button className="hs-row__quiet" onClick={() => onAskCover(session)}>
          Ask the team to cover
        </button>
      );
      break;
    case "mine-asking":
      statusEl = <span className="hs-row__status hs-row__status--asking">You asked for cover</span>;
      actionEl = (
        <button className="hs-row__quiet" onClick={() => onCancelRequest(session)}>
          Cancel my request
        </button>
      );
      break;
    case "covered":
      statusEl = (
        <span className="hs-row__status hs-row__status--covered">
          Hosted by {session.hostName ?? "—"}
        </span>
      );
      break;
  }

  return (
    <div className={`hs-row hs-row--${kind}`}>
      <div className="hs-row__when">
        <div className="hs-row__date">{dateShort}</div>
        <div className="hs-row__time">{timeStr}</div>
      </div>
      <div className="hs-row__what">
        <div className="hs-row__name">{session.programName}</div>
        {fmt && <div className="hs-row__format">{fmt}</div>}
      </div>
      <div className="hs-row__who">{statusEl}</div>
      <div className="hs-row__do">
        {actionEl}
        {showManagerReassign && (
          <button className="hs-row__manager" onClick={() => onReassign(session)}>
            Reassign to me
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────

export default function HubScheduleClient({
  initialSessions, initialYear, initialMonth, currentUserId, currentUserName,
  isHostManager = false, apiBase = "/api/host",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [modal, setModal] = useState<{ kind: ModalKind; session: Session | null }>({ kind: null, session: null });
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const monthStr = `${y}-${String(m + 1).padStart(2, "0")}`;
      const res = await fetch(`${apiBase}/assignments?month=${monthStr}`);
      if (!res.ok) return;
      const data: Session[] = await res.json();
      setSessions(data);
    } catch {
      showToast("Couldn't load this month.");
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  // ── Deep-link handling ──
  // ?action=take&id=<sessionId>     — open take modal
  // ?action=cover&id=<subRequestId> — open cover modal
  // ?action=cancel&id=<subRequestId>— open cancel modal (own request only)
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current) return;
    const action = searchParams.get("action");
    const id = searchParams.get("id");
    if (!action || !id) return;
    deepLinkHandled.current = true;

    if (action === "take") {
      const s = sessions.find(x => x.id === id);
      if (s) {
        if (s.hostUserId === currentUserId) {
          showToast("You're already hosting this session.");
        } else if (s.status === "claimed" && !s.subRequestId) {
          showToast("This session already has a host.");
        } else {
          setModal({ kind: "take", session: s });
        }
      } else {
        showToast("We couldn't find that session.");
      }
    } else if (action === "cover") {
      const s = sessions.find(x => x.subRequestId === id);
      if (s) setModal({ kind: "cover", session: s });
      else showToast("This request is no longer open.");
    } else if (action === "cancel") {
      const s = sessions.find(x => x.subRequestId === id);
      if (s && s.hostUserId === currentUserId) {
        setModal({ kind: "cancel-request", session: s });
      } else {
        showToast("That request is no longer active.");
      }
    }
  }, [searchParams, sessions, currentUserId]);

  function clearDeepLinkParams() {
    if (searchParams.get("action") || searchParams.get("id")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("action");
      params.delete("id");
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    }
  }

  function prevMonth() {
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    setYear(y); setMonth(m); loadMonth(y, m);
  }
  function nextMonth() {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    setYear(y); setMonth(m); loadMonth(y, m);
  }
  function goToCurrentMonth() {
    const t = new Date();
    setYear(t.getFullYear()); setMonth(t.getMonth());
    loadMonth(t.getFullYear(), t.getMonth());
  }

  // ── API actions ──

  async function takeSession(s: Session) {
    if (s.id.startsWith("unassigned::")) {
      const res = await fetch(`${apiBase}/assignments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programSlug: s.programSlug, sessionDate: s.sessionDate, action: "claim" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Something went wrong.");
      }
      const data = await res.json();
      setSessions(prev => prev.map(row => row.id === s.id
        ? { ...row, id: data.id, status: "claimed", hostUserId: currentUserId, hostName: currentUserName }
        : row
      ));
      return;
    }
    const res = await fetch(`${apiBase}/assignments/${s.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claim" }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error ?? "Something went wrong.");
    }
    setSessions(prev => prev.map(row => row.id === s.id
      ? { ...row, status: "claimed", hostUserId: currentUserId, hostName: currentUserName }
      : row
    ));
  }

  async function coverSession(s: Session) {
    if (!s.subRequestId) throw new Error("This request is no longer open.");
    const res = await fetch(`${apiBase}/sub-requests/${s.subRequestId}/claim`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error ?? "Something went wrong.");
    }
    setSessions(prev => prev.map(row => row.id === s.id
      ? { ...row, status: "claimed", hostUserId: currentUserId, hostName: currentUserName, subRequestId: null, subMessage: null }
      : row
    ));
  }

  async function askForCover(s: Session, message: any) {
    const text = extractBlockNoteText(message ?? null).trim();
    const messagePayload = text ? message : null;
    const res = await fetch(`${apiBase}/sub-requests`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId: s.id, message: messagePayload }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error ?? "Something went wrong.");
    }
    const data = await res.json().catch(() => ({}));
    setSessions(prev => prev.map(row => row.id === s.id
      ? { ...row, status: "sub_needed", subRequestId: data.id ?? null, subMessage: messagePayload }
      : row
    ));
  }

  async function cancelRequest(s: Session) {
    if (!s.subRequestId) throw new Error("No request to cancel.");
    const res = await fetch(`${apiBase}/sub-requests/${s.subRequestId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error ?? "Something went wrong.");
    }
    setSessions(prev => prev.map(row => row.id === s.id
      ? { ...row, status: "claimed", subRequestId: null, subMessage: null }
      : row
    ));
  }

  async function reassign(s: Session) {
    const res = await fetch(`${apiBase}/assignments/reassign`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        programSlug: s.programSlug,
        sessionDate: s.sessionDate,
        currentAssignmentId: s.id.startsWith("unassigned::") ? null : s.id,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error ?? "Something went wrong.");
    }
    const data = await res.json();
    setSessions(prev => prev.map(row => row.id === s.id
      ? { ...row, id: data.id, status: "claimed", hostUserId: currentUserId, hostName: currentUserName, subRequestId: null, subMessage: null }
      : row
    ));
  }

  // ── Modal openers ──

  function openTake(s: Session) { setModal({ kind: "take", session: s }); }
  function openCover(s: Session) { setModal({ kind: "cover", session: s }); }
  function openAskCover(s: Session) { setModal({ kind: "ask-cover", session: s }); }
  function openCancelRequest(s: Session) { setModal({ kind: "cancel-request", session: s }); }
  function openReassign(s: Session) { setModal({ kind: "reassign", session: s }); }

  function closeModal() {
    if (modalSubmitting) return;
    setModal({ kind: null, session: null });
    clearDeepLinkParams();
  }

  async function handleConfirm(extra?: any) {
    if (!modal.session) return;
    setModalSubmitting(true);
    try {
      if (modal.kind === "take") {
        await takeSession(modal.session);
        showToast("You're hosting. The team has been notified.");
      } else if (modal.kind === "cover") {
        await coverSession(modal.session);
        showToast("You're covering this session. The original host has been notified.");
      } else if (modal.kind === "ask-cover") {
        await askForCover(modal.session, extra);
        showToast("Done. The team will help find a replacement.");
      } else if (modal.kind === "cancel-request") {
        await cancelRequest(modal.session);
        showToast("Request cancelled. You're back to hosting this session.");
      } else if (modal.kind === "reassign") {
        await reassign(modal.session);
        showToast("Reassigned to you.");
      }
      setModal({ kind: null, session: null });
      clearDeepLinkParams();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setModalSubmitting(false);
    }
  }

  // ── Derived ──

  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const todayMs = useMemo(() => getTodayStart().getTime(), []);

  // Filter past sessions when viewing the current month
  const upcoming = useMemo(() => {
    if (!isCurrentMonth) return sessions;
    return sessions.filter(s => {
      if (!s.sessionDate) return true;
      return new Date(s.sessionDate).getTime() >= todayMs;
    });
  }, [sessions, isCurrentMonth, todayMs]);

  // Counts for filter pills (against the upcoming dataset, not the current filter)
  const counts = useMemo(() => {
    let needs = 0, mine = 0, myReq = 0;
    for (const s of upcoming) {
      const isMine = s.hostUserId === currentUserId;
      if (isMine) {
        mine++;
        if (s.subRequestId) myReq++;
      } else if (s.status !== "claimed" || s.subRequestId) {
        needs++;
      }
    }
    return { all: upcoming.length, needs, mine, myReq };
  }, [upcoming, currentUserId]);

  // Apply active filter
  const filteredSessions = useMemo(() => {
    if (filter === "all") return upcoming;
    if (filter === "needs") {
      return upcoming.filter(s =>
        s.hostUserId !== currentUserId && (s.status !== "claimed" || s.subRequestId)
      );
    }
    if (filter === "mine") {
      return upcoming.filter(s => s.hostUserId === currentUserId);
    }
    if (filter === "my-requests") {
      return upcoming.filter(s => s.hostUserId === currentUserId && s.subRequestId);
    }
    return upcoming;
  }, [upcoming, filter, currentUserId]);

  const buckets = useMemo(() => bucketByWeek(filteredSessions), [filteredSessions]);

  const monthLabel = `${MONTHS[month]} ${year}`;

  const emptyMsg = (() => {
    if (filteredSessions.length > 0) return null;
    if (filter === "all") return `No sessions ${isCurrentMonth ? "left this month" : `in ${MONTHS[month]}`}.`;
    if (filter === "needs") return "Everything is covered. Thank you, team.";
    if (filter === "mine") return "You're not hosting anything here.";
    if (filter === "my-requests") return "You haven't asked the team to cover any sessions.";
    return null;
  })();

  const rowHandlers = {
    onTake: openTake,
    onCover: openCover,
    onAskCover: openAskCover,
    onCancelRequest: openCancelRequest,
    onReassign: openReassign,
    isHostManager,
  };

  return (
    <div className="hs-page">
      {/* Month nav */}
      <div className="hs-monthnav">
        <button className="hs-monthnav__btn" onClick={prevMonth} aria-label="Previous month">←</button>
        <h1 className="hs-monthnav__label">{monthLabel}</h1>
        <button className="hs-monthnav__btn" onClick={nextMonth} aria-label="Next month">→</button>
        {!isCurrentMonth && (
          <button className="hs-monthnav__today" onClick={goToCurrentMonth}>This month</button>
        )}
      </div>

      {/* Filter pills */}
      <div className="hs-filters" role="tablist" aria-label="Filter sessions">
        <button
          role="tab"
          aria-selected={filter === "all"}
          className={`hs-filter${filter === "all" ? " hs-filter--active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All <span className="hs-filter__count">{counts.all}</span>
        </button>
        <button
          role="tab"
          aria-selected={filter === "needs"}
          className={`hs-filter${filter === "needs" ? " hs-filter--active" : ""}`}
          onClick={() => setFilter("needs")}
        >
          Needs help <span className="hs-filter__count">{counts.needs}</span>
        </button>
        <button
          role="tab"
          aria-selected={filter === "mine"}
          className={`hs-filter${filter === "mine" ? " hs-filter--active" : ""}`}
          onClick={() => setFilter("mine")}
        >
          Mine <span className="hs-filter__count">{counts.mine}</span>
        </button>
        {counts.myReq > 0 && (
          <button
            role="tab"
            aria-selected={filter === "my-requests"}
            className={`hs-filter${filter === "my-requests" ? " hs-filter--active" : ""}`}
            onClick={() => setFilter("my-requests")}
          >
            My requests <span className="hs-filter__count">{counts.myReq}</span>
          </button>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <p className="hs-loading">Loading…</p>
      ) : emptyMsg ? (
        <div className="hs-allset">
          <p className="hs-allset__heading">{emptyMsg}</p>
        </div>
      ) : (
        buckets.map(b => (
          <section key={b.weekStartMs} className="hs-week">
            <header className="hs-week__header">
              <h2 className="hs-week__label">{b.label}</h2>
              <span className="hs-week__count">
                {b.sessions.length} {b.sessions.length === 1 ? "session" : "sessions"}
              </span>
            </header>
            <div className="hs-week__list">
              {b.sessions.map(s => (
                <HsRow
                  key={s.id}
                  session={s}
                  kind={rowKind(s, currentUserId)}
                  {...rowHandlers}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <HsModal
        kind={modal.kind}
        session={modal.session}
        onConfirm={handleConfirm}
        onCancel={closeModal}
        submitting={modalSubmitting}
      />

      <Toast msg={toast} />
    </div>
  );
}
