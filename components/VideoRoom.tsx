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

/**
 * Room options for high-quality meditation sessions:
 *
 * Video: 720p with simulcast (3 layers for adaptive quality)
 * Audio (host): High-fidelity — noise suppression OFF, echo cancellation OFF,
 *   auto-gain OFF. This lets meditation bells, singing bowls, and music pass
 *   through clean and full instead of being clipped as "background noise."
 * Audio (participant): DTX enabled — during silence, almost no audio bandwidth
 *   is used. Perfect for 35 people sitting in silent meditation.
 *
 * The isHost prop controls whether high-fidelity audio is enabled.
 * Participants keep default speech-optimized audio (noise suppression ON)
 * so their background sounds don't leak into the session.
 */
function buildRoomOptions(isHost: boolean): RoomOptions {
  return {
    videoCaptureDefaults: {
      resolution: VideoPresets.h720.resolution,
    },
    audioCaptureDefaults: isHost
      ? {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        }
      : {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
    publishDefaults: {
      videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
      videoCodec: "vp8",
      dtx: true,
      ...(isHost ? { audioPreset: { maxBitrate: 128_000 } } : {}),
    },
    adaptiveStream: true,
    dynacast: true,
  };
}

interface Props {
  token: string;
  wsUrl: string;
  hiFiAudio?: boolean;
  onLeave?: () => void;
}

export default function VideoRoom({ token, wsUrl, hiFiAudio = false, onLeave }: Props) {
  const roomOptions = buildRoomOptions(hiFiAudio);
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
