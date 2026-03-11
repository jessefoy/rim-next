"use client";

import { useState, useCallback } from "react";

interface Session {
  id: string;
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
}

interface Program {
  slug: string;
  name: string;
  zoomLink: string | null;
  meetHostAccount: string | null;
}

interface Props {
  initialSessions: Session[];
  programs: Program[];
  initialYear: number;
  initialMonth: number; // 0-indexed
  currentUserId: string;
  currentUserName: string;
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString("en-US", opts ?? {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="hub-toast">{msg}</div>;
}

// ── Session Panel ─────────────────────────────────────────────────────────────

function SessionPanel({
  session: s,
  currentUserId,
  currentUserName,
  onClose,
  onClaim,
  onSubRequest,
  onUnclaim,
  onClaimSub,
}: {
  session: Session;
  currentUserId: string;
  currentUserName: string;
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

  const isOwn = s.hostUserId === currentUserId;
  const isUnclaimed = s.status === "unclaimed";
  const isSubNeeded = s.status === "sub_needed";
  const isClaimed = s.status === "claimed" && !isSubNeeded;

  return (
    <div className="hub-panel">
      <div className="hub-panel__head">
        <span className="hub-panel__heading">Session</span>
        <button
          className="hub-panel__close"
          onClick={onClose}
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      <span className={`hub-pill hub-pill--${s.status}`}>
        {s.status === "claimed" ? "Claimed" : s.status === "sub_needed" ? "Sub Needed" : "Needs Host"}
      </span>

      <h3 className="hub-panel__title">{s.programName}</h3>
      {s.sessionDate && (
        <div className="hub-panel__date">{fmtDate(s.sessionDate)}</div>
      )}

      {/* Host info card */}
      {isSubNeeded ? (
        <div className="hub-panel-info hub-panel-info--red">
          <div className="hub-panel-info__label">Sub Requested</div>
          {s.subMessage && <div className="hub-panel-info__msg">"{s.subMessage}"</div>}
        </div>
      ) : s.hostName ? (
        <div className="hub-panel-info hub-panel-info--teal">
          <div className="hub-panel-info__label">Host</div>
          <div className="hub-panel-info__value">{s.hostName}</div>
        </div>
      ) : (
        <div className="hub-panel-info hub-panel-info--amber">
          <div className="hub-panel-info__label">No host yet</div>
          <div className="hub-panel-info__value">This session needs someone to step up.</div>
        </div>
      )}

      {/* Actions */}
      {isUnclaimed && (
        <button
          className="hub-btn hub-btn--primary hub-btn--full"
          style={{ marginBottom: 10 }}
          onClick={() => onClaim(s.id)}
        >
          Claim This Session →
        </button>
      )}

      {isSubNeeded && s.subRequestId && !isOwn && (
        <button
          className="hub-btn hub-btn--danger hub-btn--full"
          style={{ marginBottom: 10 }}
          onClick={() => onClaimSub(s.id, s.subRequestId!)}
        >
          I&rsquo;ll Take This Session →
        </button>
      )}

      {isOwn && isClaimed && !subFormOpen && !removeWarnOpen && (
        <div className="hub-panel__actions">
          <button
            className="hub-btn hub-btn--ghost hub-btn--full"
            onClick={() => setSubFormOpen(true)}
          >
            I Need a Sub
          </button>
          <button
            className="hub-panel__remove-link"
            onClick={() => setRemoveWarnOpen(true)}
          >
            Remove myself from this session
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
            <button
              className="hub-btn hub-btn--secondary"
              onClick={() => { setSubFormOpen(false); setSubMsg(""); }}
            >
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
            <button
              className="hub-btn hub-btn--secondary"
              onClick={() => setRemoveWarnOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Google Meet link */}
      {s.zoomLink && (
        <div className="hub-panel__meet">
          <div className="hub-panel__meet-label">Google Meet</div>
          <a
            href={s.zoomLink}
            target="_blank"
            rel="noopener noreferrer"
            className="hub-panel__meet-link"
          >
            Join meeting →
          </a>
          {s.meetHostAccount && (
            <div className="hub-panel__meet-account">
              Sign in as <strong>{s.meetHostAccount}</strong>
            </div>
          )}
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
          <button
            className="hub-btn hub-btn--primary hub-btn--full"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? "Claiming…" : "Confirm — I'll host all of these →"}
          </button>
          <button
            className="hub-btn hub-btn--secondary hub-btn--full"
            onClick={onBack}
            disabled={submitting}
          >
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

  // Load sessions for a different month
  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setSelected(null);
    setMultiIds(new Set());
    try {
      const monthStr = `${y}-${String(m + 1).padStart(2, "0")}`;
      const res = await fetch(`/api/host/assignments?month=${monthStr}`);
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

      // Merge with static program info
      const programBySlug = new Map(programs.map((p) => [p.slug, p]));
      setSessions(
        data.map((a) => {
          const prog = programBySlug.get(a.programSlug);
          return {
            ...a,
            programName: prog?.name ?? a.programSlug,
            zoomLink: prog?.zoomLink ?? null,
            meetHostAccount: prog?.meetHostAccount ?? null,
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
    setYear(y);
    setMonth(m);
    loadMonth(y, m);
  }

  function nextMonth() {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    setYear(y);
    setMonth(m);
    loadMonth(y, m);
  }

  // Claim a single session
  async function claimSession(id: string) {
    try {
      const res = await fetch(`/api/host/assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim" }),
      });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error ?? "Something went wrong.");
        return;
      }
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: "claimed", hostUserId: currentUserId, hostName: currentUserName }
            : s
        )
      );
      setSelected((s) =>
        s?.id === id
          ? { ...s, status: "claimed", hostUserId: currentUserId, hostName: currentUserName }
          : s
      );
      showToast("✓ Session claimed — team notified.");
    } catch {
      showToast("Network error. Please try again.");
    }
  }

  // Submit sub request
  async function submitSubRequest(assignmentId: string, message: string) {
    const res = await fetch("/api/host/sub-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId, message: message.trim() || null }),
    });
    if (!res.ok) {
      const d = await res.json();
      showToast(d.error ?? "Something went wrong.");
      return;
    }
    setSessions((prev) =>
      prev.map((s) =>
        s.id === assignmentId
          ? { ...s, status: "sub_needed", subMessage: message.trim() || null }
          : s
      )
    );
    showToast("Sub request sent — team notified by email and dashboard alert.");
  }

  // Unclaim (remove self)
  async function unclaimSession(id: string) {
    const res = await fetch(`/api/host/assignments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unclaim" }),
    });
    if (!res.ok) {
      const d = await res.json();
      showToast(d.error ?? "Something went wrong.");
      return;
    }
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: "unclaimed", hostUserId: null, hostName: null, subRequestId: null, subMessage: null }
          : s
      )
    );
    showToast("You've been removed. The session is now unclaimed.");
  }

  // Claim sub
  async function claimSub(assignmentId: string, subRequestId: string) {
    const res = await fetch(`/api/host/sub-requests/${subRequestId}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const d = await res.json();
      showToast(d.error ?? "Something went wrong.");
      return;
    }
    setSessions((prev) =>
      prev.map((s) =>
        s.id === assignmentId
          ? { ...s, status: "claimed", hostUserId: currentUserId, hostName: currentUserName, subRequestId: null, subMessage: null }
          : s
      )
    );
    setSelected(null);
    showToast("✓ You're covering this session — the original host has been notified.");
  }

  // Multi-select
  function toggleMulti(id: string, status: string) {
    if (status === "claimed") return; // can't select claimed sessions
    setMultiIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function claimAll() {
    setClaiming(true);
    const ids = [...multiIds];
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/host/assignments/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "claim" }),
          })
        )
      );
      setSessions((prev) =>
        prev.map((s) =>
          ids.includes(s.id)
            ? { ...s, status: "claimed", hostUserId: currentUserId, hostName: currentUserName }
            : s
        )
      );
      showToast(`✓ ${ids.length} session${ids.length > 1 ? "s" : ""} claimed — team notified.`);
      setMultiIds(new Set());
      setConfirming(false);
      setSelected(null);
    } catch {
      showToast("Network error. Please try again.");
    } finally {
      setClaiming(false);
    }
  }

  // Calendar grid helpers
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  // Apply filter
  const filteredSessions = sessions.filter((s) => {
    if (filter === "mine") return s.hostUserId === currentUserId;
    if (filter === "action") return s.status === "unclaimed" || s.status === "sub_needed";
    return true;
  });

  const sessionsForDay = (day: number) => {
    return filteredSessions.filter((s) => {
      if (!s.sessionDate) return false;
      const d = new Date(s.sessionDate);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  return (
    <div className="hub-schedule">
      {/* Header */}
      <div className="hub-schedule__header">
        <div className="hub-schedule__nav">
          <button className="hub-schedule__nav-btn" onClick={prevMonth} aria-label="Previous month">←</button>
          <h2 className="hub-schedule__month">{MONTHS[month]} {year}</h2>
          <button className="hub-schedule__nav-btn" onClick={nextMonth} aria-label="Next month">→</button>
        </div>
        <div className="hub-schedule__controls">
          {/* Filter pills */}
          <div className="hub-schedule__filters">
            {(["all", "mine", "action"] as const).map((f) => (
              <button
                key={f}
                className={`hub-schedule__filter-btn${filter === f ? " hub-schedule__filter-btn--active" : ""}`}
                onClick={() => { setFilter(f); setMultiIds(new Set()); }}
              >
                {f === "all" ? "All" : f === "mine" ? "Mine" : "Needs Attention"}
              </button>
            ))}
          </div>
          <div className="hub-schedule__legend">
            {(["claimed", "unclaimed", "sub_needed"] as const).map((st) => (
              <div key={st} className="hub-schedule__legend-item">
                <span className={`hub-dot hub-dot--${st}`} />
                <span>{st === "claimed" ? "Claimed" : st === "unclaimed" ? "Needs Host" : "Sub Needed"}</span>
              </div>
            ))}
          </div>
          <div className="hub-schedule__view-toggle">
            <button
              className={`hub-schedule__view-btn${view === "calendar" ? " hub-schedule__view-btn--active" : ""}`}
              onClick={() => setView("calendar")}
              title="Calendar view"
            >
              📅
            </button>
            <button
              className={`hub-schedule__view-btn${view === "list" ? " hub-schedule__view-btn--active" : ""}`}
              onClick={() => setView("list")}
              title="List view"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {loading && <div className="hub-schedule__loading">Loading…</div>}

      {/* CALENDAR VIEW */}
      {view === "calendar" && !loading && (
        <div className="hub-cal-wrap">
          <div className="hub-cal">
            {/* Day headers */}
            <div className="hub-cal__headers">
              {DAYS.map((d) => (
                <div key={d} className="hub-cal__day-label">{d}</div>
              ))}
            </div>
            {/* Grid */}
            <div className="hub-cal__grid">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="hub-cal__cell hub-cal__cell--empty" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const daySessions = sessionsForDay(day);
                const todayCell = isToday(day);
                return (
                  <div
                    key={day}
                    className={`hub-cal__cell${todayCell ? " hub-cal__cell--today" : ""}`}
                  >
                    <div className={`hub-cal__day-num${todayCell ? " hub-cal__day-num--today" : ""}`}>
                      {day}
                    </div>
                    {daySessions.map((s) => {
                      const inMulti = multiIds.has(s.id);
                      return (
                        <div
                          key={s.id}
                          className={`hub-cal__event hub-cal__event--${s.status}${inMulti ? " hub-cal__event--selected" : ""}`}
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
                          <span className="hub-cal__event-label">
                            {inMulti ? "✓" : s.hostName ?? s.programName}
                          </span>
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

      {/* LIST VIEW */}
      {view === "list" && !loading && (
        <div className="hub-list">
          {filteredSessions.length === 0 ? (
            <p className="hub-empty">
              {filter === "mine"
                ? "You haven't claimed any sessions this month."
                : filter === "action"
                ? "No sessions need attention this month."
                : "No sessions this month."}
            </p>
          ) : (
            [...filteredSessions]
              .sort((a, b) => {
                if (!a.sessionDate) return 1;
                if (!b.sessionDate) return -1;
                return new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime();
              })
              .map((s) => (
                <div
                  key={s.id}
                  className={`hub-list__row hub-list__row--${s.status}`}
                  onClick={() => setSelected(s)}
                >
                  <div className="hub-list__date-block">
                    {s.sessionDate ? (
                      <>
                        <div className="hub-list__month">
                          {new Date(s.sessionDate).toLocaleDateString("en-US", { month: "short" })}
                        </div>
                        <div className="hub-list__day">
                          {new Date(s.sessionDate).getDate()}
                        </div>
                      </>
                    ) : (
                      <div className="hub-list__standing">—</div>
                    )}
                  </div>
                  <div className="hub-list__info">
                    <div className="hub-list__name">{s.programName}</div>
                    <div className="hub-list__host">
                      {s.hostName ? `Host: ${s.hostName}` : "No host assigned"}
                    </div>
                  </div>
                  <span className={`hub-pill hub-pill--${s.status}`}>
                    {s.status === "claimed" ? "Claimed" : s.status === "sub_needed" ? "Sub Needed" : "Needs Host"}
                  </span>
                </div>
              ))
          )}
        </div>
      )}

      {/* Multi-select footer */}
      {multiIds.size > 0 && (
        <div className="hub-multi-footer">
          <span>Selected <strong>{multiIds.size}</strong> session{multiIds.size > 1 ? "s" : ""}</span>
          <button
            className="hub-multi-footer__claim-btn"
            onClick={() => setConfirming(true)}
          >
            Review & Claim →
          </button>
          <button
            className="hub-multi-footer__clear-btn"
            onClick={() => setMultiIds(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {/* Multi-claim confirmation */}
      {confirming && (
        <MultiClaimModal
          sessions={sessions.filter((s) => multiIds.has(s.id))}
          onConfirm={claimAll}
          onBack={() => setConfirming(false)}
          submitting={claiming}
        />
      )}

      {/* Session detail panel */}
      {selected && (
        <>
          <div className="hub-panel-backdrop" onClick={() => setSelected(null)} />
          <SessionPanel
            session={selected}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onClose={() => setSelected(null)}
            onClaim={claimSession}
            onSubRequest={submitSubRequest}
            onUnclaim={unclaimSession}
            onClaimSub={claimSub}
          />
        </>
      )}

      <Toast msg={toast} />
    </div>
  );
}
