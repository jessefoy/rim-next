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
  // Permission tiers — see lib/livekitAuth.ts. isSessionHost ⇒ isCoHost.
  const [isSessionHost, setIsSessionHost] = useState(false);
  const [isCoHost, setIsCoHost] = useState(false);
  const [isHostTeam, setIsHostTeam] = useState(false);
  const [isProgramTeacher, setIsProgramTeacher] = useState(false);
  const [audioProfile, setAudioProfile] = useState<"teacher" | "speaker" | "listener">("listener");
  const [steppingIn, setSteppingIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
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
        setIsSessionHost(data.isSessionHost ?? false);
        setIsCoHost(data.isCoHost ?? false);
        setIsHostTeam(data.isHostTeam ?? false);
        setIsProgramTeacher(data.isProgramTeacher ?? false);
        setAudioProfile(data.audioProfile ?? "listener");
        setAvatarUrl(data.avatarUrl ?? null);
        setProgramName(data.roomName.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()));
        setState("ready");
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
        setIsSessionHost(true);
        setIsCoHost(true);
        if (typeof data.isProgramTeacher === "boolean") {
          setIsProgramTeacher(data.isProgramTeacher);
        }
        // Force reconnect by cycling state
        setState("loading");
        setTimeout(() => setState("ready"), 100);
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

  // Ready / Connected
  return (
    <div className="vs-page" ref={pageRef}>
      <div className="vs-header">
        {/* Left: Step-in (host-team non-hosts only) */}
        <div className="vs-header__left">
          {isHostTeam && !isSessionHost && (
            <button className="vs-header__stepin" onClick={handleStepIn} disabled={steppingIn}>
              {steppingIn ? "Connecting…" : "Step in as Host"}
            </button>
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
          {isHostTeam && (
            <a
              href="/admin/manual/host-session-room?from=host-team"
              target="_blank"
              rel="noopener noreferrer"
              className="vs-header__icon"
              title="How the session room works"
              aria-label="How the session room works (opens in a new tab)"
            >
              ?
            </a>
          )}
        </div>
      </div>
      <div className="vs-room">
        {token && wsUrl && (
          <VideoRoom
            token={token}
            wsUrl={wsUrl}
            isSessionHost={isSessionHost}
            isCoHost={isCoHost}
            isProgramTeacher={isProgramTeacher}
            audioProfile={audioProfile}
            programSlug={slug}
            guestKey={guestKey ?? undefined}
            avatarUrl={avatarUrl}
            view={view}
            onLeave={handleLeave}
          />
        )}
      </div>
    </div>
  );
}
