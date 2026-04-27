"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import RimProseEditor from "@/components/RimProseEditor";
import { renderBlockNoteHtml, extractBlockNoteText } from "@/lib/renderRichContent";

/** Confirmation timeout (ms) — a primary action button stays 'armed' this long
    before reverting to its idle label. Short enough that an accidental arm is
    harmless; long enough that an intentional confirm feels easy. */
const CONFIRM_MS = 4000;

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

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    timeZone: "America/Chicago",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/Chicago",
  });
}

function fmtDayLong(year: number, month: number, day: number) {
  return new Date(year, month, day).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

function fmtDayHeader(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
    timeZone: "America/Chicago",
  });
}

function fmtTimeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/Chicago",
  });
}

/** "Private Teacher Meetings" → "Private Teach…" for narrow pills */
function pillLabel(name: string, max: number = 18) {
  if (name.length <= max) return name;
  return name.slice(0, max - 1).trimEnd() + "…";
}

function formatLabel(fmt: string | null) {
  if (!fmt) return null;
  if (fmt === "virtual") return "Virtual";
  if (fmt === "hybrid") return "Hybrid";
  if (fmt === "in-person") return "In Person";
  return fmt;
}

type StatusKey = "mine" | "mine-sub" | "covered" | "needs-host" | "needs-sub";

function statusKey(
  s: Session,
  currentUserId: string,
): StatusKey {
  if (s.hostUserId === currentUserId) {
    return s.status === "sub_needed" ? "mine-sub" : "mine";
  }
  if (s.status === "sub_needed") return "needs-sub";
  if (s.status === "unclaimed")   return "needs-host";
  return "covered";
}

function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="hub-toast">{msg}</div>;
}

// ── Inline Session Detail Panel ───────────────────────────────────────────────

function SessionDetail({
  session: s,
  currentUserId,
  currentUserName,
  coordinatorName,
  isHostManager = false,
  onClose,
  onClaim,
  onSubRequest,
  onUnclaim,
  onClaimSub,
  onReassignToSelf,
}: {
  session: Session;
  currentUserId: string;
  currentUserName: string;
  coordinatorName?: string;
  isHostManager?: boolean;
  onClose: () => void;
  onClaim: (id: string) => void;
  onSubRequest: (id: string, message: any) => Promise<boolean>;
  onUnclaim: (id: string) => void;
  onClaimSub: (id: string, subRequestId: string) => void;
  onReassignToSelf: (session: Session) => Promise<boolean>;
}) {
  const [subFormOpen, setSubFormOpen] = useState(false);
  const [subMsg, setSubMsg] = useState<any>(null);
  const [removeWarnOpen, setRemoveWarnOpen] = useState(false);
  const [reassignWarnOpen, setReassignWarnOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState<"host" | "sub" | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function armConfirm(kind: "host" | "sub") {
    setConfirming(kind);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirming(null), CONFIRM_MS);
  }
  function clearConfirm() {
    setConfirming(null);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }
  useEffect(() => () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }, []);

  const isOwn       = s.hostUserId === currentUserId;
  const isUnclaimed = s.status === "unclaimed";
  const isSubNeeded = s.status === "sub_needed";
  const isClaimed   = s.status === "claimed";

  const hostDisplay = isOwn
    ? (isSubNeeded ? "You — asking for someone to cover" : "You")
    : isSubNeeded
    ? (s.hostName ? `${s.hostName} — asking for someone to cover` : "Asking for someone to cover")
    : isUnclaimed
    ? "No host yet"
    : s.hostName ?? "—";

  const infoItems: { label: string; value: string }[] = [
    { label: "Host", value: hostDisplay },
  ];
  if (s.programFormat) infoItems.push({ label: "Format", value: formatLabel(s.programFormat)! });
  if (coordinatorName) infoItems.push({ label: "Coordinator", value: coordinatorName });

  return (
    <div className="hub-detail">
      <div className="hub-detail__info">
        {infoItems.map((item, i) => (
          <span key={item.label} className="hub-detail__info-item">
            {i > 0 && <span className="hub-detail__info-sep">·</span>}
            <span className="hub-detail__info-label">{item.label}:</span> {item.value}
          </span>
        ))}
      </div>

      {s.subMessage && extractBlockNoteText(s.subMessage) && (
        <div className="hub-detail__sub-msg">
          <strong>A note from the current host:</strong>
          <div className="rim-content" dangerouslySetInnerHTML={{ __html: renderBlockNoteHtml(s.subMessage) }} />
        </div>
      )}

      {isHostManager && (
        <ProgramDiagnostics session={s} />
      )}

      {!subFormOpen && !removeWarnOpen && !reassignWarnOpen && (
        <div className="hub-detail__actions">
          {isUnclaimed && (
            confirming === "host" ? (
              <div className="hub-detail__confirm">
                <button
                  className="hub-detail__primary-btn hub-detail__primary-btn--host hub-detail__primary-btn--confirming"
                  onClick={() => { clearConfirm(); onClaim(s.id); }}
                >
                  Tap again to confirm
                </button>
                <button className="hub-detail__link-btn" onClick={clearConfirm}>
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="hub-detail__primary-btn hub-detail__primary-btn--host"
                onClick={() => armConfirm("host")}
              >
                I'll host this session
              </button>
            )
          )}
          {isSubNeeded && s.subRequestId && !isOwn && (
            confirming === "sub" ? (
              <div className="hub-detail__confirm">
                <button
                  className="hub-detail__primary-btn hub-detail__primary-btn--sub hub-detail__primary-btn--confirming"
                  onClick={() => { clearConfirm(); onClaimSub(s.id, s.subRequestId!); }}
                >
                  Tap again to confirm
                </button>
                <button className="hub-detail__link-btn" onClick={clearConfirm}>
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="hub-detail__primary-btn hub-detail__primary-btn--sub"
                onClick={() => armConfirm("sub")}
              >
                I can cover this session
              </button>
            )
          )}
          <div className="hub-detail__secondary-actions">
            {isOwn && isClaimed && (
              <button className="hub-detail__link-btn" onClick={() => setSubFormOpen(true)}>
                Ask someone to cover for me
              </button>
            )}
            {isOwn && (
              <button className="hub-detail__link-btn hub-detail__link-btn--remove" onClick={() => setRemoveWarnOpen(true)}>
                Remove myself
              </button>
            )}
            {isHostManager && !isOwn && (
              <button
                className="hub-detail__link-btn hub-detail__link-btn--manager"
                onClick={() => setReassignWarnOpen(true)}
              >
                Reassign this session to me
              </button>
            )}
            <button className="hub-detail__link-btn hub-detail__link-btn--close" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      )}

      {subFormOpen && (
        <div className="hub-detail__form">
          <div className="hub-detail__form-label">Share any context for the team:</div>
          <RimProseEditor
            value={subMsg}
            onChange={setSubMsg}
            placeholder="A short note about why you're asking for a sub, anything the replacement should know…"
            variant="compact"
          />
          <div className="hub-detail__form-actions">
            <button
              className="hub-detail__primary-btn"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  const ok = await onSubRequest(s.id, subMsg);
                  if (ok) {
                    setSubFormOpen(false);
                    setSubMsg(null);
                  }
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting ? "Sending…" : "Send request to team"}
            </button>
            <button className="hub-detail__link-btn" onClick={() => { setSubFormOpen(false); setSubMsg(""); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {removeWarnOpen && (
        <div className="hub-detail__warn">
          <span className="hub-detail__warn-text">This will leave the session without a host. The team will be notified.</span>
          <div className="hub-detail__form-actions">
            <button
              className="hub-detail__primary-btn hub-detail__primary-btn--danger"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                await onUnclaim(s.id);
                setSubmitting(false);
                setRemoveWarnOpen(false);
                onClose();
              }}
            >
              {submitting ? "Removing…" : "Yes, remove me"}
            </button>
            <button className="hub-detail__link-btn" onClick={() => setRemoveWarnOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {reassignWarnOpen && (
        <div className="hub-detail__warn">
          <span className="hub-detail__warn-text">
            {s.hostUserId
              ? `This will remove ${s.hostName ?? "the current host"} from this session and assign you instead. ${s.hostName ?? "They"} will be notified. Any open sub request on this session will be cancelled.`
              : "This will assign you to this session."}
          </span>
          <div className="hub-detail__form-actions">
            <button
              className="hub-detail__primary-btn hub-detail__primary-btn--danger"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                const ok = await onReassignToSelf(s);
                setSubmitting(false);
                if (ok) {
                  setReassignWarnOpen(false);
                }
              }}
            >
              {submitting ? "Reassigning…" : "Yes, reassign to me"}
            </button>
            <button className="hub-detail__link-btn" onClick={() => setReassignWarnOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Program diagnostics (HOST_MANAGER/ADMIN only) ─────────────────────────────

function ProgramDiagnostics({ session: s }: { session: Session }) {
  const isVirtualOrHybrid =
    s.programFormat === "virtual" || s.programFormat === "hybrid";
  const hasLivekit = Boolean(s.livekitRoom && s.livekitRoom.trim().length > 0);
  const hasOccurrence = Boolean(s.sessionDate);
  const hasHost = Boolean(s.hostUserId);

  type Check = { ok: boolean; level: "error" | "warning"; message: string };
  const checks: Check[] = [
    {
      ok: isVirtualOrHybrid,
      level: "error",
      message: "Program format is not virtual or hybrid.",
    },
    {
      ok: hasLivekit,
      level: "error",
      message: "No LiveKit room configured on this program.",
    },
    {
      ok: hasOccurrence,
      level: "error",
      message: "No occurrence scheduled — program has no start datetime or recurrence.",
    },
    {
      ok: hasHost,
      level: "warning",
      message: "No host is assigned to this session yet.",
    },
  ];

  const failed = checks.filter((c) => !c.ok);
  const allGood = failed.length === 0;
  const programEditUrl = `/tools/programs/${s.programSlug}`;
  const programPublicUrl = `/programs/${s.programSlug}`;

  return (
    <div className={`hub-diag hub-diag--${allGood ? "ok" : failed.some((c) => c.level === "error") ? "error" : "warn"}`}>
      <div className="hub-diag__header">
        <span className="hub-diag__label">Program setup</span>
        <Link
          href={programEditUrl}
          className="hub-diag__link"
          target="_blank"
          rel="noreferrer"
        >
          Open in Program Manager →
        </Link>
      </div>
      {allGood ? (
        <p className="hub-diag__ok">All checks pass for this session.</p>
      ) : (
        <ul className="hub-diag__list">
          {failed.map((c, i) => (
            <li key={i} className={`hub-diag__item hub-diag__item--${c.level}`}>
              <span className="hub-diag__bullet" aria-hidden="true">
                {c.level === "error" ? "✕" : "!"}
              </span>
              <span className="hub-diag__msg">{c.message}</span>
            </li>
          ))}
        </ul>
      )}
      {failed.some((c) => c.level === "error") && (
        <p className="hub-diag__hint">
          Program configuration is managed by the registrar. Contact them, or{" "}
          <Link href={programEditUrl} target="_blank" rel="noreferrer" className="hub-diag__inline-link">
            open the Program Manager
          </Link>
          {" "}·{" "}
          <Link href={programPublicUrl} target="_blank" rel="noreferrer" className="hub-diag__inline-link">
            view public page
          </Link>.
        </p>
      )}
    </div>
  );
}


// ── Main component ────────────────────────────────────────────────────────────

export default function HubScheduleClient({
  initialSessions,
  programs,
  initialYear,
  initialMonth,
  currentUserId,
  currentUserName,
  coordinatorName,
  isHostManager = false,
  apiBase = "/api/host",
}: Props) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Session | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Card-level confirmation state: tracks which session+kind is 'armed' for a
  // second-tap commit. Only one at a time. Auto-reverts after CONFIRM_MS.
  const [cardConfirm, setCardConfirm] = useState<{ id: string; kind: "host" | "sub" } | null>(null);
  const cardConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function armCardConfirm(id: string, kind: "host" | "sub") {
    setCardConfirm({ id, kind });
    if (cardConfirmTimer.current) clearTimeout(cardConfirmTimer.current);
    cardConfirmTimer.current = setTimeout(() => setCardConfirm(null), CONFIRM_MS);
  }
  function clearCardConfirm() {
    setCardConfirm(null);
    if (cardConfirmTimer.current) clearTimeout(cardConfirmTimer.current);
  }
  useEffect(() => () => {
    if (cardConfirmTimer.current) clearTimeout(cardConfirmTimer.current);
  }, []);

  // Calendar day selection (null = show whole month)
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Single toggle (replaces the 3-way filter pill row)
  const [showMineOnly, setShowMineOnly] = useState(false);
  const [showNeedsOnly, setShowNeedsOnly] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setSelected(null);
    setSelectedDay(null);
    try {
      const monthStr = `${y}-${String(m + 1).padStart(2, "0")}`;
      const res = await fetch(`${apiBase}/assignments?month=${monthStr}`);
      if (!res.ok) return;
      const data: Session[] = await res.json();
      setSessions(data);
    } catch {
      showToast("Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

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

  function goToToday() {
    const t = new Date();
    setYear(t.getFullYear()); setMonth(t.getMonth());
    setSelectedDay(null);
    loadMonth(t.getFullYear(), t.getMonth());
  }

  async function claimSession(id: string) {
    try {
      let newId = id;
      if (id.startsWith("unassigned::")) {
        const s = sessions.find((s) => s.id === id);
        const [, programSlug] = id.split("::");
        const res = await fetch(`${apiBase}/assignments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ programSlug, sessionDate: s?.sessionDate ?? null, action: "claim" }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Something went wrong."); }
        const data = await res.json();
        newId = data.id;
      } else {
        const res = await fetch(`${apiBase}/assignments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "claim" }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Something went wrong."); }
      }
      setSessions((prev) => prev.map((s) =>
        s.id === id
          ? { ...s, id: newId, status: "claimed", hostUserId: currentUserId, hostName: currentUserName }
          : s
      ));
      setSelected((s) =>
        s?.id === id
          ? { ...s, id: newId, status: "claimed", hostUserId: currentUserId, hostName: currentUserName }
          : s
      );
      showToast("✓ You're hosting — the team has been notified.");
    } catch (e) { showToast(e instanceof Error ? e.message : "Network error. Please try again."); }
  }

  async function submitSubRequest(assignmentId: string, message: any): Promise<boolean> {
    // Normalize message: send null if the BlockNote doc is empty or only whitespace.
    const text = extractBlockNoteText(message).trim();
    const messagePayload = text ? message : null;

    let newSubRequestId: string | null = null;
    try {
      const res = await fetch(`${apiBase}/sub-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, message: messagePayload }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showToast(d.error ?? "Something went wrong.");
        return false;
      }
      const data = await res.json().catch(() => ({}));
      newSubRequestId = data?.id ?? null;
    } catch {
      showToast("Network error. Please try again.");
      return false;
    }

    setSessions((prev) => prev.map((s) =>
      s.id === assignmentId
        ? { ...s, status: "sub_needed", subRequestId: newSubRequestId, subMessage: messagePayload }
        : s
    ));
    setSelected((cur) =>
      cur?.id === assignmentId
        ? { ...cur, status: "sub_needed", subRequestId: newSubRequestId, subMessage: messagePayload }
        : cur
    );
    showToast("Sub request sent — the team has been notified.");
    return true;
  }

  async function unclaimSession(id: string) {
    const res = await fetch(`${apiBase}/assignments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unclaim" }),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error ?? "Something went wrong."); return; }
    setSessions((prev) => prev.map((s) =>
      s.id === id ? { ...s, status: "unclaimed", hostUserId: null, hostName: null, subRequestId: null, subMessage: null } : s
    ));
    showToast("You've been removed. This session now needs a host.");
  }

  async function claimSub(assignmentId: string, subRequestId: string) {
    const res = await fetch(`${apiBase}/sub-requests/${subRequestId}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error ?? "Something went wrong."); return; }
    setSessions((prev) => prev.map((s) =>
      s.id === assignmentId
        ? { ...s, status: "claimed", hostUserId: currentUserId, hostName: currentUserName, subRequestId: null, subMessage: null }
        : s
    ));
    setSelected(null);
    showToast("✓ You're covering this session — the original host has been notified.");
  }

  async function reassignToSelf(s: Session): Promise<boolean> {
    try {
      const res = await fetch(`${apiBase}/assignments/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programSlug: s.programSlug,
          sessionDate: s.sessionDate,
          currentAssignmentId: s.id.startsWith("unassigned::") ? null : s.id,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showToast(d.error ?? "Something went wrong.");
        return false;
      }
      const data = await res.json();
      setSessions((prev) => prev.map((row) =>
        row.id === s.id
          ? {
              ...row,
              id: data.id,
              status: "claimed",
              hostUserId: currentUserId,
              hostName: currentUserName,
              subRequestId: null,
              subMessage: null,
            }
          : row
      ));
      setSelected((cur) =>
        cur?.id === s.id
          ? {
              ...cur,
              id: data.id,
              status: "claimed",
              hostUserId: currentUserId,
              hostName: currentUserName,
              subRequestId: null,
              subMessage: null,
            }
          : cur
      );
      showToast("✓ Reassigned — you're hosting this session.");
      return true;
    } catch {
      showToast("Network error. Please try again.");
      return false;
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  // Month-level counts — always based on all sessions, ignoring toggles (so the status line is stable)
  const needsCount = useMemo(
    () => sessions.filter((s) => s.status !== "claimed" || s.subRequestId).length,
    [sessions],
  );
  const mineCount = useMemo(
    () => sessions.filter((s) => s.hostUserId === currentUserId).length,
    [sessions, currentUserId],
  );
  const totalCount = sessions.length;

  // Apply toggle filters (but not day filter — that's applied separately for the list view)
  const toggleFilteredSessions = useMemo(() => sessions.filter((s) => {
    if (showMineOnly  && s.hostUserId !== currentUserId) return false;
    if (showNeedsOnly && !(s.status !== "claimed" || s.subRequestId)) return false;
    return true;
  }), [sessions, showMineOnly, showNeedsOnly, currentUserId]);

  const sessionsForDay = useCallback((day: number) =>
    toggleFilteredSessions.filter((s) => {
      if (!s.sessionDate) return false;
      const d = new Date(s.sessionDate);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    }), [toggleFilteredSessions, year, month]);

  // Sessions to render in the list: filter to selectedDay if one is selected
  const listSessions = useMemo(() => {
    const base = selectedDay === null
      ? toggleFilteredSessions
      : sessionsForDay(selectedDay);
    return [...base].sort((a, b) => {
      if (!a.sessionDate) return 1;
      if (!b.sessionDate) return -1;
      return new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime();
    });
  }, [toggleFilteredSessions, selectedDay, sessionsForDay]);

  function onDayClick(day: number) {
    setSelected(null);
    setSelectedDay((prev) => (prev === day ? null : day));
  }

  // Group list sessions by date string (YYYY-MM-DD) for date headers
  const groupedList = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of listSessions) {
      const key = s.sessionDate ? s.sessionDate.slice(0, 10) : "unscheduled";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries());
  }, [listSessions]);

  return (
    <div className="hub-schedule">

      {/* ── Status sentence with interactive filter counts ── */}
      <div className="hub-sched-status">
        <p className="hub-sched-status__line">
          {needsCount > 0 ? (
            <>
              <button
                type="button"
                className={`hub-sched-status__pill hub-sched-status__pill--needs${showNeedsOnly ? " hub-sched-status__pill--active" : ""}`}
                onClick={() => { setShowNeedsOnly((v) => !v); setShowMineOnly(false); }}
                aria-pressed={showNeedsOnly}
              >
                {needsCount} {needsCount === 1 ? "session" : "sessions"} need a host
              </button>
              {" "}this month.
            </>
          ) : (
            <>All sessions this month have a host.</>
          )}
          {" "}
          {mineCount > 0 ? (
            <>
              You're hosting{" "}
              <button
                type="button"
                className={`hub-sched-status__pill hub-sched-status__pill--mine${showMineOnly ? " hub-sched-status__pill--active" : ""}`}
                onClick={() => { setShowMineOnly((v) => !v); setShowNeedsOnly(false); }}
                aria-pressed={showMineOnly}
              >
                {mineCount}
              </button>
              .
            </>
          ) : (
            <>You haven't claimed any sessions yet.</>
          )}
          {(showMineOnly || showNeedsOnly) && (
            <>
              {" "}
              <button
                type="button"
                className="hub-sched-status__clear"
                onClick={() => { setShowMineOnly(false); setShowNeedsOnly(false); }}
              >
                Show all {totalCount}
              </button>
            </>
          )}
        </p>
      </div>

      {/* ── Month navigation ── */}
      <div className="hub-schedule__month-nav">
        <button className="hub-schedule__nav-btn" onClick={prevMonth} aria-label="Previous month">←</button>
        <div className="hub-schedule__month-center">
          <h2 className="hub-schedule__month">{MONTHS[month]} {year}</h2>
          {!isCurrentMonth && (
            <button className="hub-schedule__today-btn" onClick={goToToday}>Today</button>
          )}
        </div>
        <button className="hub-schedule__nav-btn" onClick={nextMonth} aria-label="Next month">→</button>
      </div>

      {loading && <div className="hub-schedule__loading">Loading…</div>}

      {/* ── Calendar with event pills ── */}
      {!loading && (
        <div className="hub-cal2">
          <div className="hub-cal2__header">
            {DAYS.map((d) => <div key={d} className="hub-cal2__day-label">{d.charAt(0)}</div>)}
          </div>
          <div className="hub-cal2__grid">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`memp-${i}`} className="hub-cal2__cell hub-cal2__cell--empty" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const daySessions = sessionsForDay(day);
              const isSelected = selectedDay === day;
              const isTodayDay = isToday(day);
              const visible = daySessions.slice(0, 3);
              const overflow = daySessions.length - visible.length;
              return (
                <div
                  key={day}
                  className={[
                    "hub-cal2__cell",
                    isSelected ? "hub-cal2__cell--selected" : "",
                    isTodayDay && !isSelected ? "hub-cal2__cell--today" : "",
                    daySessions.length === 0 ? "hub-cal2__cell--empty-day" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => onDayClick(day)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDayClick(day); } }}
                >
                  <span className="hub-cal2__num">{day}</span>
                  {daySessions.length > 0 && (
                    <div className="hub-cal2__events">
                      {visible.map((s) => {
                        const type = statusKey(s, currentUserId);
                        return (
                          <span
                            key={s.id}
                            className={`hub-cal2__event hub-cal2__event--${type}`}
                            title={s.programName}
                          >
                            <span className="hub-cal2__event-label">{pillLabel(s.programName)}</span>
                          </span>
                        );
                      })}
                      {overflow > 0 && (
                        <span className="hub-cal2__event-more">+{overflow} more</span>
                      )}
                    </div>
                  )}
                  {/* Mobile-only status strip (small dots/bars) */}
                  {daySessions.length > 0 && (
                    <div className="hub-cal2__bars" aria-hidden="true">
                      {visible.map((s) => {
                        const type = statusKey(s, currentUserId);
                        return (
                          <span
                            key={`b-${s.id}`}
                            className={`hub-cal2__bar hub-cal2__bar--${type}`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Legend — decodes the four statuses at a glance ── */}
      {!loading && (
        <div className="hub-sched-legend" aria-label="Calendar color legend">
          <span className="hub-sched-legend__item">
            <span className="hub-sched-legend__swatch hub-sched-legend__swatch--needs-host" aria-hidden="true" />
            No host yet
          </span>
          <span className="hub-sched-legend__item">
            <span className="hub-sched-legend__swatch hub-sched-legend__swatch--needs-sub" aria-hidden="true" />
            Needs a sub
          </span>
          <span className="hub-sched-legend__item">
            <span className="hub-sched-legend__swatch hub-sched-legend__swatch--mine" aria-hidden="true" />
            You're hosting
          </span>
          <span className="hub-sched-legend__item">
            <span className="hub-sched-legend__swatch hub-sched-legend__swatch--mine-sub" aria-hidden="true" />
            You asked for a sub
          </span>
          <span className="hub-sched-legend__item">
            <span className="hub-sched-legend__swatch hub-sched-legend__swatch--covered" aria-hidden="true" />
            Covered
          </span>
        </div>
      )}

      {/* ── Day filter banner (shown when a day is selected) ── */}
      {selectedDay !== null && (
        <div className="hub-sched-dayfilter">
          <span className="hub-sched-dayfilter__text">
            Showing <strong>{listSessions.length}</strong> {listSessions.length === 1 ? "session" : "sessions"} on {fmtDayLong(year, month, selectedDay)}
          </span>
          <button
            type="button"
            className="hub-sched-dayfilter__clear"
            onClick={() => setSelectedDay(null)}
          >
            Show whole month →
          </button>
        </div>
      )}

      {/* ── Session list ── */}
      {!loading && (
        <div className="hs-list">
          {listSessions.length === 0 ? (
            <p className="hub-empty">
              {selectedDay !== null
                ? "Nothing scheduled that day."
                : showMineOnly
                ? "You haven't claimed any sessions this month."
                : showNeedsOnly
                ? "Every session this month has a host."
                : "No sessions this month."}
            </p>
          ) : (
            groupedList.map(([dateKey, daySessions]) => {
              const showGroupHeader = selectedDay === null && dateKey !== "unscheduled";
              return (
                <div key={dateKey} className="pl-cat hs-group" data-date={dateKey}>
                  {showGroupHeader && daySessions[0].sessionDate && (
                    <h2 className="pl-cat__heading">
                      {fmtDayHeader(daySessions[0].sessionDate)}
                    </h2>
                  )}
                  <div className="pl-list">
                    {daySessions.map((s) => {
                      const type = statusKey(s, currentUserId);
                      const isMineRow = type === "mine" || type === "mine-sub";
                      const isExpanded = selected?.id === s.id;
                      return (
                        <div
                          key={s.id}
                          className={`lr-row hs-row hs-row--${type}${isExpanded ? " hs-row--expanded" : ""}`}
                        >
                          <div
                            className="hs-row__main"
                            onClick={() => {
                              clearCardConfirm();
                              setSelected(isExpanded ? null : s);
                            }}
                          >
                            <div className="lr-info">
                              <p className="lr-name">
                                {s.programName}
                                {type === "mine-sub" && (
                                  <span className="hub-lv__chip hub-lv__chip--sub">Sub requested</span>
                                )}
                              </p>
                              <p className="lr-schedule">
                                {s.sessionDate && <>{fmtTimeOnly(s.sessionDate)}</>}
                                {s.programFormat && <> · {formatLabel(s.programFormat)}</>}
                                {" · "}
                                {type === "needs-host" ? (
                                  <span className="hs-status hs-status--needs-host">No host yet</span>
                                ) : type === "needs-sub" ? (
                                  <span className="hs-status hs-status--needs-sub">
                                    {s.hostName ? `${s.hostName} needs a sub` : "Needs a sub"}
                                  </span>
                                ) : type === "mine-sub" ? (
                                  <span className="hs-status hs-status--mine">Asking the team to cover</span>
                                ) : isMineRow ? (
                                  <span className="hs-status hs-status--mine">You're hosting</span>
                                ) : (
                                  <>Hosted by {s.hostName ?? "—"}</>
                                )}
                              </p>
                            </div>
                            <div className="lr-action">
                              {!isExpanded && type === "needs-host" && (
                                cardConfirm?.id === s.id && cardConfirm?.kind === "host" ? (
                                  <div className="hs-confirm">
                                    <button
                                      className="lr-btn lr-btn--host lr-btn--confirming"
                                      onClick={(e) => { e.stopPropagation(); clearCardConfirm(); claimSession(s.id); }}
                                    >
                                      Tap to confirm
                                    </button>
                                    <button
                                      className="hs-cancel-btn"
                                      onClick={(e) => { e.stopPropagation(); clearCardConfirm(); }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    className="lr-btn lr-btn--host"
                                    onClick={(e) => { e.stopPropagation(); armCardConfirm(s.id, "host"); }}
                                  >
                                    I'll host
                                  </button>
                                )
                              )}
                              {!isExpanded && type === "needs-sub" && s.subRequestId && (
                                cardConfirm?.id === s.id && cardConfirm?.kind === "sub" ? (
                                  <div className="hs-confirm">
                                    <button
                                      className="lr-btn lr-btn--sub lr-btn--confirming"
                                      onClick={(e) => { e.stopPropagation(); clearCardConfirm(); claimSub(s.id, s.subRequestId!); }}
                                    >
                                      Tap to confirm
                                    </button>
                                    <button
                                      className="hs-cancel-btn"
                                      onClick={(e) => { e.stopPropagation(); clearCardConfirm(); }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    className="lr-btn lr-btn--sub"
                                    onClick={(e) => { e.stopPropagation(); armCardConfirm(s.id, "sub"); }}
                                  >
                                    I can cover
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="hs-detail">
                              <SessionDetail
                                session={s}
                                currentUserId={currentUserId}
                                currentUserName={currentUserName}
                                coordinatorName={coordinatorName}
                                isHostManager={isHostManager}
                                onClose={() => setSelected(null)}
                                onClaim={claimSession}
                                onSubRequest={submitSubRequest}
                                onUnclaim={unclaimSession}
                                onClaimSub={claimSub}
                                onReassignToSelf={reassignToSelf}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <Toast msg={toast} />
    </div>
  );
}
