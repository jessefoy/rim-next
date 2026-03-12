"use client";

import { useState, useCallback } from "react";
import MeetJoinButton from "@/components/MeetJoinButton";

interface Session {
  id: string;
  programId: string | null;  // Sanity _id
  programSlug: string;
  programName: string;
  sessionDate: string | null;
  status: "unclaimed" | "claimed" | "sub_needed";
  hostUserId: string | null;
  hostName: string | null;
  subRequestId: string | null;
  subMessage: string | null;
  zoomLink: string | null;
  meetHostAccount: string | null;
  programFormat: string | null;
}

interface Program {
  id: string | null;  // Sanity _id
  slug: string;
  name: string;
  zoomLink: string | null;
  meetHostAccount: string | null;
  programFormat: string | null;
}

interface Props {
  initialSessions: Session[];
  programs: Program[];
  initialYear: number;
  initialMonth: number; // 0-indexed
  currentUserId: string;
  currentUserName: string;
  coordinatorName?: string; // Hub coordinator (optional — shown in session detail)
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

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    timeZone: "America/Chicago",
  });
}

/** "Jesse Foy" → "Jesse F." */
function shortName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function formatLabel(fmt: string | null) {
  if (!fmt) return null;
  if (fmt === "virtual") return "Virtual (Zoom)";
  if (fmt === "hybrid") return "Hybrid";
  if (fmt === "in-person") return "In Person";
  return fmt;
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
  onClose,
  onClaim,
  onSubRequest,
  onUnclaim,
  onClaimSub,
}: {
  session: Session;
  currentUserId: string;
  currentUserName: string;
  coordinatorName?: string;
  onClose: () => void;
  onClaim: (id: string) => void;
  onSubRequest: (id: string, message: string) => void;
  onUnclaim: (id: string) => void;
  onClaimSub: (id: string, subRequestId: string) => void;
}) {
  const [subFormOpen, setSubFormOpen] = useState(false);
  const [subMsg, setSubMsg] = useState("");
  const [removeWarnOpen, setRemoveWarnOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isOwn      = s.hostUserId === currentUserId;
  const isUnclaimed = s.status === "unclaimed";
  const isSubNeeded = s.status === "sub_needed";
  const isClaimed   = s.status === "claimed";

  const hostDisplay = isSubNeeded
    ? (s.hostName ? `${s.hostName} (needs sub)` : "Needs sub")
    : s.hostName ?? "None — open for coverage";

  // Subtitle: date · time CT · format
  const subtitle = s.sessionDate
    ? [fmtDate(s.sessionDate), fmtTime(s.sessionDate) + " CT", formatLabel(s.programFormat)].filter(Boolean).join(" · ")
    : null;

  // Status badge label
  const statusLabel = isUnclaimed ? "Needs Coverage" : isSubNeeded ? "Sub Needed" : null;

  return (
    <div className="hub-detail">
      <div className="hub-detail__top">
        <div className="hub-detail__title-row">
          <div>
            <h3 className="hub-detail__name">{s.programName}</h3>
            {subtitle && <div className="hub-detail__date">{subtitle}</div>}
          </div>
          {statusLabel && (
            <span className="hub-pill hub-pill--needs">{statusLabel}</span>
          )}
        </div>

        {/* Three-column info grid */}
        <div className="hub-detail__cols">
          <div className="hub-detail__col">
            <div className="hub-detail__col-label">Assigned Host</div>
            <div className="hub-detail__col-value">{hostDisplay}</div>
          </div>
          {s.programFormat && (
            <div className="hub-detail__col">
              <div className="hub-detail__col-label">Format</div>
              <div className="hub-detail__col-value">{formatLabel(s.programFormat)}</div>
            </div>
          )}
          {coordinatorName && (
            <div className="hub-detail__col">
              <div className="hub-detail__col-label">Coordinator</div>
              <div className="hub-detail__col-value">{coordinatorName}</div>
            </div>
          )}
        </div>

        {/* Meet link — shown separately below the grid when available */}
        {s.zoomLink && (
          <div className="hub-detail__meet">
            {s.programId ? (
              <MeetJoinButton
                programId={s.programId}
                programSlug={s.programSlug}
                zoomLink={s.zoomLink}
                className="hub-detail__meet-link"
              >
                Join Google Meet →
              </MeetJoinButton>
            ) : (
              <a href={s.zoomLink} target="_blank" rel="noopener noreferrer" className="hub-detail__meet-link">
                Join Google Meet →
              </a>
            )}
            {s.meetHostAccount && (
              <span className="hub-detail__meet-account">Sign in as {s.meetHostAccount}</span>
            )}
          </div>
        )}

        {s.subMessage && (
          <div className="hub-detail__sub-msg">
            <strong>Sub note:</strong> &ldquo;{s.subMessage}&rdquo;
          </div>
        )}
      </div>

      {/* Actions */}
      {!subFormOpen && !removeWarnOpen && (
        <div className="hub-detail__actions">
          {/* State 1: Needs coverage — Claim as Host + Request Sub + Dismiss */}
          {isUnclaimed && (
            <button className="hub-btn hub-btn--primary" onClick={() => onClaim(s.id)}>
              Claim as Host
            </button>
          )}
          {/* Sub-needed, non-own: Cover This Session */}
          {isSubNeeded && s.subRequestId && !isOwn && (
            <button className="hub-btn hub-btn--primary" onClick={() => onClaimSub(s.id, s.subRequestId!)}>
              Cover This Session
            </button>
          )}
          {/* Request Sub: unclaimed (notify team) OR own claimed session */}
          {(isUnclaimed || (isOwn && isClaimed)) && (
            <button className="hub-btn hub-btn--ghost" onClick={() => setSubFormOpen(true)}>
              Request Sub
            </button>
          )}
          {isOwn && (
            <button className="hub-btn hub-btn--ghost" onClick={() => setRemoveWarnOpen(true)}>
              Remove Myself
            </button>
          )}
          <button className="hub-btn hub-btn--secondary" onClick={onClose}>
            Dismiss
          </button>
        </div>
      )}

      {subFormOpen && (
        <div className="hub-panel__form">
          <div className="hub-panel__form-label">Add context for your team:</div>
          <textarea
            className="hub-form-textarea"
            rows={3}
            value={subMsg}
            onChange={(e) => setSubMsg(e.target.value)}
            placeholder="Why you need a sub, any handoff notes..."
          />
          <div className="hub-form-actions">
            <button
              className="hub-btn hub-btn--danger"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                await onSubRequest(s.id, subMsg);
                setSubmitting(false);
                setSubFormOpen(false);
                setSubMsg("");
              }}
            >
              {submitting ? "Sending…" : "Send Sub Request"}
            </button>
            <button className="hub-btn hub-btn--secondary" onClick={() => { setSubFormOpen(false); setSubMsg(""); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {removeWarnOpen && (
        <div className="hub-panel__warn">
          <div className="hub-panel__warn-title">Remove yourself?</div>
          <div className="hub-panel__warn-body">
            This leaves the session uncovered. The team will be notified.
          </div>
          <div className="hub-form-actions">
            <button
              className="hub-btn hub-btn--danger"
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
            <button className="hub-btn hub-btn--secondary" onClick={() => setRemoveWarnOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Multi-claim modal ─────────────────────────────────────────────────────────

function MultiClaimModal({
  sessions,
  onConfirm,
  onBack,
  submitting,
}: {
  sessions: Session[];
  onConfirm: () => void;
  onBack: () => void;
  submitting: boolean;
}) {
  return (
    <div className="hub-modal-overlay">
      <div className="hub-modal">
        <h3 className="hub-modal__title">Confirm your commitments</h3>
        <p className="hub-modal__body">
          You&rsquo;re committing to host these {sessions.length} sessions. Your team is counting on you.
        </p>
        <div className="hub-modal__session-list">
          {sessions.map((s) => (
            <div key={s.id} className="hub-modal__session-row">
              <span className="hub-dot hub-dot--unclaimed" />
              <div>
                <div className="hub-modal__session-name">{s.programName}</div>
                {s.sessionDate && (
                  <div className="hub-modal__session-date">{fmtShort(s.sessionDate)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="hub-modal__actions">
          <button className="hub-btn hub-btn--primary hub-btn--full" onClick={onConfirm} disabled={submitting}>
            {submitting ? "Claiming…" : "Confirm — I'll host all of these →"}
          </button>
          <button className="hub-btn hub-btn--secondary hub-btn--full" onClick={onBack} disabled={submitting}>
            Back
          </button>
        </div>
      </div>
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
  apiBase = "/api/host",
}: Props) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Session | null>(null);
  const [multiIds, setMultiIds] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "mine" | "action">("all");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setSelected(null);
    setMultiIds(new Set());
    try {
      const monthStr = `${y}-${String(m + 1).padStart(2, "0")}`;
      const res = await fetch(`${apiBase}/assignments?month=${monthStr}`);
      if (!res.ok) return;
      const data: Array<{
        id: string;
        programSlug: string;
        sessionDate: string | null;
        status: "unclaimed" | "claimed" | "sub_needed";
        hostUserId: string | null;
        hostName: string | null;
        subRequestId: string | null;
        subMessage: string | null;
      }> = await res.json();

      const programBySlug = new Map(programs.map((p) => [p.slug, p]));
      setSessions(
        data.map((a) => {
          const prog = programBySlug.get(a.programSlug);
          return {
            ...a,
            programId:       prog?.id ?? null,
            programName:     prog?.name ?? a.programSlug,
            zoomLink:        prog?.zoomLink ?? null,
            meetHostAccount: prog?.meetHostAccount ?? null,
            programFormat:   prog?.programFormat ?? null,
          };
        })
      );
    } catch {
      showToast("Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }, [programs]);

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

  async function claimSession(id: string) {
    try {
      const res = await fetch(`${apiBase}/assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim" }),
      });
      if (!res.ok) { const d = await res.json(); showToast(d.error ?? "Something went wrong."); return; }
      setSessions((prev) => prev.map((s) =>
        s.id === id ? { ...s, status: "claimed", hostUserId: currentUserId, hostName: currentUserName } : s
      ));
      setSelected((s) =>
        s?.id === id ? { ...s, status: "claimed", hostUserId: currentUserId, hostName: currentUserName } : s
      );
      showToast("✓ Session claimed — team notified.");
    } catch { showToast("Network error. Please try again."); }
  }

  async function submitSubRequest(assignmentId: string, message: string) {
    const res = await fetch(`${apiBase}/sub-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId, message: message.trim() || null }),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error ?? "Something went wrong."); return; }
    setSessions((prev) => prev.map((s) =>
      s.id === assignmentId ? { ...s, status: "sub_needed", subMessage: message.trim() || null } : s
    ));
    showToast("Sub request sent — team notified by email and dashboard alert.");
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
    showToast("You've been removed. The session is now unclaimed.");
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

  function toggleMulti(id: string, status: string) {
    if (status === "claimed") return;
    setMultiIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function claimAll() {
    setClaiming(true);
    const ids = [...multiIds];
    try {
      await Promise.all(ids.map((id) =>
        fetch(`${apiBase}/assignments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "claim" }),
        })
      ));
      setSessions((prev) => prev.map((s) =>
        ids.includes(s.id) ? { ...s, status: "claimed", hostUserId: currentUserId, hostName: currentUserName } : s
      ));
      showToast(`✓ ${ids.length} session${ids.length > 1 ? "s" : ""} claimed — team notified.`);
      setMultiIds(new Set());
      setConfirming(false);
      setSelected(null);
    } catch { showToast("Network error. Please try again."); }
    finally { setClaiming(false); }
  }

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const filteredSessions = sessions.filter((s) => {
    if (filter === "mine")   return s.hostUserId === currentUserId;
    if (filter === "action") return s.status === "unclaimed" || s.status === "sub_needed";
    return true;
  });

  const sessionsForDay = (day: number) =>
    filteredSessions.filter((s) => {
      if (!s.sessionDate) return false;
      const d = new Date(s.sessionDate);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });

  return (
    <div className="hub-schedule">

      {/* ── Row 1: Filter pills + Calendar/List toggle ── */}
      <div className="hub-schedule__filter-row">
        <div className="hub-schedule__filters">
          {(["all", "mine", "action"] as const).map((f) => (
            <button
              key={f}
              className={`hub-schedule__filter-btn${filter === f ? " hub-schedule__filter-btn--active" : ""}`}
              onClick={() => { setFilter(f); setMultiIds(new Set()); }}
            >
              {f === "all" ? "All Sessions" : f === "mine" ? "My Sessions" : "Needs Coverage"}
            </button>
          ))}
        </div>
        <div className="hub-schedule__view-toggle">
          <button
            className={`hub-schedule__view-btn${view === "calendar" ? " hub-schedule__view-btn--active" : ""}`}
            onClick={() => setView("calendar")}
          >
            Calendar
          </button>
          <button
            className={`hub-schedule__view-btn${view === "list" ? " hub-schedule__view-btn--active" : ""}`}
            onClick={() => setView("list")}
          >
            List
          </button>
        </div>
      </div>

      {/* ── Row 2: Month navigation ── */}
      <div className="hub-schedule__month-nav">
        <button className="hub-schedule__nav-btn" onClick={prevMonth} aria-label="Previous month">
          Previous
        </button>
        <h2 className="hub-schedule__month">{MONTHS[month]} {year}</h2>
        <button className="hub-schedule__nav-btn" onClick={nextMonth} aria-label="Next month">
          Next
        </button>
      </div>

      {loading && <div className="hub-schedule__loading">Loading…</div>}

      {/* ── CALENDAR VIEW ── */}
      {view === "calendar" && !loading && (
        <div className="hub-cal-wrap">
          <div className="hub-cal">
            <div className="hub-cal__headers">
              {DAYS.map((d) => <div key={d} className="hub-cal__day-label">{d}</div>)}
            </div>
            <div className="hub-cal__grid">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="hub-cal__cell hub-cal__cell--empty" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const daySessions = sessionsForDay(day);
                const todayCell = isToday(day);
                return (
                  <div key={day} className={`hub-cal__cell${todayCell ? " hub-cal__cell--today" : ""}`}>
                    <div className={`hub-cal__day-num${todayCell ? " hub-cal__day-num--today" : ""}`}>{day}</div>
                    {daySessions.map((s) => {
                      const inMulti = multiIds.has(s.id);
                      const isMine  = s.hostUserId === currentUserId;
                      const evtClass = isMine ? "mine" : (s.status === "claimed" ? "covered" : "needs");
                      const label = s.hostName
                        ? `${s.programName} · ${shortName(s.hostName)}`
                        : s.programName;
                      return (
                        <div
                          key={s.id}
                          className={`hub-cal__event hub-cal__event--${evtClass}${inMulti ? " hub-cal__event--selected" : ""}`}
                          onClick={() => setSelected(s)}
                        >
                          {s.status !== "claimed" && (
                            <input
                              type="checkbox"
                              className="hub-cal__check"
                              checked={inMulti}
                              onChange={() => toggleMulti(s.id, s.status)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Select ${s.programName}`}
                            />
                          )}
                          <span className="hub-cal__event-label">{inMulti ? "✓ " + s.programName : label}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === "list" && !loading && (
        <div className="hub-sched-list-outer">
        <div className="hub-sched-list-wrap">
          {filteredSessions.length === 0 ? (
            <p className="hub-empty" style={{ padding: "24px 20px" }}>
              {filter === "mine" ? "You haven't claimed any sessions this month."
                : filter === "action" ? "No sessions need attention this month."
                : "No sessions this month."}
            </p>
          ) : (
            <>
              <div className="hub-sched-list-head">
                <div className="hub-sched-list-head-cell">Date</div>
                <div className="hub-sched-list-head-cell">Program</div>
                <div className="hub-sched-list-head-cell">Time</div>
                <div className="hub-sched-list-head-cell">Host</div>
                <div className="hub-sched-list-head-cell">Status</div>
                <div className="hub-sched-list-head-cell hub-sched-list-head-cell--right">Action</div>
              </div>
              {[...filteredSessions]
                .sort((a, b) => {
                  if (!a.sessionDate) return 1;
                  if (!b.sessionDate) return -1;
                  return new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime();
                })
                .map((s) => {
                  const isMineRow = s.hostUserId === currentUserId;
                  const pillClass = isMineRow ? "mine" : (s.status === "claimed" ? "covered" : "needs");
                  const pillLabel = isMineRow ? "Your session" : (s.status === "claimed" ? "Covered" : "Needs Coverage");
                  const isExpanded = selected?.id === s.id;
                  return (
                    <div key={s.id}>
                      <div
                        className={`hub-sched-row${isExpanded ? " hub-sched-row--active" : ""}`}
                        onClick={() => setSelected(isExpanded ? null : s)}
                      >
                        <div className="hub-sched-row__date">
                          {s.sessionDate ? fmtShort(s.sessionDate) : "—"}
                        </div>
                        <div className="hub-sched-row__title">{s.programName}</div>
                        <div className="hub-sched-row__time">
                          {s.sessionDate ? fmtTime(s.sessionDate) : "—"}
                        </div>
                        <div className={`hub-sched-row__host${s.status === "unclaimed" ? " hub-sched-row__host--unassigned" : isMineRow ? " hub-sched-row__host--mine" : ""}`}>
                          {s.status === "unclaimed"
                            ? "Unassigned"
                            : isMineRow
                              ? `You (${s.hostName ?? currentUserName})`
                              : s.hostName ?? "—"}
                        </div>
                        <div>
                          <span className={`hub-pill hub-pill--${pillClass}`}>{pillLabel}</span>
                        </div>
                        <div className="hub-sched-row__action">
                          {s.status === "unclaimed" && (
                            <button
                              className="hub-btn hub-btn--claim hub-btn--sm"
                              onClick={(e) => { e.stopPropagation(); claimSession(s.id); }}
                            >
                              Claim
                            </button>
                          )}
                          {isMineRow && s.status === "claimed" && (
                            <button
                              className="hub-btn hub-btn--ghost hub-btn--sm"
                              onClick={(e) => { e.stopPropagation(); setSelected(s); }}
                            >
                              Request Sub
                            </button>
                          )}
                          {s.status === "sub_needed" && !isMineRow && s.subRequestId && (
                            <button
                              className="hub-btn hub-btn--claim hub-btn--sm"
                              onClick={(e) => { e.stopPropagation(); claimSub(s.id, s.subRequestId!); }}
                            >
                              Cover
                            </button>
                          )}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="hub-sched-row-panel">
                          <SessionDetail
                            session={s}
                            currentUserId={currentUserId}
                            currentUserName={currentUserName}
                            coordinatorName={coordinatorName}
                            onClose={() => setSelected(null)}
                            onClaim={claimSession}
                            onSubRequest={submitSubRequest}
                            onUnclaim={unclaimSession}
                            onClaimSub={claimSub}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
            </>
          )}
        </div>
        </div>
      )}

      {/* ── Legend (below calendar) ── */}
      <div className="hub-schedule__legend">
        <div className="hub-schedule__legend-item">
          <span className="hub-legend-swatch hub-legend-swatch--mine" />
          <span>My assignment</span>
        </div>
        <div className="hub-schedule__legend-item">
          <span className="hub-legend-swatch hub-legend-swatch--covered" />
          <span>Covered</span>
        </div>
        <div className="hub-schedule__legend-item">
          <span className="hub-legend-swatch hub-legend-swatch--needs" />
          <span>Needs coverage</span>
        </div>
      </div>

      {/* ── Multi-select footer ── */}
      {multiIds.size > 0 && (
        <div className="hub-multi-footer">
          <span>Selected <strong>{multiIds.size}</strong> session{multiIds.size > 1 ? "s" : ""}</span>
          <button className="hub-multi-footer__claim-btn" onClick={() => setConfirming(true)}>Review & Claim →</button>
          <button className="hub-multi-footer__clear-btn" onClick={() => setMultiIds(new Set())}>Clear</button>
        </div>
      )}

      {/* ── Multi-claim confirmation modal ── */}
      {confirming && (
        <MultiClaimModal
          sessions={sessions.filter((s) => multiIds.has(s.id))}
          onConfirm={claimAll}
          onBack={() => setConfirming(false)}
          submitting={claiming}
        />
      )}

      {/* ── Inline session detail — calendar view only (list view renders inline) ── */}
      {selected && view === "calendar" && (
        <SessionDetail
          session={selected}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          coordinatorName={coordinatorName}
          onClose={() => setSelected(null)}
          onClaim={claimSession}
          onSubRequest={submitSubRequest}
          onUnclaim={unclaimSession}
          onClaimSub={claimSub}
        />
      )}

      <Toast msg={toast} />
    </div>
  );
}
