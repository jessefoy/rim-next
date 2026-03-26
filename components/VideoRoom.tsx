"use client";

/**
 * VideoRoom — LiveKit video conferencing room.
 * Uses @livekit/components-react VideoConference (pre-built UI with
 * controls, fullscreen, chat, screen share — all handled by LiveKit).
 *
 * Video quality: 720p default, adaptive bitrate up to 1.5Mbps.
 * LiveKit's simulcast sends multiple quality layers — participants
 * with slower connections automatically receive a lower layer.
 */

import { useEffect } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { RoomOptions, VideoPresets } from "livekit-client";

const roomOptions: RoomOptions = {
  videoCaptureDefaults: {
    resolution: VideoPresets.h720.resolution,
  },
  publishDefaults: {
    videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
    videoCodec: "vp8",
  },
  adaptiveStream: true,
  dynacast: true,
};

interface Props {
  token: string;
  wsUrl: string;
  onLeave?: () => void;
}

export default function VideoRoom({ token, wsUrl, onLeave }: Props) {
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

  return (
    <div className="vr-container">
      <LiveKitRoom
        token={token}
        serverUrl={wsUrl}
        connect={true}
        options={roomOptions}
        onDisconnected={() => onLeave?.()}
        data-lk-theme="default"
        style={{ height: "100%" }}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
