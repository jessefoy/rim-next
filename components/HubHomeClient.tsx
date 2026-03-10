"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

interface Props {
  firstName: string;
  sessions: Session[];
  currentUserId: string;
  isManager: boolean;
  urgentAlerts: Session[];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ── Coordinator urgent alert banner ──────────────────────────────────────────

function AlertBanner({
  alerts,
  onClaim,
}: {
  alerts: Session[];
  onClaim: (s: Session) => void;
}) {
  const [open, setOpen] = useState(alerts.length === 1);

  if (!alerts.length) return null;
  return (
    <div className="hub-home-alert">
      <div className="hub-home-alert__label">Coordinator View</div>
      <div
        className="hub-home-alert__row"
        onClick={() => alerts.length > 1 && setOpen((o) => !o)}
        style={{ cursor: alerts.length > 1 ? "pointer" : "default" }}
      >
        <div className="hub-home-alert__summary">
          <span className="hub-home-alert__dot">🔴</span>
          <span className="hub-home-alert__text">
            {alerts.length === 1
              ? `${alerts[0].programName} — ${fmtDate(alerts[0].sessionDate!)} needs a host immediately`
              : `${alerts.length} sessions need a host immediately — within 3 days`}
          </span>
        </div>
        {alerts.length > 1 && (
          <span className="hub-home-alert__toggle">{open ? "▲ Hide" : "▼ Show all"}</span>
        )}
      </div>
      {(open || alerts.length === 1) && (
        <div className="hub-home-alert__list">
          {alerts.map((a) => (
            <div key={a.id} className="hub-home-alert__item">
              <div>
                <div className="hub-home-alert__item-name">{a.programName}</div>
                <div className="hub-home-alert__item-date">
                  {a.sessionDate ? fmtDate(a.sessionDate) : "—"}
                  {" · "}
                  {a.status === "sub_needed" ? "sub needed" : "no host"}
                </div>
              </div>
              <button className="hub-btn hub-btn--danger hub-btn--sm" onClick={() => onClaim(a)}>
                Claim Now
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Confirm claim modal ───────────────────────────────────────────────────────

function ClaimModal({
  session: s,
  onConfirm,
  onCancel,
  submitting,
}: {
  session: Session;
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  return (
    <div className="hub-modal-overlay">
      <div className="hub-modal">
        <h3 className="hub-modal__title">Confirm your commitment</h3>
        <p className="hub-modal__body">
          You&rsquo;re committing to host <strong>{s.programName}</strong>
          {s.sessionDate ? (
            <>
              {" "}on <strong>{fmtDate(s.sessionDate)}</strong>
            </>
          ) : null}
          . Your team is counting on you.
        </p>
        <div className="hub-modal__actions">
          <button
            className="hub-btn hub-btn--primary hub-btn--full"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? "Claiming…" : "Yes, I'll host this →"}
          </button>
          <button className="hub-btn hub-btn--secondary hub-btn--full" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="hub-toast">{msg}</div>;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HubHomeClient({
  firstName,
  sessions: initial,
  currentUserId,
  isManager,
  urgentAlerts: initialAlerts,
}: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>(initial);
  const [claimTarget, setClaimTarget] = useState<Session | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showAllMine, setShowAllMine] = useState(false);
  const [showAllSubs, setShowAllSubs] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const mySessions = sessions.filter((s) => s.hostUserId === currentUserId);
  const subSessions = sessions.filter(
    (s) => s.status === "sub_needed" && s.hostUserId !== currentUserId
  );
  const unclaimed = sessions.filter((s) => s.status === "unclaimed");

  // Alerts reflect live session state
  const urgentAlerts = isManager
    ? sessions.filter((s) => {
        if (s.status !== "unclaimed" && s.status !== "sub_needed") return false;
        if (!s.sessionDate) return false;
        const d = new Date(s.sessionDate);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + 3);
        return d <= cutoff;
      })
    : [];

  const allClear = mySessions.length > 0 && subSessions.length === 0 && unclaimed.length === 0;

  async function doClaim(s: Session) {
    setClaiming(true);
    try {
      const res = await fetch(`/api/host/assignments/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim" }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error ?? "Something went wrong.");
        return;
      }
      setSessions((prev) =>
        prev.map((x) =>
          x.id === s.id
            ? { ...x, status: "claimed", hostUserId: currentUserId, hostName: firstName }
            : x
        )
      );
      setClaimTarget(null);
      showToast("✓ Session claimed — your team has been notified.");
      router.refresh();
    } catch {
      showToast("Network error. Please try again.");
    } finally {
      setClaiming(false);
    }
  }

  const visibleMine = showAllMine ? mySessions : mySessions.slice(0, 3);
  const visibleSubs = showAllSubs ? subSessions : subSessions.slice(0, 2);

  return (
    <div className="hub-home">
      {/* Header */}
      <div className="hub-home__header">
        <h2 className="hub-home__title">Welcome back, {firstName}.</h2>
        <p className="hub-home__subtitle">Here&rsquo;s what needs your attention.</p>
      </div>

      {/* Coordinator alert banner — manager only */}
      {isManager && (
        <AlertBanner alerts={urgentAlerts} onClaim={(s) => setClaimTarget(s)} />
      )}

      {/* All-clear state */}
      {allClear && (
        <div className="hub-home-allclear">
          <span className="hub-home-allclear__icon">✅</span>
          <div>
            <div className="hub-home-allclear__title">Everything is covered this month.</div>
            <div className="hub-home-allclear__sub">
              All sessions have hosts. No subs needed. Well done, team.
            </div>
          </div>
        </div>
      )}

      {/* Cards row: My Sessions + Open Sub Requests */}
      <div className="hub-home-cards">
        {/* My Sessions */}
        <div className="hub-home-card">
          <div className="hub-home-card__header">Your Sessions This Month</div>
          <div className="hub-home-card__body">
            {mySessions.length === 0 ? (
              <p className="hub-home-card__empty">You haven&rsquo;t claimed any sessions yet.</p>
            ) : (
              visibleMine.map((s) => (
                <div key={s.id} className="hub-home-card__row">
                  <span
                    className={`hub-dot hub-dot--${s.status}`}
                    aria-label={s.status}
                  />
                  <div className="hub-home-card__row-info">
                    <div className="hub-home-card__row-name">{s.programName}</div>
                    {s.sessionDate && (
                      <div className="hub-home-card__row-date">{fmtDate(s.sessionDate)}</div>
                    )}
                  </div>
                  <span className={`hub-pill hub-pill--${s.status}`}>
                    {s.status === "claimed" ? "Claimed" : s.status === "sub_needed" ? "Sub Needed" : "Needs Host"}
                  </span>
                </div>
              ))
            )}
            {mySessions.length > 3 && (
              <button
                className="hub-home-card__more"
                onClick={() => setShowAllMine((o) => !o)}
              >
                {showAllMine ? "Show less" : `View all ${mySessions.length} →`}
              </button>
            )}
          </div>
          <div className="hub-home-card__footer">
            <Link href="/account/host/schedule" className="hub-btn hub-btn--primary hub-btn--full">
              View Full Schedule →
            </Link>
          </div>
        </div>

        {/* Open Sub Requests */}
        <div className="hub-home-card">
          <div className="hub-home-card__header">Open Sub Requests</div>
          <div className="hub-home-card__body">
            {subSessions.length === 0 ? (
              <p className="hub-home-card__empty">No open sub requests right now.</p>
            ) : (
              visibleSubs.map((s) => (
                <div key={s.id} className="hub-home-card__sub-row">
                  <div className="hub-home-card__sub-top">
                    <span className="hub-dot hub-dot--sub_needed" aria-label="sub needed" />
                    <span className="hub-home-card__row-name">{s.programName}</span>
                    {s.sessionDate && (
                      <span className="hub-home-card__sub-date">{fmtDate(s.sessionDate)}</span>
                    )}
                  </div>
                  {s.subMessage && (
                    <div className="hub-home-card__sub-msg">"{s.subMessage}"</div>
                  )}
                </div>
              ))
            )}
            {subSessions.length > 2 && (
              <button
                className="hub-home-card__more"
                onClick={() => setShowAllSubs((o) => !o)}
              >
                {showAllSubs ? "Show less" : `View all ${subSessions.length} →`}
              </button>
            )}
          </div>
          <div className="hub-home-card__footer">
            <Link
              href="/account/host/schedule"
              className={`hub-btn hub-btn--full ${subSessions.length ? "hub-btn--danger" : "hub-btn--secondary"}`}
              aria-disabled={!subSessions.length}
            >
              {subSessions.length ? "Claim a Sub →" : "No subs needed"}
            </Link>
          </div>
        </div>
      </div>

      {/* Sessions Needing a Host */}
      {unclaimed.length > 0 && (
        <div className="hub-home-open">
          <div className="hub-home-open__header">
            <div className="hub-home-open__title">Sessions Needing a Host</div>
            <span className="hub-home-open__badge">{unclaimed.length} open</span>
          </div>
          <div className="hub-home-open__grid">
            {unclaimed.slice(0, 4).map((s) => (
              <div key={s.id} className="hub-home-open__card">
                {s.sessionDate && (
                  <div className="hub-home-open__card-date">{fmtDate(s.sessionDate)}</div>
                )}
                <div className="hub-home-open__card-name">{s.programName}</div>
                <button
                  className="hub-home-open__claim-btn"
                  onClick={() => setClaimTarget(s)}
                >
                  Claim
                </button>
              </div>
            ))}
            {unclaimed.length > 4 && (
              <Link href="/account/host/schedule" className="hub-home-open__more">
                +{unclaimed.length - 4} more →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Claim confirmation modal */}
      {claimTarget && (
        <ClaimModal
          session={claimTarget}
          onConfirm={() => doClaim(claimTarget)}
          onCancel={() => setClaimTarget(null)}
          submitting={claiming}
        />
      )}

      <Toast msg={toast} />
    </div>
  );
}
