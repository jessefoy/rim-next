"use client";

/**
 * /session/[slug] — Dedicated full-page video session room.
 * Members arrive here from the dashboard "Join" button.
 * Guests arrive via ?key=xxx for open-access programs.
 *
 * Auth-gated for members; key-gated for guests.
 * The page fetches a LiveKit token, connects to the room, and
 * shows the video conference full-page with a clean header.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import ViewToggle, { type SessionView } from "@/components/session/ViewToggle";
import RoomErrorBoundary from "@/components/session/RoomErrorBoundary";
import type { LeaveKind } from "@/components/VideoRoom";

const VideoRoom = dynamic(() => import("@/components/VideoRoom"), { ssr: false });

const VIEW_LS_KEY = "rim-livekit-view";

function readView(): SessionView {
  if (typeof window === "undefined") return "gallery";
  try {
    const v = localStorage.getItem(VIEW_LS_KEY);
    return v === "speaker" ? "speaker" : "gallery";
  } catch {
    return "gallery";
  }
}

type State = "loading" | "guest-name" | "ready" | "connected" | "error" | "left" | "connection-lost" | "duplicate" | "removed";

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const guestKey = searchParams.get("key");

  const [state, setState] = useState<State>(guestKey ? "guest-name" : "loading");
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [programName, setProgramName] = useState<string>("");
  const [sessionDate, setSessionDate] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // Permission model — see lib/livekitAuth.ts. Identity (isSessionHost) is
  // separate from capability (hasEndAllAuthority). The pill on a tile is
  // driven by identity; the End button label and end-session gate use
  // capability. An ADMIN joining without an assignment will have
  // hasEndAllAuthority=true but isSessionHost=false — they keep the safety
  // override without misrepresenting themselves as the assigned host.
  const [isSessionHost, setIsSessionHost] = useState(false);
  const [hasEndAllAuthority, setHasEndAllAuthority] = useState(false);
  const [isCoHost, setIsCoHost] = useState(false);
  const [isHostTeam, setIsHostTeam] = useState(false);
  const [isProgramTeacher, setIsProgramTeacher] = useState(false);
  const [audioProfile, setAudioProfile] = useState<"teacher" | "speaker" | "listener">("listener");
  const [steppingIn, setSteppingIn] = useState(false);
  // Whether a designated host is present in the room (Host metadata flag on
  // any participant). null = unknown (room not mounted yet). Drives the
  // context-aware Step-In label so the button explains itself: it exists
  // for the no-host moment, not as an instruction to every host-team member.
  const [hostPresent, setHostPresent] = useState<boolean | null>(null);
  // Step-In is deliberate: a confirm panel opens first (a coordinator
  // clicked it cold during a live session thinking it applied to her).
  const [stepInConfirmOpen, setStepInConfirmOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [teacherLabel, setTeacherLabel] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [view, setView] = useState<SessionView>("gallery");

  // Restore view preference on mount
  useEffect(() => { setView(readView()); }, []);

  function handleViewChange(next: SessionView) {
    setView(next);
    try { localStorage.setItem(VIEW_LS_KEY, next); } catch {}
  }
  const [guestName, setGuestName] = useState("");
  const [joiningAsGuest, setJoiningAsGuest] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const isGuest = !!guestKey;

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await pageRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Member flow: fetch a token. Extracted into a callback so the
  // connection-lost screen can re-run it on "Rejoin". (Audit CONN-1.)
  const loadToken = useCallback(async () => {
    setError(null);
    setState("loading");
    // Stale-presence guard: the previous connection's host-presence signal
    // must not drive the Step-In label on the next one.
    setHostPresent(null);
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programSlug: slug }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        // Prefer the human-readable `message` from the time-gate (e.g.
        // "This session isn't open yet — it begins at 7:00 PM") over the
        // machine-readable `error` slug.
        throw new Error(data.message || data.error || "Failed to connect");
      }
      const data = await res.json();
      setToken(data.token);
      setWsUrl(data.wsUrl);
      setSessionDate(data.sessionDate ?? undefined);
      setIsSessionHost(data.isSessionHost ?? false);
      setHasEndAllAuthority(data.hasEndAllAuthority ?? false);
      setIsCoHost(data.isCoHost ?? false);
      setIsHostTeam(data.isHostTeam ?? false);
      setIsProgramTeacher(data.isProgramTeacher ?? false);
      setAudioProfile(data.audioProfile ?? "listener");
      setAvatarUrl(data.avatarUrl ?? null);
      setTeacherLabel(data.teacherLabel ?? null);
      // Strip the trailing -YYYY-MM-DD date from the per-session room name
      // when deriving the program label.
      const labelSource = (data.roomName as string).replace(/-\d{4}-\d{2}-\d{2}$/, "");
      setProgramName(labelSource.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()));
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setState("error");
    }
  }, [slug, router]);

  // Member flow: fetch token immediately on mount.
  useEffect(() => {
    if (isGuest) return; // guests go through the name form first
    loadToken();
  }, [isGuest, loadToken]);

  // Guest flow: join after entering name. Extracted (no event) so "Rejoin"
  // on the connection-lost screen can re-run it. (Audit CONN-1/CONN-2.)
  const joinAsGuest = useCallback(async () => {
    if (!guestName.trim()) { setState("guest-name"); return; }
    setJoiningAsGuest(true);
    setError(null);
    // Must pass through "loading" so a Rejoin (crash boundary / connection
    // lost) unmounts the old LiveKitRoom before the fresh token mounts —
    // otherwise livekit-client's already-connected early-return silently
    // discards the new token (reviewer finding, session-room batch).
    setState("loading");
    setHostPresent(null);

    try {
      const res = await fetch("/api/livekit/guest-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programSlug: slug,
          guestKey,
          guestName: guestName.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || "Unable to join");
      }

      const data = await res.json();
      setToken(data.token);
      setWsUrl(data.wsUrl);
      setSessionDate(data.sessionDate ?? undefined);
      setProgramName(data.programName);
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setState("error");
    }
    setJoiningAsGuest(false);
  }, [guestName, slug, guestKey]);

  function handleGuestJoin(e: React.FormEvent) {
    e.preventDefault();
    joinAsGuest();
  }

  // Rejoin from a failed connect (CONN-1) or a dropped connection (CONN-2).
  const retry = useCallback(() => {
    if (isGuest) joinAsGuest();
    else loadToken();
  }, [isGuest, joinAsGuest, loadToken]);

  const handleConnectError = useCallback(() => {
    // LiveKit failed to connect (regional blip, flaky/captive-portal WiFi).
    // Show a recoverable screen instead of stranding the user on the
    // Greenroom "Connecting…" forever. (Audit CONN-1.)
    setState("connection-lost");
  }, []);

  // When a Step-In flow is awaiting the prior LiveKitRoom disconnect,
  // this ref holds the resolver. handleLeave checks it before treating
  // the disconnect as a "user has left the session" event — if a
  // Step-In is in flight, the disconnect is part of the reconnect
  // sequence and the page should stay put while the new token mounts.
  const stepInDisconnectResolverRef = useRef<(() => void) | null>(null);

  function handleLeave(kind?: LeaveKind) {
    // If a Step-In flow is awaiting disconnect, satisfy its Promise
    // and stay on the page — the handler will mount a new LiveKitRoom
    // with the new token in a moment. Otherwise this is a real leave.
    const pendingResolver = stepInDisconnectResolverRef.current;
    if (pendingResolver) {
      stepInDisconnectResolverRef.current = null;
      pendingResolver();
      return;
    }
    // Tell the truth about WHY the room closed (Audit CONN-2/CONN-3):
    //   duplicate → they joined from another tab/device (not "ended")
    //   lost      → an unexpected drop; the room may still be live → Rejoin
    //   otherwise → a real end (host ended, server ended, or they left)
    if (kind === "duplicate") { setState("duplicate"); return; }
    if (kind === "lost") { setState("connection-lost"); return; }
    if (kind === "removed") { setState("removed"); return; }
    setState("left");
  }

  const handleHostPresence = useCallback((present: boolean) => {
    setHostPresent(present);
  }, []);

  async function handleStepIn() {
    setStepInConfirmOpen(false);
    setSteppingIn(true);
    try {
      const res = await fetch("/api/livekit/step-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programSlug: slug, sessionDate }),
      });
      if (res.ok) {
        const data = await res.json();

        // Wait for the actual LiveKit Disconnected event before mounting
        // the new token. Setting state to "loading" unmounts LiveKitRoom,
        // which triggers `room.disconnect()` and ultimately the
        // Disconnected event → onLeave → handleLeave → resolve. The 5s
        // safety timeout is a fallback for the rare case where the event
        // never fires (room already gone, network failure mid-disconnect).
        // Replaces the previous 100ms setTimeout — which could race on
        // slow networks and leave the new connection colliding with the
        // tail of the old one under the same user identity.
        const disconnectPromise = new Promise<void>((resolve) => {
          stepInDisconnectResolverRef.current = resolve;
          setTimeout(() => {
            if (stepInDisconnectResolverRef.current === resolve) {
              stepInDisconnectResolverRef.current = null;
              resolve();
            }
          }, 5000);
        });
        setState("loading");
        await disconnectPromise;

        // Disconnect confirmed; safe to mount the new connection.
        setToken(data.token);
        setWsUrl(data.wsUrl);
        setIsSessionHost(true);
        // Stepping in writes the HostAssignment for the caller, so they
        // become the assigned host — full End authority follows.
        setHasEndAllAuthority(true);
        setIsCoHost(true);
        if (typeof data.isProgramTeacher === "boolean") {
          setIsProgramTeacher(data.isProgramTeacher);
        }
        if (data.teacherLabel !== undefined) {
          setTeacherLabel(data.teacherLabel ?? null);
        }
        setState("ready");
      }
    } catch {}
    setSteppingIn(false);
  }

  // Loading state
  if (state === "loading") {
    return (
      <div className="vs-page">
        <div className="vs-loading">Connecting to session…</div>
      </div>
    );
  }

  // Guest name entry
  if (state === "guest-name") {
    return (
      <div className="vs-page">
        <div className="vs-guest-entry">
          <h2 className="vs-guest-entry__title">Join Session</h2>
          <p className="vs-guest-entry__subtitle">
            Enter your name to join the virtual session.
          </p>
          <form onSubmit={handleGuestJoin} className="vs-guest-entry__form">
            <input
              type="text"
              className="vs-guest-entry__input"
              placeholder="Your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              autoFocus
              required
              maxLength={60}
            />
            <button
              type="submit"
              className="vs-guest-entry__btn"
              disabled={joiningAsGuest || !guestName.trim()}
            >
              {joiningAsGuest ? "Joining…" : "Join Session"}
            </button>
          </form>
          {error && <p className="vs-guest-entry__error">{error}</p>}
        </div>
      </div>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <div className="vs-page">
        <div className="vs-message">
          <p className="vs-message__text">{error}</p>
          {isGuest ? (
            <button className="btn" onClick={() => { setError(null); setState("guest-name"); }}>
              Try Again
            </button>
          ) : (
            <button className="btn" onClick={() => router.push("/account/dashboard")}>
              Back to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  // Left the session
  if (state === "left") {
    return (
      <div className="vs-page">
        <div className="vs-message">
          <p className="vs-message__title">Session ended</p>
          <p className="vs-message__text">Thank you for practicing together.</p>
          {isGuest ? (
            <p className="vs-message__text" style={{ marginTop: 8, color: "#888" }}>
              You may close this tab.
            </p>
          ) : (
            <button className="btn" onClick={() => router.push("/account/dashboard")}>
              Return to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  // Connection lost — a failed connect (CONN-1) or an unexpected drop past
  // LiveKit's retry ladder (CONN-2). The room may still be live; offer Rejoin.
  if (state === "connection-lost") {
    return (
      <div className="vs-page">
        <div className="vs-message">
          <p className="vs-message__title">Connection lost</p>
          <p className="vs-message__text">
            We couldn’t reach the session just now. It may still be going — this is
            usually temporary. Try rejoining.
          </p>
          <div className="vs-message__actions">
            <button className="btn" onClick={retry}>Rejoin</button>
            {!isGuest && (
              <button className="vs-message__link" onClick={() => router.push("/account/dashboard")}>
                Back to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Removed by the host (the Remove control). Honest and calm — no false
  // "thank you for practicing together," and no advertised rejoin path
  // (a non-banned removal CAN rejoin, but the moment calls for pause, not
  // a button that re-escalates).
  if (state === "removed") {
    return (
      <div className="vs-page">
        <div className="vs-message">
          <p className="vs-message__title">You&apos;ve been removed from this session</p>
          <p className="vs-message__text">
            The session&apos;s host removed you. If you think this was a mistake,
            please reach out to the host or the RIM team.
          </p>
          {!isGuest && (
            <button className="btn" onClick={() => router.push("/account/dashboard")}>
              Return to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  // Disconnected because the same member joined from another tab or device
  // (CONN-3) — not an end, so don't say "Session ended."
  if (state === "duplicate") {
    return (
      <div className="vs-page">
        <div className="vs-message">
          <p className="vs-message__title">You joined from another place</p>
          <p className="vs-message__text">
            This session is now open in another tab or on another device, so this
            window was disconnected. You can rejoin here, or just use the other one.
          </p>
          <div className="vs-message__actions">
            <button className="btn" onClick={retry}>Rejoin here</button>
            {!isGuest && (
              <button className="vs-message__link" onClick={() => router.push("/account/dashboard")}>
                Back to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Ready / Connected
  return (
    <div className="vs-page" ref={pageRef}>
      <div className="vs-header">
        {/* Left: Step-in (host-team non-hosts only). The label speaks to the
            actual situation — the affordance exists for the no-host moment,
            and a confirm step keeps a cold tap survivable (a designated
            coordinator once clicked it mid-session thinking it was for her). */}
        <div className="vs-header__left">
          {isHostTeam && !isSessionHost && (
            <div className="vs-stepin-anchor">
              <button
                className="vs-header__stepin"
                onClick={() => setStepInConfirmOpen((v) => !v)}
                disabled={steppingIn}
                aria-haspopup="dialog"
                aria-expanded={stepInConfirmOpen}
              >
                {steppingIn
                  ? "Connecting…"
                  : hostPresent === false
                  ? "No host yet — Step in"
                  : hostPresent === true
                  ? "Take over as host"
                  : "Step in as Host"}
              </button>
              {stepInConfirmOpen && !steppingIn && (
                <div className="vs-stepin-confirm" role="dialog" aria-label="Step in as host">
                  <p className="vs-stepin-confirm__title">
                    {hostPresent === true ? "Take over as host?" : "Step in as host?"}
                  </p>
                  <p className="vs-stepin-confirm__text">
                    {hostPresent === true
                      ? "Someone is already hosting this session. Only continue if you've agreed to take over from them."
                      : "You'll become this session's host, with host controls. This is for when no designated host is here."}
                  </p>
                  <div className="vs-stepin-confirm__actions">
                    <button className="vs-stepin-confirm__yes" onClick={handleStepIn}>
                      Yes, step in
                    </button>
                    <button
                      className="vs-stepin-confirm__no"
                      onClick={() => setStepInConfirmOpen(false)}
                    >
                      Not now
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Center: program name */}
        <span className="vs-header__name">{programName}</span>
        {/* Right: view toggle, fullscreen, help */}
        <div className="vs-header__right">
          <ViewToggle view={view} onChange={handleViewChange} />
          <button
            className="vs-header__icon"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? "⤡" : "⛶"}
          </button>
        </div>
      </div>
      <div className="vs-room">
        {token && wsUrl && (
          <RoomErrorBoundary onRecover={retry}>
            <VideoRoom
              token={token}
              wsUrl={wsUrl}
              isSessionHost={isSessionHost}
              hasEndAllAuthority={hasEndAllAuthority}
              isCoHost={isCoHost}
              isProgramTeacher={isProgramTeacher}
              teacherLabel={teacherLabel}
              audioProfile={audioProfile}
              programSlug={slug}
              sessionDate={sessionDate}
              guestKey={guestKey ?? undefined}
              avatarUrl={avatarUrl}
              view={view}
              onLeave={handleLeave}
              onConnectError={handleConnectError}
              onHostPresence={handleHostPresence}
            />
          </RoomErrorBoundary>
        )}
      </div>
    </div>
  );
}
