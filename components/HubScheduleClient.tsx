"use client";

/**
 * Host schedule — volunteer-friendly view.
 * Designed for low-tech, overwhelmed users (60+ volunteers).
 *
 * Architecture:
 * - No calendar grid. Two clear sections: "You're hosting" and "Needs a host."
 * - One primary action label: "Yes, I can host this."
 * - One secondary action on owned sessions: "Ask the team to cover."
 * - Explicit confirmation modals (not silent two-tap toggles).
 * - Manager extras (reassign, see all sessions) live behind a quiet toggle.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmtDateLong(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    timeZone: "America/Chicago",
  });
}

function fmtDateShort(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    timeZone: "America/Chicago",
  });
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/Chicago",
  });
}

function fmtFormat(fmt: string | null): string | null {
  if (fmt === "virtual") return "Virtual";
  if (fmt === "hybrid") return "In-person and virtual";
  if (fmt === "in-person") return "In person";
  return null;
}

/** Returns CT-midnight Date for the Monday of the current week. */
function getThisMonday(): Date {
  const TZ = "America/Chicago";
  const ctNow = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const dayOfWeek = ctNow.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(ctNow);
  monday.setDate(monday.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** CT-midnight for the start of today. */
function getToday(): Date {
  const TZ = "America/Chicago";
  const ctNow = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  ctNow.setHours(0, 0, 0, 0);
  return ctNow;
}

interface Bucket {
  key: string;
  label: string;
  sessions: Session[];
  primary: boolean; // primary = full cards; secondary = compact
}

/** Group sessions by relative time. Only buckets when viewing the current month. */
function bucketSessions(sessions: Session[], isCurrentMonth: boolean): Bucket[] {
  if (!isCurrentMonth) {
    if (sessions.length === 0) return [];
    return [{ key: "all", label: "", sessions, primary: false }];
  }
  const monday = getThisMonday();
  const nextMondayMs = monday.getTime() + 7 * 24 * 60 * 60 * 1000;
  const weekAfterMs = monday.getTime() + 14 * 24 * 60 * 60 * 1000;

  const thisWeek: Session[] = [];
  const nextWeek: Session[] = [];
  const later: Session[] = [];
  for (const s of sessions) {
    if (!s.sessionDate) { later.push(s); continue; }
    const ms = new Date(s.sessionDate).getTime();
    if (ms < nextMondayMs) thisWeek.push(s);
    else if (ms < weekAfterMs) nextWeek.push(s);
    else later.push(s);
  }
  const buckets: Bucket[] = [];
  if (thisWeek.length > 0) buckets.push({ key: "this-week", label: "This week", sessions: thisWeek, primary: true });
  if (nextWeek.length > 0) buckets.push({ key: "next-week", label: "Next week", sessions: nextWeek, primary: false });
  if (later.length > 0)    buckets.push({ key: "later", label: "Later this month", sessions: later, primary: false });
  return buckets;
}

function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="hub-toast">{msg}</div>;
}

// ── Confirmation modal ──────────────────────────────────────

type ModalKind = "take" | "ask-cover" | "reassign" | null;

interface ModalProps {
  kind: ModalKind;
  session: Session | null;
  onConfirm: (extra?: any) => Promise<void> | void;
  onCancel: () => void;
  submitting: boolean;
}

function HsModal({ kind, session, onConfirm, onCancel, submitting }: ModalProps) {
  const [coverNote, setCoverNote] = useState<any>(null);

  // Reset note when modal opens for a new session
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

  if (kind === "take") {
    title = "Confirm hosting";
    body = (
      <>
        You'll host <strong>{session.programName}</strong> on{" "}
        <strong>{dateStr}</strong> at <strong>{timeStr}</strong>. The team
        will be notified.
      </>
    );
    primaryLabel = "Yes, I'll host this";
  } else if (kind === "ask-cover") {
    title = "Ask the team to cover";
    body = (
      <>
        Let your teammates know you can't make <strong>{dateStr}</strong> for{" "}
        <strong>{session.programName}</strong>. They'll receive an email and
        someone may step in.
      </>
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
  } else if (kind === "reassign") {
    title = "Reassign to yourself";
    body = session.hostUserId
      ? (
        <>
          This will remove <strong>{session.hostName ?? "the current host"}</strong>{" "}
          from <strong>{session.programName}</strong> on{" "}
          <strong>{dateStr}</strong> and assign you instead. They will be
          notified. Any open request to the team will be closed.
        </>
      )
      : (
        <>
          This will assign you to <strong>{session.programName}</strong> on{" "}
          <strong>{dateStr}</strong>.
        </>
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
            Not yet
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Session card ────────────────────────────────────────────

type CardKind = "needs" | "yours" | "yours-asking" | "covered";

interface CardProps {
  session: Session;
  kind: CardKind;
  compact?: boolean;
  onTake: (s: Session) => void;
  onAskCover: (s: Session) => void;
  onReassign: (s: Session) => void;
  isHostManager: boolean;
}

function HsCard({ session, kind, compact = false, onTake, onAskCover, onReassign, isHostManager }: CardProps) {
  const dateLong = fmtDateLong(session.sessionDate);
  const dateShort = fmtDateShort(session.sessionDate);
  const timeStr = fmtTime(session.sessionDate);
  const fmt = fmtFormat(session.programFormat);
  const showManager = isHostManager && (kind === "needs" || kind === "covered");

  // Compact: horizontal row, scannable, smaller action.
  if (compact) {
    return (
      <div className={`hs-card hs-card--compact hs-card--${kind}`}>
        <div className="hs-card__main">
          <div className="hs-card__when-line">
            {dateShort}
            {timeStr && <> · <span className="hs-card__time">{timeStr}</span></>}
          </div>
          <div className="hs-card__what-line">
            <span className="hs-card__name">{session.programName}</span>
            {fmt && <span className="hs-card__format"> · {fmt}</span>}
          </div>
        </div>
        <div className="hs-card__do hs-card__do--compact">
          {kind === "needs" && (
            <button
              className="lr-btn lr-btn--host"
              onClick={() => onTake(session)}
            >
              Yes, I can host
            </button>
          )}
          {kind === "yours" && (
            <button className="hs-card__quiet" onClick={() => onAskCover(session)}>
              Ask the team to cover
            </button>
          )}
          {kind === "yours-asking" && (
            <span className="hs-card__status hs-card__status--asking">
              Waiting for a sub
            </span>
          )}
          {kind === "covered" && session.hostName && (
            <span className="hs-card__status hs-card__status--covered">
              {session.hostName}
            </span>
          )}
          {showManager && (
            <button className="hs-card__manager" onClick={() => onReassign(session)}>
              Reassign to me
            </button>
          )}
        </div>
      </div>
    );
  }

  // Full card: vertical, generous, big action — used for urgent (this-week) needs.
  return (
    <div className={`hs-card hs-card--${kind}`}>
      <div className="hs-card__when">
        <div className="hs-card__date">{dateLong}</div>
        <div className="hs-card__time">{timeStr}</div>
      </div>
      <div className="hs-card__what">
        <h3 className="hs-card__name">{session.programName}</h3>
        {fmt && <div className="hs-card__format">{fmt}</div>}
      </div>
      <div className="hs-card__do">
        {kind === "needs" && (
          <button
            className="lr-btn lr-btn--host hs-card__primary"
            onClick={() => onTake(session)}
          >
            Yes, I can host this
          </button>
        )}
        {kind === "yours" && (
          <>
            <div className="hs-card__status hs-card__status--yours">
              You're hosting
            </div>
            <button className="hs-card__quiet" onClick={() => onAskCover(session)}>
              Can't make it? Ask the team to cover
            </button>
          </>
        )}
        {kind === "yours-asking" && (
          <>
            <div className="hs-card__status hs-card__status--asking">
              You asked the team to cover
            </div>
            <p className="hs-card__quiet-note">
              Waiting for a teammate to step in.
            </p>
          </>
        )}
        {kind === "covered" && session.hostName && (
          <div className="hs-card__status hs-card__status--covered">
            Hosted by {session.hostName}
          </div>
        )}
      </div>
      {showManager && (
        <button className="hs-card__manager" onClick={() => onReassign(session)}>
          Reassign to me
        </button>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────

export default function HubScheduleClient({
  initialSessions,
  initialYear,
  initialMonth,
  currentUserId,
  currentUserName,
  isHostManager = false,
  apiBase = "/api/host",
}: Props) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showAllOthers, setShowAllOthers] = useState(false);

  const [modal, setModal] = useState<{ kind: ModalKind; session: Session | null }>({
    kind: null, session: null,
  });
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

  async function takeSession(s: Session, isReassign: boolean) {
    if (isReassign) {
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
        throw new Error(d.error ?? "Something went wrong.");
      }
      const data = await res.json();
      setSessions(prev => prev.map(row => row.id === s.id
        ? { ...row, id: data.id, status: "claimed", hostUserId: currentUserId, hostName: currentUserName, subRequestId: null, subMessage: null }
        : row
      ));
      return;
    }
    if (s.id.startsWith("unassigned::")) {
      const res = await fetch(`${apiBase}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    // claim a sub on someone else's session, or take a directly-unclaimed assignment
    if (s.status === "sub_needed" && s.subRequestId && s.hostUserId !== currentUserId) {
      const res = await fetch(`${apiBase}/sub-requests/${s.subRequestId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      return;
    }
    const res = await fetch(`${apiBase}/assignments/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
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

  async function askForCover(s: Session, message: any) {
    const text = extractBlockNoteText(message ?? null).trim();
    const messagePayload = text ? message : null;

    const res = await fetch(`${apiBase}/sub-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  // ── Modal handlers ──

  function openTake(s: Session) { setModal({ kind: "take", session: s }); }
  function openAskCover(s: Session) { setModal({ kind: "ask-cover", session: s }); }
  function openReassign(s: Session) { setModal({ kind: "reassign", session: s }); }
  function closeModal() {
    if (modalSubmitting) return;
    setModal({ kind: null, session: null });
  }

  async function handleConfirm(extra?: any) {
    if (!modal.session) return;
    setModalSubmitting(true);
    try {
      if (modal.kind === "take") {
        await takeSession(modal.session, false);
        showToast("Thank you — you're hosting. The team has been notified.");
      } else if (modal.kind === "ask-cover") {
        await askForCover(modal.session, extra);
        showToast("Done. The team will help find a replacement.");
      } else if (modal.kind === "reassign") {
        await takeSession(modal.session, true);
        showToast("Reassigned to you.");
      }
      setModal({ kind: null, session: null });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setModalSubmitting(false);
    }
  }

  // ── Derived ──

  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const todayMs = useMemo(() => getToday().getTime(), []);

  const sortByDate = (a: Session, b: Session) => {
    if (!a.sessionDate) return 1;
    if (!b.sessionDate) return -1;
    return new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime();
  };

  // For the current month, filter out sessions that already happened.
  // For other months, show everything (historical or future).
  const visibleSessions = useMemo(() => {
    if (!isCurrentMonth) return sessions;
    return sessions.filter(s => {
      if (!s.sessionDate) return true;
      return new Date(s.sessionDate).getTime() >= todayMs;
    });
  }, [sessions, isCurrentMonth, todayMs]);

  const yours = useMemo(() =>
    visibleSessions.filter(s => s.hostUserId === currentUserId).slice().sort(sortByDate),
    [visibleSessions, currentUserId],
  );
  const needs = useMemo(() =>
    visibleSessions.filter(s =>
      (s.status !== "claimed" || s.subRequestId) &&
      s.hostUserId !== currentUserId
    ).slice().sort(sortByDate),
    [visibleSessions, currentUserId],
  );
  const covered = useMemo(() =>
    visibleSessions.filter(s =>
      s.status === "claimed" && !s.subRequestId && s.hostUserId !== currentUserId
    ).slice().sort(sortByDate),
    [visibleSessions, currentUserId],
  );

  const needsBuckets = useMemo(() => bucketSessions(needs, isCurrentMonth), [needs, isCurrentMonth]);
  const yoursBuckets = useMemo(() => bucketSessions(yours, isCurrentMonth), [yours, isCurrentMonth]);
  const coveredBuckets = useMemo(() => bucketSessions(covered, isCurrentMonth), [covered, isCurrentMonth]);

  const cardHandlers = {
    onTake: openTake,
    onAskCover: openAskCover,
    onReassign: openReassign,
    isHostManager,
  };

  const monthLabel = `${MONTHS[month]} ${year}`;
  const periodPhrase = isCurrentMonth ? "this month" : `in ${MONTHS[month]}`;

  return (
    <div className="hs-page">
      {/* Month nav */}
      <div className="hs-monthnav">
        <button className="hs-monthnav__btn" onClick={prevMonth} aria-label="Previous month">←</button>
        <h1 className="hs-monthnav__label">{monthLabel}</h1>
        <button className="hs-monthnav__btn" onClick={nextMonth} aria-label="Next month">→</button>
        {!isCurrentMonth && (
          <button className="hs-monthnav__today" onClick={goToCurrentMonth}>
            This month
          </button>
        )}
      </div>

      {loading ? (
        <p className="hs-loading">Loading…</p>
      ) : (
        <>
          {/* Needs — primary section, the hub's purpose */}
          {needs.length > 0 ? (
            <section className="hs-section">
              <h2 className="hs-section__heading">
                {needs.length}{" "}
                {needs.length === 1 ? "session needs" : "sessions need"} a host {periodPhrase}.
              </h2>
              {needsBuckets.map(bucket => (
                <div key={bucket.key} className="hs-bucket">
                  {bucket.label && <h3 className="hs-bucket__label">{bucket.label}</h3>}
                  <div className="hs-cards">
                    {bucket.sessions.map(s => (
                      <HsCard
                        key={s.id}
                        session={s}
                        kind="needs"
                        compact={!bucket.primary}
                        {...cardHandlers}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ) : (
            <div className="hs-allset">
              <p className="hs-allset__heading">
                All sessions {periodPhrase} have a host.
              </p>
              <p className="hs-allset__sub">
                Thank you for being part of this team.
              </p>
            </div>
          )}

          {/* Yours — secondary section, all compact */}
          {yours.length > 0 && (
            <section className="hs-section hs-section--secondary">
              <h2 className="hs-section__heading hs-section__heading--small">
                You're hosting {yours.length}{" "}
                {yours.length === 1 ? "session" : "sessions"} {periodPhrase}.
              </h2>
              {yoursBuckets.map(bucket => (
                <div key={bucket.key} className="hs-bucket">
                  {bucket.label && <h3 className="hs-bucket__label">{bucket.label}</h3>}
                  <div className="hs-cards">
                    {bucket.sessions.map(s => (
                      <HsCard
                        key={s.id}
                        session={s}
                        kind={s.subRequestId ? "yours-asking" : "yours"}
                        compact
                        {...cardHandlers}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Manager: covered sessions, collapsed */}
          {isHostManager && covered.length > 0 && (
            <section className="hs-section hs-section--minor">
              <button
                className="hs-collapse-toggle"
                onClick={() => setShowAllOthers(v => !v)}
                aria-expanded={showAllOthers}
              >
                {showAllOthers ? "Hide" : "Show"} sessions already covered ({covered.length})
              </button>
              {showAllOthers && coveredBuckets.map(bucket => (
                <div key={bucket.key} className="hs-bucket">
                  {bucket.label && <h3 className="hs-bucket__label">{bucket.label}</h3>}
                  <div className="hs-cards">
                    {bucket.sessions.map(s => (
                      <HsCard key={s.id} session={s} kind="covered" compact {...cardHandlers} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
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
    </div>
  );
}
