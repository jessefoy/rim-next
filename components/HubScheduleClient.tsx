"use client";

import { useState, useCallback } from "react";
import RimProseEditor from "@/components/RimProseEditor";
import { renderBlockNoteHtml, extractBlockNoteText } from "@/lib/renderRichContent";

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
  subMessage: any;
  programFormat: string | null;
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
  if (fmt === "virtual") return "Virtual";
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
  const [subMsg, setSubMsg] = useState<any>(null);
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

  // Info items — only show what the card row didn't already tell you
  const infoItems: { label: string; value: string }[] = [];
  infoItems.push({ label: "Host", value: hostDisplay });
  if (s.programFormat) infoItems.push({ label: "Format", value: formatLabel(s.programFormat)! });
  if (coordinatorName) infoItems.push({ label: "Coordinator", value: coordinatorName });

  return (
    <div className="hub-detail">

      {/* Info line — compact, no headers, just label: value pairs */}
      <div className="hub-detail__info">
        {infoItems.map((item, i) => (
          <span key={item.label} className="hub-detail__info-item">
            {i > 0 && <span className="hub-detail__info-sep">·</span>}
            <span className="hub-detail__info-label">{item.label}:</span> {item.value}
          </span>
        ))}
      </div>

      {/* Video sessions are joined from the member dashboard */}

      {/* Sub note */}
      {s.subMessage && extractBlockNoteText(s.subMessage) && (
        <div className="hub-detail__sub-msg">
          <strong>Note:</strong>
          <div className="rim-content" dangerouslySetInnerHTML={{ __html: renderBlockNoteHtml(s.subMessage) }} />
        </div>
      )}

      {/* Actions — clear hierarchy: primary action is prominent, secondary actions are quiet */}
      {!subFormOpen && !removeWarnOpen && (
        <div className="hub-detail__actions">
          {isUnclaimed && (
            <button className="hub-detail__primary-btn" onClick={() => onClaim(s.id)}>
              Claim This Session
            </button>
          )}
          {isSubNeeded && s.subRequestId && !isOwn && (
            <button className="hub-detail__primary-btn" onClick={() => onClaimSub(s.id, s.subRequestId!)}>
              Cover This Session
            </button>
          )}
          <div className="hub-detail__secondary-actions">
            {(isUnclaimed || (isOwn && isClaimed)) && (
              <button className="hub-detail__link-btn" onClick={() => setSubFormOpen(true)}>
                Request Sub
              </button>
            )}
            {isOwn && (
              <button className="hub-detail__link-btn" onClick={() => setRemoveWarnOpen(true)}>
                Remove Myself
              </button>
            )}
            <button className="hub-detail__link-btn" onClick={onClose}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {subFormOpen && (
        <div className="hub-detail__form">
          <div className="hub-detail__form-label">Add context for your team:</div>
          <RimProseEditor
            value={subMsg}
            onChange={setSubMsg}
            placeholder="Why you need a sub, any handoff notes..."
            variant="compact"
          />
          <div className="hub-detail__form-actions">
            <button
              className="hub-detail__primary-btn"
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
            <button className="hub-detail__link-btn" onClick={() => { setSubFormOpen(false); setSubMsg(""); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {removeWarnOpen && (
        <div className="hub-detail__warn">
          <span className="hub-detail__warn-text">This leaves the session uncovered. The team will be notified.</span>
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
              {submitting ? "Removing…" : "Yes, Remove Me"}
            </button>
            <button className="hub-detail__link-btn" onClick={() => setRemoveWarnOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
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
  apiBase = "/api/host",
}: Props) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Session | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "mine" | "action">("all");

  // Mobile agenda: which day is selected in the mini-calendar
  const [agendaDay, setAgendaDay] = useState<number>(() => {
    const t = new Date();
    if (t.getFullYear() === initialYear && t.getMonth() === initialMonth) return t.getDate();
    return 1;
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setSelected(null);
    try {
      const monthStr = `${y}-${String(m + 1).padStart(2, "0")}`;
      const res = await fetch(`${apiBase}/assignments?month=${monthStr}`);
      if (!res.ok) return;
      // API now returns fully merged sessions (program occurrences + assignments)
      const data: Session[] = await res.json();
      setSessions(data);
    } catch {
      showToast("Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  function resetAgendaDay(y: number, m: number) {
    const t = new Date();
    setAgendaDay(y === t.getFullYear() && m === t.getMonth() ? t.getDate() : 1);
  }

  function prevMonth() {
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    setYear(y); setMonth(m); loadMonth(y, m); resetAgendaDay(y, m);
  }

  function nextMonth() {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    setYear(y); setMonth(m); loadMonth(y, m); resetAgendaDay(y, m);
  }

  function goToToday() {
    const t = new Date();
    setYear(t.getFullYear()); setMonth(t.getMonth());
    setAgendaDay(t.getDate());
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
      showToast("✓ Session claimed — team notified.");
    } catch (e) { showToast(e instanceof Error ? e.message : "Network error. Please try again."); }
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

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  /** Returns up to 3 dot-type strings for a day (one per unique status type) */
  function dotsForDay(day: number) {
    const ds = sessionsForDay(day);
    const seen = new Set<string>();
    const result: string[] = [];
    for (const s of ds) {
      const type = s.hostUserId === currentUserId ? "mine" : s.status === "claimed" ? "covered" : "needs";
      if (!seen.has(type)) { seen.add(type); result.push(type); }
      if (result.length === 3) break;
    }
    return result;
  }

  // Click a mini-cal day → scroll the card list to that day
  function scrollToDay(day: number) {
    setAgendaDay(day);
    setSelected(null);
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setTimeout(() => {
      document.querySelector(`[data-date="${dateStr}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  return (
    <div className="hub-schedule">

      {/* ── Filter pills ── */}
      <div className="hub-schedule__filters">
        {(["all", "mine", "action"] as const).map((f) => (
          <button
            key={f}
            className={`hub-schedule__filter-btn${filter === f ? " hub-schedule__filter-btn--active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All Sessions" : f === "mine" ? "My Sessions" : "Needs Coverage"}
          </button>
        ))}
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

      {/* ── Mini-calendar (at-a-glance date navigation) ── */}
      {!loading && (
        <div className="hub-mini-cal">
          <div className="hub-mini-cal__header">
            {DAYS.map((d) => <div key={d} className="hub-mini-cal__day-label">{d.charAt(0)}</div>)}
          </div>
          <div className="hub-mini-cal__grid">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`memp-${i}`} className="hub-mini-cal__cell hub-mini-cal__cell--empty" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dots = dotsForDay(day);
              const isSelected = agendaDay === day;
              const isTodayDay = isToday(day);
              return (
                <div
                  key={day}
                  className={`hub-mini-cal__cell${isSelected ? " hub-mini-cal__cell--selected" : ""}${isTodayDay && !isSelected ? " hub-mini-cal__cell--today" : ""}`}
                  onClick={() => scrollToDay(day)}
                >
                  <span className="hub-mini-cal__num">{day}</span>
                  {dots.length > 0 && (
                    <div className="hub-mini-cal__dots">
                      {dots.map((type) => (
                        <span key={type} className={`hub-mini-cal__dot hub-mini-cal__dot--${type}`} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Legend ── */}
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

      {/* ── Session list (click to expand detail inline) ── */}
      {!loading && (
        <div className="hub-lv">
          {filteredSessions.length === 0 ? (
            <p className="hub-empty">
              {filter === "mine" ? "You haven't claimed any sessions this month."
                : filter === "action" ? "No sessions need attention this month."
                : "No sessions this month."}
            </p>
          ) : (
            <div className="hub-lv__list">
              {[...filteredSessions]
                .sort((a, b) => {
                  if (!a.sessionDate) return 1;
                  if (!b.sessionDate) return -1;
                  return new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime();
                })
                .map((s, idx, arr) => {
                  const isMineRow = s.hostUserId === currentUserId;
                  const statusType = isMineRow ? "mine" : (s.status === "claimed" ? "covered" : "needs");
                  const hostLabel = s.status === "unclaimed"
                    ? "Unassigned"
                    : isMineRow
                      ? "You"
                      : s.hostName ?? "—";
                  const isExpanded = selected?.id === s.id;
                  const dateKey = s.sessionDate ? s.sessionDate.slice(0, 10) : "";
                  const isFirstForDate = idx === 0 || (arr[idx - 1].sessionDate?.slice(0, 10) !== dateKey);
                  return (
                    <div
                      key={s.id}
                      className={`hub-lv__card hub-lv__card--${statusType}${isExpanded ? " hub-lv__card--expanded" : ""}`}
                      {...(isFirstForDate && dateKey ? { "data-date": dateKey } : {})}
                    >
                      <div
                        className="hub-lv__card-main"
                        onClick={() => setSelected(isExpanded ? null : s)}
                      >
                        <div className="hub-lv__left">
                          <div className="hub-lv__title">{s.programName}</div>
                          <div className="hub-lv__meta">
                            {s.sessionDate ? fmtShort(s.sessionDate) : "—"}
                            {s.sessionDate && <span className="hub-lv__sep">·</span>}
                            {s.sessionDate ? fmtTime(s.sessionDate) : ""}
                            <span className="hub-lv__sep">·</span>
                            <span className={`hub-lv__host${s.status === "unclaimed" ? " hub-lv__host--unassigned" : isMineRow ? " hub-lv__host--mine" : ""}`}>
                              {hostLabel}
                            </span>
                          </div>
                        </div>
                        <div className="hub-lv__right">
                          {s.status === "unclaimed" && (
                            <button
                              className="hub-lv__action-btn hub-lv__action-btn--claim"
                              onClick={(e) => { e.stopPropagation(); claimSession(s.id); }}
                            >
                              Claim
                            </button>
                          )}
                          {isMineRow && s.status === "claimed" && (
                            <button
                              className="hub-lv__action-btn hub-lv__action-btn--ghost"
                              onClick={(e) => { e.stopPropagation(); setSelected(s); }}
                            >
                              Request Sub
                            </button>
                          )}
                          {s.status === "sub_needed" && !isMineRow && s.subRequestId && (
                            <button
                              className="hub-lv__action-btn hub-lv__action-btn--claim"
                              onClick={(e) => { e.stopPropagation(); claimSub(s.id, s.subRequestId!); }}
                            >
                              Cover
                            </button>
                          )}
                          {isMineRow && s.status === "claimed" && (
                            <span className="hub-lv__yours">Your session</span>
                          )}
                          {!isMineRow && s.status === "claimed" && (
                            <span className="hub-lv__covered">Covered</span>
                          )}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="hub-lv__detail">
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
            </div>
          )}
        </div>
      )}

      <Toast msg={toast} />
    </div>
  );
}
