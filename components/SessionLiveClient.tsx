"use client";

/**
 * SessionLiveClient — live view of who has clicked in to today's sessions.
 * Used by the Host Team hub Session tab.
 *
 * - Polls (router.refresh) every 60 seconds for updated attendance.
 * - Single tap on a name toggles flaggedByHost.
 * - "Close session & write notes →" button for HOST/HOST_MANAGER/ADMIN:
 *   sets sessionEndedAt on the SessionReport, then redirects to post-session form.
 * - Design principle: glanced at during a session, not worked.
 *   Names and subtle badges only. Process the whole view in 3 seconds.
 */

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

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

export interface SessionProgram {
  _id: string;
  slug: string;
  name: string;
  startTimeCT: string | null;
  endTimeCT: string | null;
  isRegistered: boolean;  // has registration enabled
  attendees: Attendee[];
  notYetJoined: Registrant[];  // registered but no attendance record today
  sessionEnded: boolean;       // time-based: scheduled end time has passed
  sessionEndedAt: string | null; // ISO string when host manually ended session
  assignedHost: { id: string; name: string } | null;
  postSessionPath: string;
}

interface Props {
  programs: SessionProgram[];
  todayCT: string;
  canEndSession: boolean; // true for HOST, HOST_MANAGER, ADMIN
}

function fmtEndedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  }) + " CT";
}

export default function SessionLiveClient({ programs, todayCT, canEndSession }: Props) {
  const router = useRouter();
  const [flagging, setFlagging] = useState<string | null>(null); // attendee recordId currently toggling
  const [endingSession, setEndingSession] = useState<string | null>(null); // program slug currently ending

  // Poll every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(interval);
  }, [router]);

  const toggleFlag = useCallback(async (recordId: string) => {
    if (flagging) return;
    setFlagging(recordId);
    try {
      await fetch(`/api/attendance/${recordId}/flag`, { method: "PATCH" });
      router.refresh();
    } catch {
      // Silently ignore — flag state will sync on next poll
    } finally {
      setFlagging(null);
    }
  }, [flagging, router]);

  const endSession = useCallback(async (prog: SessionProgram) => {
    if (endingSession) return;
    setEndingSession(prog.slug);
    try {
      await fetch(`/api/attendance/session/${prog.slug}/end`, { method: "POST" });
      router.push(prog.postSessionPath);
    } catch {
      setEndingSession(null); // Reset on error so button is usable again
    }
  }, [endingSession, router]);

  if (programs.length === 0) {
    return (
      <div className="sv-empty">
        <p className="sv-empty__text">No virtual or hybrid sessions scheduled for today.</p>
        <p className="sv-empty__sub">{todayCT}</p>
      </div>
    );
  }

  return (
    <div className="sv-wrap">
      <p className="sv-date">{todayCT}</p>

      {programs.map((prog) => {
        const isEnded = prog.sessionEnded || !!prog.sessionEndedAt;
        const showPostLink = isEnded;
        const isEndingThis = endingSession === prog.slug;

        return (
          <div key={prog._id} className="sv-program">
            <div className="sv-program__header">
              <h2 className="sv-program__name">{prog.name}</h2>
              {(prog.startTimeCT || prog.endTimeCT) && (
                <span className="sv-program__time">
                  {prog.startTimeCT}
                  {prog.endTimeCT ? ` – ${prog.endTimeCT}` : ""}
                  {" CT"}
                </span>
              )}
              <span className="sv-program__count">
                {prog.attendees.length} in
              </span>
            </div>

            {/* Manually ended badge — shows to everyone (so second host knows) */}
            {prog.sessionEndedAt && (
              <div className="sv-ended">
                <span className="sv-ended__label">Session closed</span>
                <span className="sv-ended__time">{fmtEndedTime(prog.sessionEndedAt)}</span>
              </div>
            )}

            {/* Assigned host — distinct from attendees, not tappable */}
            {prog.assignedHost && (
              <div className="sv-host-badge">
                <span className="sv-host-label">Hosting today</span>
                <span className="sv-host-name">{prog.assignedHost.name}</span>
              </div>
            )}

            {/* Attendees who have joined */}
            {prog.attendees.length === 0 ? (
              <p className="sv-no-attendees">No one has joined yet.</p>
            ) : (
              <div className="sv-attendees">
                {prog.attendees.map((a) => (
                  <button
                    key={a.recordId}
                    type="button"
                    className={`sv-person${a.flaggedByHost ? " sv-person--flagged" : ""}${flagging === a.recordId ? " sv-person--toggling" : ""}`}
                    onClick={() => toggleFlag(a.recordId)}
                    title={a.flaggedByHost ? "Flagged — tap to unflag" : "Tap to flag for follow-up"}
                  >
                    <span className="sv-person__name">{a.displayName}</span>
                    {a.isNewMember && (
                      <span className="sv-badge sv-badge--new">New</span>
                    )}
                    {a.returningAfterAbsence && !a.isNewMember && (
                      <span className="sv-badge sv-badge--returning">Welcome back</span>
                    )}
                    {a.flaggedByHost && (
                      <span className="sv-flag-dot" aria-label="Flagged" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Registered but not yet joined — muted, below attendees */}
            {prog.notYetJoined.length > 0 && (
              <div className="sv-not-joined">
                <p className="sv-not-joined__label">Registered, not yet in</p>
                <div className="sv-not-joined__names">
                  {prog.notYetJoined.map((r, i) => (
                    <span key={r.userId ?? r.email ?? i} className="sv-not-joined__name">
                      {r.displayName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Close session button — HOST/HOST_MANAGER/ADMIN, only while session is active */}
            {canEndSession && !isEnded && (
              <div className="sv-end-wrap">
                <button
                  type="button"
                  className="sv-end-btn"
                  disabled={!!isEndingThis}
                  onClick={() => endSession(prog)}
                >
                  {isEndingThis ? "Closing…" : "Close session & write notes →"}
                </button>
              </div>
            )}

            {/* Post-session link — appears after session ends (time-based or manual) */}
            {showPostLink && (
              <div className="sv-post-link">
                <a href={prog.postSessionPath} className="sv-post-link__btn">
                  Complete post-session form →
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
