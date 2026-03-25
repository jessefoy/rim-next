"use client";

/**
 * LiveKit Test Page — ADMIN only.
 * Lets you enter a room name, fetch a token, and connect.
 * Open in two tabs to test video conferencing.
 */

import { useState } from "react";
import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues with LiveKit's browser-only APIs
const VideoRoom = dynamic(() => import("@/components/VideoRoom"), { ssr: false });

export default function LiveKitTestPage() {
  const [roomName, setRoomName] = useState("test-room");
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function connect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testRoom: roomName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get token");
      }
      const data = await res.json();
      setToken(data.token);
      setWsUrl(data.wsUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function disconnect() {
    setToken(null);
    setWsUrl(null);
  }

  if (token && wsUrl) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14, color: "#6b6059" }}>
            Connected to <strong>{roomName}</strong>
          </span>
          <button
            onClick={disconnect}
            style={{
              padding: "6px 14px", fontSize: 13, background: "#B84040", color: "#fff",
              border: "none", borderRadius: 6, cursor: "pointer",
            }}
          >
            Leave Room
          </button>
        </div>
        <div style={{ height: "calc(100vh - 160px)", borderRadius: 12, overflow: "hidden", border: "1px solid #e0ddd7" }}>
          <VideoRoom token={token} wsUrl={wsUrl} onLeave={disconnect} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 480 }}>
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400, marginBottom: 8 }}>
        LiveKit Test
      </h2>
      <p style={{ fontSize: 14, color: "#6b6059", marginBottom: 20 }}>
        Open this page in two browser tabs to test video conferencing.
      </p>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#7a7068", marginBottom: 6 }}>
          Room Name
        </label>
        <input
          type="text"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          className="fi"
          placeholder="test-room"
        />
      </div>
      {error && (
        <p style={{ fontSize: 14, color: "#B84040", marginBottom: 12 }}>{error}</p>
      )}
      <button
        onClick={connect}
        disabled={loading || !roomName.trim()}
        className="btn"
      >
        {loading ? "Connecting…" : "Join Room"}
      </button>
    </div>
  );
}
