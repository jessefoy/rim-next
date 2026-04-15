"use client";

/**
 * VideoRoom — LiveKit video conferencing room.
 *
 * Wraps LiveKitRoom and renders RIMConference, our custom layout that provides:
 * - Custom participant tiles with avatar overlays and signal badges
 * - Nonverbal toolbar (✋ ❤️ 🙏 ✓ ✗)
 * - Host participants panel with per-participant mute and raised hand queue
 * - Video settings panel: background blur, brightness/contrast, presence photo upload
 *
 * Video quality: 720p default, adaptive bitrate up to 1.5Mbps.
 * LiveKit's simulcast sends multiple quality layers — participants
 * with slower connections automatically receive a lower layer.
 *
 * Audio (host): Echo cancellation ON, noise suppression OFF, auto-gain OFF.
 *   This preserves meditation bells, singing bowls, and music while preventing
 *   speaker feedback.
 * Audio (participant): Full speech processing ON.
 *   DTX enabled — during silence, almost no audio bandwidth is used.
 */

import { useEffect } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import { RoomOptions, VideoPresets } from "livekit-client";
import RIMConference from "./session/RIMConference";

function buildRoomOptions(isHost: boolean): RoomOptions {
  return {
    videoCaptureDefaults: {
      resolution: VideoPresets.h720.resolution,
    },
    audioCaptureDefaults: isHost
      ? {
          autoGainControl: false,
          echoCancellation: true,
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
  isHost?: boolean;
  programSlug: string;
  avatarUrl?: string | null;
  onLeave?: () => void;
}

export default function VideoRoom({ token, wsUrl, isHost = false, programSlug, avatarUrl, onLeave }: Props) {
  const roomOptions = buildRoomOptions(isHost);

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
        <RIMConference
          isHost={isHost}
          programSlug={programSlug}
          initialAvatarUrl={avatarUrl ?? null}
        />
      </LiveKitRoom>
    </div>
  );
}
