"use client";

/**
 * SessionLiveClient — time-aware, context-driven session view.
 *
 * Six states computed from schedule data + report status:
 *   1 — No session today
 *   2 — Session later today (>90 min out)
 *   3 — Getting ready (≤90 min to start)
 *   4 — Session is live  ← full visual treatment; all other sessions collapse to footnotes
 *   5 — Session ended, report not yet filed
 *   6 — Done (report submitted)
 *
 * Design principle: designed for the moment of panic, not the moment of calm.
 * One block gets full visual treatment at a time. Everything else is a footnote.
 */

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import PostSessionClient from "@/components/PostSessionClient";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Attendee {
  recordId: string;
  userId: string;
  displayName: string;
  isNewMember: boolean;
  returningAfterAbsence: boolean;
  flaggedByHost: boolean;
}

export interface Registrant {
  userId: string | null;
  displayName: string;
  email: string;
}

export interface NextSession {
  name: string;
  dayLabel: string;
  dateLabel: string;
  timeCT: string | null;
}

export interface SessionProgram {
  _id: string;
  slug: string;
  name: string;
  startTimeCT: string | null;
  endTimeCT: string | null;
  startDatetimeISO: string | null;   // actual shifted ISO for this occurrence
  endDatetimeISO: string | null;
  sessionDateISO: string;            // midnight CT ISO for this occurrence
  zoomLink: string | null;
  meetHostAccount: string | null;
  isRegistered: boolean;
  attendees: Attendee[];
  notYetJoined: Registrant[];
  sessionEnded: boolean;             // server-computed time-based flag
  sessionEndedAt: string | null;     // ISO — manually ended by host
  assignedHost: { id: string; name: string } | null;
  coHosts: Array<{ id: string; name: string }>;
  currentUserIsAssignedHost: boolean;
  currentUserIsCoHost: boolean;
  reportSubmitted: boolean;          // current user submitted the primary report
  coHostReportSubmitted: boolean;    // current user submitted a co-host reflection
  postSessionPath: string;
}

interface Props {
  programs: SessionProgram[];
  todayCT: string;
  canEndSession: boolean;
  hubSlug: string;
  nextSession: NextSession | null;
  isCoordinator: boolean;
  programsWithReportsToday: string[];
}

// ── State computation ─────────────────────────────────────────────────────────

type SessionState =
  | "later-today"    // State 2
  | "getting-ready"  // State 3
  | "live"           // State 4
  | "post-session"   // State 5
  | "done";          // State 6

function computeState(prog: SessionProgram): SessionState {
  const now = Date.now();
  const startMs = prog.startDatetimeISO ? new Date(prog.startDatetimeISO).getTime() : null;
  const endMs   = prog.endDatetimeISO   ? new Date(prog.endDatetimeISO).getTime()   : null;
  // No fallback end time — if endDatetime is not set, only a manual End Session
  // can transition out of State 4. Sessions should not auto-expire.

  const manuallyEnded = !!prog.sessionEndedAt;
  const timeEnded = endMs !== null && now > endMs;
  const isEnded = manuallyEnded || timeEnded;

  if (isEnded) {
    if (prog.currentUserIsAssignedHost) {
      return prog.reportSubmitted ? "done" : "post-session";
    }
    if (prog.currentUserIsCoHost) {
      return prog.coHostReportSubmitted ? "done" : "post-session";
    }
    // Neither — session is over, nothing to file
    return "post-session";
  }

  if (startMs === null) return "live"; // No schedule data → always show live view

  if (now >= startMs) return "live";

  const minutesToStart = (startMs - now) / 60_000;
  if (minutesToStart <= 90) return "getting-ready";

  return "later-today";
}

function minutesUntil(isoString: string): number {
  return Math.ceil((new Date(isoString).getTime() - Date.now()) / 60_000);
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Tappable attendee chips with clear new/returning/flagged indicators */
function AttendeeChips({
  attendees,
  flagging,
  onFlag,
}: {
  attendees: Attendee[];
  flagging: string | null;
  onFlag: (id: string) => void;
}) {
  return (
    <div className="sv-attendees">
      {attendees.map((a) => {
        const chipClass = [
          "sv-person",
          a.isNewMember                              ? "sv-person--new"       : "",
          a.returningAfterAbsence && !a.isNewMember ? "sv-person--returning" : "",
          a.flaggedByHost                            ? "sv-person--flagged"   : "",
          flagging === a.recordId                    ? "sv-person--toggling"  : "",
        ].filter(Boolean).join(" ");

        return (
          <button
            key={a.recordId}
            type="button"
            className={chipClass}
            onClick={() => onFlag(a.recordId)}
            title={a.flaggedByHost ? "Flagged — tap to unflag" : "Tap to flag for follow-up"}
          >
            <span className="sv-person__name">{a.displayName}</span>
            {a.isNewMember && (
              <span className="sv-person__label sv-person__label--new">New</span>
            )}
            {a.returningAfterAbsence && !a.isNewMember && (
              <span className="sv-person__label sv-person__label--returning">Welcome back</span>
            )}
            {a.flaggedByHost && <span className="sv-flag-dot" aria-label="Flagged" />}
          </button>
        );
      })}
    </div>
  );
}

function Roster({ notYetJoined, attendees }: { notYetJoined: Registrant[]; attendees: Attendee[] }) {
  if (notYetJoined.length === 0 && attendees.length === 0) return null;
  const allNames = [
    ...attendees.map((a) => ({ name: a.displayName, joined: true })),
    ...notYetJoined.map((r) => ({ name: r.displayName, joined: false })),
  ];
  return (
    <div className="sv-roster">
      <p className="sv-roster__label">{allNames.length} registered</p>
      <div className="sv-roster__names">
        {allNames.map((item, i) => (
          <span key={i} className={`sv-roster__name${item.joined ? " sv-roster__name--in" : ""}`}>
            {item.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function CoHostButton({
  slug,
  isCoHost,
  isAssignedHost,
  coHosts,
  onMark,
  marking,
}: {
  slug: string;
  isCoHost: boolean;
  isAssignedHost: boolean;
  coHosts: Array<{ id: string; name: string }>;
  onMark: (slug: string) => void;
  marking: boolean;
}) {
  if (isAssignedHost) return null;
  if (isCoHost) {
    return (
      <p className="sv-cohost-confirmed">
        You&rsquo;re set as co-host.{" "}
        {coHosts.length > 1 && (
          <span>Also hosting: {coHosts.filter((ch) => ch.id !== undefined).map((ch) => ch.name).join(", ")}</span>
        )}
      </p>
    );
  }
  return (
    <button
      type="button"
      className="sv-cohost-btn"
      disabled={marking}
      onClick={() => onMark(slug)}
    >
      {marking ? "Marking…" : "I'm also hosting this"}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SessionLiveClient({
  programs,
  todayCT,
  canEndSession,
  hubSlug,
  nextSession,
  isCoordinator,
  programsWithReportsToday,
}: Props) {
  const router = useRouter();

  const [flagging, setFlagging] = useState<string | null>(null);
  const [confirmEndSlug, setConfirmEndSlug] = useState<string | null>(null);
  const [endingSession, setEndingSession] = useState<string | null>(null);
  const [markingCoHost, setMarkingCoHost] = useState<string | null>(null);
  const [, forceUpdate] = useState(0); // triggers re-render for live state transitions

  // Poll every 60 seconds for new attendance + refresh state
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
      forceUpdate((n) => n + 1);
    }, 60_000);
    return () => clearInterval(interval);
  }, [router]);

  const toggleFlag = useCallback(async (recordId: string) => {
    if (flagging) return;
    setFlagging(recordId);
    try {
      await fetch(`/api/attendance/${recordId}/flag`, { method: "PATCH" });
      router.refresh();
    } catch { /* Silently ignore — flag state syncs on next poll */ }
    finally { setFlagging(null); }
  }, [flagging, router]);

  const endSession = useCallback(async (prog: SessionProgram) => {
    if (endingSession) return;
    setEndingSession(prog.slug);
    setConfirmEndSlug(null);
    try {
      await fetch(`/api/attendance/session/${prog.slug}/end`, { method: "POST" });
      router.refresh();
    } catch {
      // Silently ignore — state will transition naturally when session time passes
    } finally {
      setEndingSession(null);
    }
  }, [endingSession, router]);

  const markCoHost = useCallback(async (slug: string) => {
    if (markingCoHost) return;
    setMarkingCoHost(slug);
    try {
      await fetch(`/api/attendance/session/${slug}/cohost`, { method: "POST" });
      router.refresh();
    } catch { /* Silently ignore — co-host status syncs on next poll */ }
    finally { setMarkingCoHost(null); }
  }, [markingCoHost, router]);

  // ── State 1: No session today ──────────────────────────────────────────────
  if (programs.length === 0) {
    return (
      <div className="sv-state-wrap sv-state-wrap--1">
        <p className="sv-state-date">{todayCT}</p>
        <h2 className="sv-state-header">You don&rsquo;t have a session today.</h2>
        {nextSession ? (
          <p className="sv-state-body">
            Your next session is {nextSession.dayLabel}, {nextSession.dateLabel}
            {nextSession.timeCT ? ` at ${nextSession.timeCT}` : ""}
            {" — "}{nextSession.name}.
          </p>
        ) : (
          <p className="sv-state-body">No sessions scheduled in the next three weeks.</p>
        )}
      </div>
    );
  }

  // Compute states for all programs — used for visual hierarchy (one block dominant at a time)
  const progStates = programs.map((p) => ({ prog: p, state: computeState(p) }));
  const hasLive = progStates.some((ps) => ps.state === "live");

  return (
    <div className="sv-wrap">
      <p className="sv-date">{todayCT}</p>

      {progStates.map(({ prog, state }) => {
        const isEndingThis = endingSession === prog.slug;
        const isMarkingThis = markingCoHost === prog.slug;

        // ── Visual hierarchy: when a live session exists, collapse all others ──
        // Ended sessions become a single quiet line; upcoming sessions are footnotes.
        // This keeps the live block visually dominant with nothing competing.
        if (hasLive && state !== "live") {
          const isEnded = state === "post-session" || state === "done";
          return (
            <p key={prog._id} className="sv-session-footnote">
              {isEnded
                ? `${prog.name} ended earlier today.`
                : prog.startTimeCT
                  ? `${prog.name} starts later at ${prog.startTimeCT} CT.`
                  : `${prog.name} starts later today.`}
              {isEnded && (
                <>{" "}<a href={`/account/hub/${hubSlug}/session/history/team`} className="sv-session-footnote__link">See journal →</a></>
              )}
            </p>
          );
        }

        // ── State 2: Session later today ────────────────────────────────────
        if (state === "later-today") {
          return (
            <div key={prog._id} className="sv-state-wrap sv-state-wrap--2">
              <h2 className="sv-state-header">You have a session later today.</h2>
              <div className="sv-state-program">
                <span className="sv-state-program__name">{prog.name}</span>
                {(prog.startTimeCT || prog.endTimeCT) && (
                  <span className="sv-state-program__time">
                    {prog.startTimeCT}{prog.endTimeCT ? ` – ${prog.endTimeCT}` : ""}{" CT"}
                  </span>
                )}
              </div>

              {prog.zoomLink && (
                <div className="sv-meet-secondary">
                  <span className="sv-meet-label">Google Meet room</span>
                  {prog.meetHostAccount && (
                    <span className="sv-meet-account-label">Room account: {prog.meetHostAccount}</span>
                  )}
                  <a href={prog.zoomLink} className="sv-meet-link" target="_blank" rel="noopener noreferrer">
                    {prog.zoomLink}
                  </a>
                </div>
              )}

              {prog.isRegistered && (
                <Roster notYetJoined={prog.notYetJoined} attendees={prog.attendees} />
              )}

              <CoHostButton
                slug={prog.slug}
                isCoHost={prog.currentUserIsCoHost}
                isAssignedHost={prog.currentUserIsAssignedHost}
                coHosts={prog.coHosts}
                onMark={markCoHost}
                marking={isMarkingThis}
              />
            </div>
          );
        }

        // ── State 3: Getting ready ───────────────────────────────────────────
        if (state === "getting-ready") {
          const mins = prog.startDatetimeISO ? minutesUntil(prog.startDatetimeISO) : null;
          return (
            <div key={prog._id} className="sv-state-wrap sv-state-wrap--3">
              <h2 className="sv-state-header">
                {mins !== null ? `Your session starts in ${mins} minute${mins === 1 ? "" : "s"}.` : "Your session is starting soon."}
              </h2>

              {prog.zoomLink && (
                <a
                  href={prog.zoomLink}
                  className="sv-meet-primary-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Join Google Meet →
                </a>
              )}
              {prog.meetHostAccount && (
                <p className="sv-meet-account">Room: {prog.meetHostAccount}</p>
              )}

              <p className="sv-reminder">
                Open the room a few minutes early. Welcome each person by name as they arrive.
                The first 12 minutes are yours — guided arrival, brief opening, setting the space.
              </p>

              {prog.isRegistered && (
                <Roster notYetJoined={prog.notYetJoined} attendees={prog.attendees} />
              )}

              <CoHostButton
                slug={prog.slug}
                isCoHost={prog.currentUserIsCoHost}
                isAssignedHost={prog.currentUserIsAssignedHost}
                coHosts={prog.coHosts}
                onMark={markCoHost}
                marking={isMarkingThis}
              />
            </div>
          );
        }

        // ── State 4: Session is live ─────────────────────────────────────────
        if (state === "live") {
          return (
            <div key={prog._id} className="sv-state-wrap sv-state-wrap--4 sv-state-wrap--live">
              <div className="sv-live-header">
                <div className="sv-live-title-row">
                  <span className="sv-live-dot" aria-hidden="true" />
                  <h2 className="sv-live-title">Session is live — {prog.name}</h2>
                </div>
                <p className="sv-live-count">{prog.attendees.length} in the room</p>
              </div>

              {prog.attendees.length === 0 ? (
                <p className="sv-no-attendees">No one has joined yet.</p>
              ) : (
                <AttendeeChips attendees={prog.attendees} flagging={flagging} onFlag={toggleFlag} />
              )}

              {prog.notYetJoined.length > 0 && (
                <div className="sv-not-joined">
                  <p className="sv-not-joined__label">Registered but not here yet</p>
                  <div className="sv-not-joined__names">
                    {prog.notYetJoined.map((r, i) => (
                      <span key={r.userId ?? r.email ?? i} className="sv-not-joined__name">
                        {r.displayName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <CoHostButton
                slug={prog.slug}
                isCoHost={prog.currentUserIsCoHost}
                isAssignedHost={prog.currentUserIsAssignedHost}
                coHosts={prog.coHosts}
                onMark={markCoHost}
                marking={isMarkingThis}
              />

              {/* End Session — ghost style, low visual weight, below the attendee list */}
              {canEndSession && (
                <div className="sv-end-wrap">
                  <button
                    type="button"
                    className="sv-end-btn sv-end-btn--ghost"
                    disabled={!!isEndingThis}
                    onClick={() => setConfirmEndSlug(prog.slug)}
                  >
                    {isEndingThis ? "Ending…" : "End Session"}
                  </button>
                </div>
              )}

              {/* Confirmation dialog */}
              {confirmEndSlug === prog.slug && (
                <div className="sv-confirm-overlay" onClick={() => setConfirmEndSlug(null)}>
                  <div className="sv-confirm-dialog" onClick={(e) => e.stopPropagation()}>
                    <p className="sv-confirm-msg">
                      End {prog.name} and go to your post-session report?
                    </p>
                    <div className="sv-confirm-actions">
                      <button
                        type="button"
                        className="sv-confirm-yes"
                        onClick={() => endSession(prog)}
                      >
                        End Session
                      </button>
                      <button
                        type="button"
                        className="sv-confirm-no"
                        onClick={() => setConfirmEndSlug(null)}
                      >
                        Not yet
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        }

        // ── State 5: Session ended, report not filed ─────────────────────────
        if (state === "post-session") {
          const isReporter = prog.currentUserIsAssignedHost || prog.currentUserIsCoHost;
          const showAttendees = isReporter || isCoordinator;
          return (
            <div key={prog._id} className="sv-state-wrap sv-state-wrap--5">
              <div className="sv-live-header">
                <h2 className="sv-live-title sv-live-title--ended">{prog.name} — ended</h2>
                <p className="sv-live-count">{prog.attendees.length} in the room</p>
              </div>

              {/* Attendee list — visible to assigned host, co-host, and coordinators */}
              {showAttendees && (
                prog.attendees.length === 0 ? (
                  <p className="sv-no-attendees">No attendance recorded.</p>
                ) : (
                  <AttendeeChips attendees={prog.attendees} flagging={flagging} onFlag={toggleFlag} />
                )
              )}

              {isReporter ? (
                <>
                  <p className="sv-state-body sv-state-body--report-prompt">
                    Take a few minutes for your report — it only takes a few minutes and it helps the whole team.
                  </p>
                  <PostSessionClient
                    programSlug={prog.slug}
                    sessionDate={prog.sessionDateISO}
                    sessionDateDisplay={todayCT}
                    flaggedAttendees={prog.attendees
                      .filter((a) => a.flaggedByHost)
                      .map((a) => ({ attendanceId: a.recordId, displayName: a.displayName, note: null, action: "NONE" }))}
                    allAttendees={prog.attendees.map((a) => ({
                      attendanceId: a.recordId,
                      displayName: a.displayName,
                      flaggedByHost: a.flaggedByHost,
                    }))}
                    existingReflection={null}
                    existingResourceUrl={null}
                    existingResourceNote={null}
                    alreadySubmitted={false}
                    assignedHost={prog.assignedHost}
                    apiPath={
                      prog.currentUserIsCoHost && !prog.currentUserIsAssignedHost
                        ? `/api/attendance/session/${prog.slug}/cohost-report`
                        : `/api/attendance/session/${prog.slug}/post`
                    }
                    isCoHost={prog.currentUserIsCoHost && !prog.currentUserIsAssignedHost}
                    onSuccess={() => router.refresh()}
                  />
                </>
              ) : (
                <p className="sv-state-quiet">
                  <a href={`/account/hub/${hubSlug}/session/history/team`} className="sv-quiet-link">
                    See the team journal →
                  </a>
                </p>
              )}
            </div>
          );
        }

        // ── State 6: Done ────────────────────────────────────────────────────
        return (
          <div key={prog._id} className="sv-state-wrap sv-state-wrap--6">
            <h2 className="sv-state-header">You&rsquo;re done.</h2>
            <p className="sv-state-body">Your reflection has been added to the team journal.</p>
            <a
              href={`/account/hub/${hubSlug}/session/history/team`}
              className="sv-journal-link"
            >
              See the team journal →
            </a>
          </div>
        );
      })}

      {/* Coordinator section — only renders for HOST_MANAGER and ADMIN */}
      {isCoordinator && programs.length > 0 && (
        <div className="sv-coordinator-section">
          <h3 className="sv-coordinator-section__title">Coordinator</h3>
          {programs.filter((p) => !programsWithReportsToday.includes(p.slug)).length > 0 && (
            <div className="sv-missing-reports">
              <p className="sv-missing-reports__label">No report filed yet:</p>
              {programs
                .filter((p) => !programsWithReportsToday.includes(p.slug))
                .map((p) => (
                  <span key={p.slug} className="sv-missing-reports__item">{p.name}</span>
                ))}
            </div>
          )}
          <a href={`/account/hub/${hubSlug}/session/history`} className="sv-coordinator-link">
            View coordinator history →
          </a>
        </div>
      )}
    </div>
  );
}
