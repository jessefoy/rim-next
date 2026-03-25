"use client";

/**
 * VideoRoom — LiveKit video conferencing room embedded in the page.
 * Uses @livekit/components-react for the pre-built VideoConference UI.
 *
 * Props:
 *   token    — JWT token from /api/livekit/token
 *   wsUrl    — LiveKit Cloud WebSocket URL
 *   onLeave  — called when user leaves the room
 */

import "@livekit/components-styles";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";

interface Props {
  token: string;
  wsUrl: string;
  onLeave?: () => void;
}

export default function VideoRoom({ token, wsUrl, onLeave }: Props) {
  return (
    <div className="vr-container">
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
