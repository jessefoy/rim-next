"use client";

/**
 * /session/[slug] — Dedicated full-page video session room.
 * Members arrive here from the dashboard "Join" button.
 * Auth-gated: redirects to /login if not authenticated.
 *
 * The page fetches a LiveKit token, connects to the room, and
 * shows the video conference full-page with a clean header.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const VideoRoom = dynamic(() => import("@/components/VideoRoom"), { ssr: false });

type State = "loading" | "ready" | "connected" | "error" | "left";

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [state, setState] = useState<State>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [programName, setProgramName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isHostTeam, setIsHostTeam] = useState(false);
  const [steppingIn, setSteppingIn] = useState(false);
  const [ending, setEnding] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    async function init() {
      try {
        // Fetch token
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
  }, [slug, router]);

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

  // Error state
  if (state === "error") {
    return (
      <div className="vs-page">
        <div className="vs-message">
          <p className="vs-message__text">{error}</p>
          <button className="btn" onClick={() => router.push("/account/dashboard")}>
            Back to Dashboard
          </button>
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
          <button className="btn" onClick={() => router.push("/account/dashboard")}>
            Return to Dashboard
          </button>
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
          <VideoRoom token={token} wsUrl={wsUrl} isHost={isHost} onLeave={handleLeave} />
        )}
      </div>
    </div>
  );
}
