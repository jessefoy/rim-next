"use client";

/**
 * VideoRoomEmbed — Embeds a LiveKit video room inline on the dashboard.
 * Click "Join" → fetches a token → mounts the VideoRoom component.
 * Click "Leave" → disconnects and collapses back to the button.
 */

import { useState } from "react";
import dynamic from "next/dynamic";

const VideoRoom = dynamic(() => import("@/components/VideoRoom"), { ssr: false });

interface Props {
  programSlug: string;
  programId: string;
  sessionDate?: string;
  className?: string;
}

export default function VideoRoomEmbed({ programSlug, programId, sessionDate, className }: Props) {
  const [state, setState] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setState("connecting");
    setError(null);
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programSlug, sessionDate }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to connect");
      }
      const data = await res.json();
      setToken(data.token);
      setWsUrl(data.wsUrl);
      setState("connected");

      // Fire attendance tracking (fire-and-forget)
      fetch("/api/attendance/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId, programSlug }),
      }).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setState("error");
    }
  }

  function leave() {
    setToken(null);
    setWsUrl(null);
    setState("idle");
  }

  if (state === "connected" && token && wsUrl) {
    return (
      <div className="vre-room">
        <VideoRoom token={token} wsUrl={wsUrl} programSlug={programSlug} onLeave={leave} />
      </div>
    );
  }

  return (
    <button
      className={className || "join-btn"}
      onClick={join}
      disabled={state === "connecting"}
    >
      {state === "connecting" ? "Connecting…" : state === "error" ? "Retry" : "Join"}
    </button>
  );
}
