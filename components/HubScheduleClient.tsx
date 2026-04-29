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
import dynamic from "next/dynamic";

const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div style={{ minHeight: 60 }} /> },
);

const RotationsClient = dynamic(
  () => import("@/components/RotationsClient"),
  { ssr: false, loading: () => <p className="hs-loading">Loading rotations…</p> },
);

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
  /** ISO timestamp when the program was created. Drives the NEW badge. */
  programCreatedAt?: string | null;
  /** If non-null, this assignment was created by a standing rotation rule. */
  standingAssignmentId?: string | null;
}

/** A standing rotation the current user is on — drives the host-side summary. */
interface MyRotation {
  id:          string;
  programSlug: string;
  programName: string;
  occurrence:  "FIRST" | "SECOND" | "THIRD" | "FOURTH" | "FIFTH" | "LAST" | "ALL";
  endsOn:      string | null;
}

/** Programs created within this many days show a NEW badge on schedule cards. */
const NEW_PROGRAM_DAYS = 14;

interface Program {
  id: string | null;
  slug: string;
  name: string;
  programFormat: string | null;
}

interface TeamMember {
  id: string;
  displayName: string;
  isCoordinator: boolean;
}

interface Props {
  initialSessions: Session[];
  programs: Program[];
  teamMembers: TeamMember[];
  initialYear: number;
  initialMonth: number;
  currentUserId: string;
  currentUserName: string;
  coordinatorName?: string;
  isHostManager?: boolean;
  /** The current user's active standing rotations (host-side summary only). */
  myRotations?: MyRotation[];
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
function getWeekLabel(weekStart: Date, todayWeekStart: Date, isCurrentMonth: boolean): string {
  // Relative labels only when the user is in their "now" frame (current month).
  // For any other month, use absolute date labels — relative labels are
  // misleading once you've navigated away from today.
  if (isCurrentMonth) {
    const diffDays = Math.round((weekStart.getTime() - todayWeekStart.getTime()) / 86400000);
    if (diffDays === 0) return "This week";
    if (diffDays === 7) return "Next week";
    if (diffDays === -7) return "Last week";
  }
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

function bucketByWeek(sessions: Session[], isCurrentMonth: boolean): Bucket[] {
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
      label: getWeekLabel(new Date(ws), todayWS, isCurrentMonth),
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
  const [coverNote, setCoverNote] = useState<string>("");

  useEffect(() => {
    if (kind === "ask-cover") setCoverNote("");
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
        <RimTiptapEditor
          value={coverNote}
          onChange={setCoverNote}
          placeholder="Anything the replacement should know…"
          variant="message"
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
  isPast: boolean;
  onTake: (s: Session) => void;
  onCover: (s: Session) => void;
  onAskCover: (s: Session) => void;
  onCancelRequest: (s: Session) => void;
  onReassign: (s: Session) => void;
  isHostManager: boolean;
}

function HsRow({
  session, kind, isPast,
  onTake, onCover, onAskCover, onCancelRequest, onReassign,
  isHostManager,
}: RowProps) {
  const dateShort = fmtDateShort(session.sessionDate);
  const timeStr = fmtTime(session.sessionDate);
  const fmt = fmtFormat(session.programFormat);

  // Reassign is only useful when no other action is offered (covered rows).
  // On needs-host / needs-sub / mine, the existing action accomplishes the
  // same thing for a manager.
  const showManagerReassign = isHostManager && kind === "covered" && !isPast;

  let statusEl: React.ReactNode = null;
  let actionEl: React.ReactNode = null;

  switch (kind) {
    case "needs-host":
      statusEl = <span className="hs-row__status hs-row__status--needs">{isPast ? "No host (missed)" : "Needs a host"}</span>;
      if (!isPast) {
        actionEl = (
          <button className="lr-btn lr-btn--host" onClick={() => onTake(session)}>
            Yes, I can host
          </button>
        );
      }
      break;
    case "needs-sub":
      statusEl = (
        <span className="hs-row__status hs-row__status--needs">
          {isPast
            ? "Sub never claimed"
            : (session.hostName ? `${session.hostName} needs help` : "Needs a sub")}
        </span>
      );
      if (!isPast) {
        actionEl = (
          <button className="lr-btn lr-btn--host" onClick={() => onCover(session)}>
            Yes, I can cover
          </button>
        );
      }
      break;
    case "mine":
      statusEl = <span className="hs-row__status hs-row__status--mine">You're hosting</span>;
      if (!isPast) {
        actionEl = (
          <button className="hs-row__quiet" onClick={() => onAskCover(session)}>
            Ask the team to cover
          </button>
        );
      }
      break;
    case "mine-asking":
      statusEl = <span className="hs-row__status hs-row__status--asking">You asked for cover</span>;
      if (!isPast) {
        actionEl = (
          <button className="hs-row__quiet" onClick={() => onCancelRequest(session)}>
            Cancel my request
          </button>
        );
      }
      break;
    case "covered":
      statusEl = (
        <span className="hs-row__status hs-row__status--covered">
          Hosted by {session.hostName ?? "—"}
        </span>
      );
      break;
  }

  // "NEW" badge: program was created within the last NEW_PROGRAM_DAYS.
  // Helps the coordinator (and hosts) notice new offerings that may need
  // attention or volunteers without scrolling through filters. Disappears
  // automatically — no manual dismissal needed.
  const isNewProgram = (() => {
    if (!session.programCreatedAt) return false;
    const ms = new Date(session.programCreatedAt).getTime();
    if (Number.isNaN(ms)) return false;
    return Date.now() - ms < NEW_PROGRAM_DAYS * 24 * 60 * 60 * 1000;
  })();

  return (
    <div className={`hs-row hs-row--${kind}${isPast ? " hs-row--past" : ""}`}>
      <div className="hs-row__when">
        <div className="hs-row__date">{dateShort}</div>
        <div className="hs-row__time">{timeStr}</div>
      </div>
      <div className="hs-row__what">
        <div className="hs-row__name">
          {session.programName}
          {isNewProgram && !isPast && <span className="hs-row__new-badge" aria-label="New program">NEW</span>}
          {session.standingAssignmentId && (
            <span className="hs-row__via" aria-label="Assigned via standing rotation">via rotation</span>
          )}
        </div>
        {fmt && <div className="hs-row__format">{fmt}</div>}
      </div>
      <div className="hs-row__right">
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
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────

const OCC_HUMAN: Record<MyRotation["occurrence"], string> = {
  FIRST:  "1st of the month",
  SECOND: "2nd of the month",
  THIRD:  "3rd of the month",
  FOURTH: "4th of the month",
  FIFTH:  "5th occurrence",
  LAST:   "last of the month",
  ALL:    "every session",
};

export default function HubScheduleClient({
  initialSessions, programs, teamMembers, initialYear, initialMonth,
  currentUserId, currentUserName,
  isHostManager = false, myRotations = [], apiBase = "/api/host",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // "schedule" = agenda view (default), "rotations" = standing-assignment manager
  const [view, setView] = useState<"schedule" | "rotations">("schedule");

  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string>(currentUserId);
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [modal, setModal] = useState<{ kind: ModalKind; session: Session | null }>({ kind: null, session: null });
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Close dropdown on outside click
  const memberPillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!memberDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (memberPillRef.current && !memberPillRef.current.contains(e.target as Node)) {
        setMemberDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [memberDropdownOpen]);

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

  async function askForCover(s: Session, message: string | undefined) {
    const text = (message ?? "").replace(/<[^>]+>/g, "").trim();
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

  const isPast = useCallback((s: Session) => {
    if (!s.sessionDate) return false;
    return new Date(s.sessionDate).getTime() < todayMs;
  }, [todayMs]);

  // Counts:
  //   When viewing the current month, ALL pill counts exclude past sessions
  //   — past sessions appear in the "Earlier this month" collapsible at the
  //   bottom, not in the active counts.
  //   For other months, every session in that month counts (the user
  //   navigated there intentionally to see that month's data).
  //   "Mine" counts the selected member (defaults to self).
  const counts = useMemo(() => {
    let all = 0, needs = 0, mine = 0, myReq = 0;
    for (const s of sessions) {
      const past = isPast(s);
      if (isCurrentMonth && past) continue;
      all++;
      const isSelectedMembers = s.hostUserId === selectedMemberId;
      const isMine = s.hostUserId === currentUserId;
      if (isSelectedMembers) mine++;
      if (isMine && s.subRequestId) myReq++;
      if (!isMine && (s.status !== "claimed" || s.subRequestId)) needs++;
    }
    return { all, needs, mine, myReq };
  }, [sessions, currentUserId, selectedMemberId, isPast, isCurrentMonth]);

  // Apply active filter. "Mine" filter scopes to selectedMemberId.
  const filteredSessions = useMemo(() => {
    if (filter === "all") return sessions;
    if (filter === "needs") {
      return sessions.filter(s =>
        s.hostUserId !== currentUserId &&
        (s.status !== "claimed" || s.subRequestId)
      );
    }
    if (filter === "mine") {
      return sessions.filter(s => s.hostUserId === selectedMemberId);
    }
    if (filter === "my-requests") {
      return sessions.filter(s =>
        s.hostUserId === currentUserId && s.subRequestId
      );
    }
    return sessions;
  }, [sessions, filter, currentUserId, selectedMemberId]);

  // When viewing the current month, split past from upcoming.
  // Past goes into a collapsible "Earlier this month" section at the bottom.
  // For other months, all sessions render in-flow.
  const upcomingSessions = useMemo(() =>
    isCurrentMonth ? filteredSessions.filter(s => !isPast(s)) : filteredSessions,
    [filteredSessions, isCurrentMonth, isPast],
  );
  const pastSessions = useMemo(() =>
    isCurrentMonth ? filteredSessions.filter(isPast) : [],
    [filteredSessions, isCurrentMonth, isPast],
  );

  const upcomingBuckets = useMemo(() => bucketByWeek(upcomingSessions, isCurrentMonth), [upcomingSessions, isCurrentMonth]);
  const pastBuckets = useMemo(() => bucketByWeek(pastSessions, isCurrentMonth), [pastSessions, isCurrentMonth]);

  const monthLabel = `${MONTHS[month]} ${year}`;

  const emptyMsg = (() => {
    if (filteredSessions.length > 0) return null;
    if (filter === "all") return `No sessions in ${MONTHS[month]}.`;
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

      {/* View tab strip — Schedule | Rotations (manager/coordinator only) */}
      {isHostManager && (
        <div className="hs-viewtabs" role="tablist" aria-label="Schedule views">
          <button
            role="tab"
            aria-selected={view === "schedule"}
            className={`hs-viewtab${view === "schedule" ? " hs-viewtab--active" : ""}`}
            onClick={() => setView("schedule")}
          >
            Schedule
          </button>
          <button
            role="tab"
            aria-selected={view === "rotations"}
            className={`hs-viewtab${view === "rotations" ? " hs-viewtab--active" : ""}`}
            onClick={() => setView("rotations")}
          >
            Rotations
          </button>
        </div>
      )}

      {/* Rotations view */}
      {view === "rotations" && (
        <RotationsClient
          programs={programs}
          teamMembers={teamMembers}
          year={year}
          month={month + 1}
        />
      )}

      {/* Schedule view — hidden when rotations is active */}
      {view === "schedule" && <>

      {/* Your standing rotations — host-side awareness panel.
          Renders only for users who are on at least one rotation, regardless
          of role. Coordinators still get the full management view via the
          Rotations tab; this panel is just "here's what's auto-scheduling you." */}
      {myRotations.length > 0 && (
        <div className="hs-myrot">
          <span className="hs-myrot__label">Your standing rotations:</span>
          <ul className="hs-myrot__list">
            {myRotations.map((r) => {
              const endsLabel = r.endsOn
                ? new Date(r.endsOn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : null;
              return (
                <li key={r.id} className="hs-myrot__item">
                  <strong>{r.programName}</strong> — {OCC_HUMAN[r.occurrence]}
                  {endsLabel && <span className="hs-myrot__until"> (until {endsLabel})</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

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

        {/* Member-picker pill — defaults to "Mine" (self), can switch to any
            host-team member. Body click = activate filter, arrow = open list. */}
        <div className="hs-filter-group" ref={memberPillRef}>
          <button
            role="tab"
            aria-selected={filter === "mine"}
            className={`hs-filter hs-filter--member${filter === "mine" ? " hs-filter--active" : ""}`}
            onClick={() => {
              setFilter("mine");
              setMemberDropdownOpen(false);
            }}
          >
            <span className="hs-filter__label">
              {selectedMemberId === currentUserId
                ? "Mine"
                : (teamMembers.find(m => m.id === selectedMemberId)?.displayName ?? "Member")}
            </span>
            <span className="hs-filter__count">{counts.mine}</span>
          </button>
          <button
            type="button"
            className={`hs-filter__caret${filter === "mine" ? " hs-filter__caret--active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setMemberDropdownOpen(v => !v);
            }}
            aria-label="Choose a team member"
            aria-expanded={memberDropdownOpen}
          >
            ▾
          </button>
          {memberDropdownOpen && (
            <div className="hs-member-menu" role="menu">
              <button
                role="menuitem"
                className={`hs-member-menu__item${selectedMemberId === currentUserId ? " hs-member-menu__item--active" : ""}`}
                onClick={() => {
                  setSelectedMemberId(currentUserId);
                  setFilter("mine");
                  setMemberDropdownOpen(false);
                }}
              >
                Mine
              </button>
              {teamMembers.length > 0 && <div className="hs-member-menu__divider" />}
              {teamMembers.map(m => (
                <button
                  key={m.id}
                  role="menuitem"
                  className={`hs-member-menu__item${selectedMemberId === m.id ? " hs-member-menu__item--active" : ""}`}
                  onClick={() => {
                    setSelectedMemberId(m.id);
                    setFilter("mine");
                    setMemberDropdownOpen(false);
                  }}
                >
                  {m.displayName}
                  {m.isCoordinator && <span className="hs-member-menu__star" aria-label="coordinator"> ★</span>}
                  {m.id === currentUserId && <span className="hs-member-menu__you"> (you)</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedMemberId === currentUserId && counts.myReq > 0 && (
          <button
            role="tab"
            aria-selected={filter === "my-requests"}
            className={`hs-filter${filter === "my-requests" ? " hs-filter--active" : ""}`}
            onClick={() => setFilter("my-requests")}
          >
            My requests <span className="hs-filter__count">{counts.myReq}</span>
          </button>
        )}

        {/* Help — opens the manual chapter in a new tab. Sits at the end of
            the filter row so it's discoverable without competing for visual
            weight. The system's standard ManualHelpIcon ("?") convention. */}
        <a
          href="/admin/manual/host-schedule"
          target="_blank"
          rel="noopener noreferrer"
          className="hs-help-icon"
          title="How the schedule works"
          aria-label="How the schedule works (opens in a new tab)"
        >
          ?
        </a>
      </div>

      {/* Body */}
      {loading ? (
        <p className="hs-loading">Loading…</p>
      ) : emptyMsg ? (
        <div className="hs-allset">
          <p className="hs-allset__heading">{emptyMsg}</p>
        </div>
      ) : (
        <>
          {upcomingBuckets.map(b => (
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
                    isPast={false}
                    {...rowHandlers}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* Earlier this month — collapsed by default for current-month views */}
          {pastBuckets.length > 0 && (
            <details className="hs-past">
              <summary className="hs-past__summary">
                Earlier this month — {pastSessions.length}{" "}
                {pastSessions.length === 1 ? "session" : "sessions"}
              </summary>
              <div className="hs-past__content">
                {pastBuckets.map(b => (
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
                          isPast
                          {...rowHandlers}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </details>
          )}

          {/* If only past content exists in current month, show a hint */}
          {upcomingBuckets.length === 0 && pastBuckets.length > 0 && isCurrentMonth && (
            <div className="hs-allset">
              <p className="hs-allset__heading">
                Nothing left this month. The next sessions are in {MONTHS[(month + 1) % 12]}.
              </p>
            </div>
          )}
        </>
      )}

      <HsModal
        kind={modal.kind}
        session={modal.session}
        onConfirm={handleConfirm}
        onCancel={closeModal}
        submitting={modalSubmitting}
      />

      <Toast msg={toast} />

      </> /* end schedule view */}
    </div>
  );
}
