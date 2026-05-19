"use client";

/**
 * VideoRoom — LiveKit video conferencing room.
 *
 * Wraps LiveKitRoom and renders RIMConference, our custom layout.
 *
 * Audio profile drives the capture defaults:
 *   teacher  — preserves bells, singing bowls, music. Noise suppression OFF,
 *              auto-gain OFF, echo cancellation ON, higher bitrate.
 *   speaker  — host who isn't teaching. Clean speech profile, all three on.
 *   listener — everyone else. Clean speech profile.
 *
 * DTX is OFF for all profiles. The bandwidth savings during silence are
 * negligible and DTX can cause perceptible artifacts at the start/end of
 * speech ("choppy" complaints).
 */

import { useEffect } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import { RoomOptions, VideoPresets } from "livekit-client";
import RIMConference from "./session/RIMConference";

export type AudioProfile = "teacher" | "speaker" | "listener";

function buildRoomOptions(profile: AudioProfile): RoomOptions {
  const isTeacher = profile === "teacher";
  return {
    videoCaptureDefaults: {
      resolution: VideoPresets.h720.resolution,
    },
    audioCaptureDefaults: isTeacher
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
      dtx: false,
      ...(isTeacher ? { audioPreset: { maxBitrate: 128_000 } } : {}),
    },
    adaptiveStream: true,
    dynacast: true,
  };
}

interface Props {
  token: string;
  wsUrl: string;
  isHost?: boolean;
  audioProfile?: AudioProfile;
  programSlug: string;
  guestKey?: string;
  avatarUrl?: string | null;
  onLeave?: () => void;
}

export default function VideoRoom({ token, wsUrl, isHost = false, audioProfile = "listener", programSlug, guestKey, avatarUrl, onLeave }: Props) {
  const roomOptions = buildRoomOptions(audioProfile);

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
          guestKey={guestKey}
          initialAvatarUrl={avatarUrl ?? null}
        />
      </LiveKitRoom>
    </div>
  );
}
