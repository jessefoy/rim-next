"use client";

/**
 * VideoRoom — LiveKit video conferencing room embedded in the page.
 * Uses @livekit/components-react for the pre-built VideoConference UI.
 * Includes a fullscreen toggle.
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";

interface Props {
  token: string;
  wsUrl: string;
  onLeave?: () => void;
}

export default function VideoRoom({ token, wsUrl, onLeave }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Load LiveKit styles only when video room mounts — prevents global CSS leak
  useEffect(() => {
    const id = "livekit-styles";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "/css/livekit-prefabs.css";
    document.head.appendChild(link);
    return () => { link.remove(); };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fullscreen not supported or denied — fail silently
    }
  }, []);

  // Sync state if user exits fullscreen via Escape key
  if (typeof document !== "undefined") {
    document.onfullscreenchange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
  }

  return (
    <div className={`vr-container${isFullscreen ? " vr-container--fs" : ""}`} ref={containerRef}>
      <button
        className="vr-fullscreen-btn"
        onClick={toggleFullscreen}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? "⊠" : "⛶"}
      </button>
      <LiveKitRoom
        token={token}
        serverUrl={wsUrl}
        connect={true}
        onDisconnected={() => onLeave?.()}
        data-lk-theme="default"
        style={{ height: "100%" }}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
