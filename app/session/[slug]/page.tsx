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

const VideoRoom = dynamic(() => import("@/components/VideoRoom"), { ssr: false });

type State = "loading" | "guest-name" | "ready" | "connected" | "error" | "left";

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
  const [error, setError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isHostTeam, setIsHostTeam] = useState(false);
  const [needsHiFiAudio, setNeedsHiFiAudio] = useState(false);
  const [steppingIn, setSteppingIn] = useState(false);
  const [ending, setEnding] = useState(false);
  const [mutingAll, setMutingAll] = useState(false);
  const [muteCount, setMuteCount] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  // Member flow: fetch token immediately
  useEffect(() => {
    if (isGuest) return; // guests go through the name form first

    async function init() {
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
          throw new Error(data.error || "Failed to connect");
        }
        const data = await res.json();
        setToken(data.token);
        setWsUrl(data.wsUrl);
        setIsHost(data.isHost ?? false);
        setIsHostTeam(data.isHostTeam ?? false);
        setNeedsHiFiAudio(data.needsHiFiAudio ?? false);
        setProgramName(data.roomName.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()));
        setState("ready");

        // Fire attendance tracking
        fetch("/api/attendance/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ programId: slug, programSlug: slug }),
        }).catch(() => {});
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setState("error");
      }
    }
    init();
  }, [slug, router, isGuest]);

  // Guest flow: join after entering name
  async function handleGuestJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) return;
    setJoiningAsGuest(true);
    setError(null);

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
        throw new Error(data.error || "Unable to join");
      }

      const data = await res.json();
      setToken(data.token);
      setWsUrl(data.wsUrl);
      setProgramName(data.programName);
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setState("error");
    }
    setJoiningAsGuest(false);
  }

  function handleLeave() {
    setState("left");
  }

  async function handleStepIn() {
    setSteppingIn(true);
    try {
      const res = await fetch("/api/livekit/step-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programSlug: slug }),
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setWsUrl(data.wsUrl);
        setIsHost(true);
        // Force reconnect by cycling state
        setState("loading");
        setTimeout(() => setState("ready"), 100);
      }
    } catch {}
    setSteppingIn(false);
  }

  async function handleMuteAll() {
    setMutingAll(true);
    setMuteCount(null);
    try {
      const res = await fetch("/api/livekit/mute-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programSlug: slug }),
      });
      if (res.ok) {
        const data = await res.json();
        setMuteCount(data.muted);
        setTimeout(() => setMuteCount(null), 3000);
      }
    } catch {}
    setMutingAll(false);
  }

  async function handleEndForAll() {
    if (!confirm("End this session for all participants?")) return;
    setEnding(true);
    try {
      await fetch("/api/livekit/end-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programSlug: slug }),
      });
    } catch {}
    setState("left");
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

  // Ready / Connected
  return (
    <div className="vs-page" ref={pageRef}>
      <div className="vs-header">
        <button className="vs-header__back" onClick={handleLeave}>
          ← Leave
        </button>
        <span className="vs-header__name">{programName}</span>
        {isHostTeam && !isHost && (
          <button className="vs-header__stepin" onClick={handleStepIn} disabled={steppingIn}>
            {steppingIn ? "Connecting…" : "Step in as Host"}
          </button>
        )}
        {isHost && (
          <button className="vs-header__mute" onClick={handleMuteAll} disabled={mutingAll}>
            {mutingAll ? "Muting…" : muteCount !== null ? `Muted ${muteCount}` : "Mute All"}
          </button>
        )}
        {isHost && (
          <button className="vs-header__end" onClick={handleEndForAll} disabled={ending}>
            {ending ? "Ending…" : "End for All"}
          </button>
        )}
        <button className="vs-header__fullscreen" onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        </button>
      </div>
      <div className="vs-room">
        {token && wsUrl && (
          <VideoRoom token={token} wsUrl={wsUrl} hiFiAudio={needsHiFiAudio} onLeave={handleLeave} />
        )}
      </div>
    </div>
  );
}
