"use client";

/**
 * VideoRoom — LiveKit video conferencing room.
 *
 * Wraps LiveKitRoom and renders RIMConference, our custom layout.
 *
 * Audio profile drives capture + publish settings:
 *   teacher  — preserves bells, singing bowls, music. Noise suppression OFF,
 *              auto-gain OFF, echo cancellation ON. 128 kbps audio.
 *   speaker  — host who isn't teaching. Clean speech profile, all three on.
 *              96 kbps audio.
 *   listener — everyone else. Clean speech profile. 64 kbps audio.
 *
 * Audio default in LiveKit is ~20 kbps (speech preset); bumping to 64–128 kbps
 * yields a clearly perceptible quality improvement at trivial bandwidth cost.
 *
 * Video codec is H.264 — matches what Zoom uses, with universal hardware
 * encode/decode across laptops/phones/iPads, no CPU spike on older devices.
 * VP8 (our previous default) looked visibly softer at the same bitrate.
 * 720p @ 30fps, capped at 2.5 Mbps with simulcast layers down to 180p for
 * lossy networks.
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
  const audioMaxBitrate =
    profile === "teacher" ? 128_000 : profile === "speaker" ? 96_000 : 64_000;
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
      videoCodec: "h264",
      videoEncoding: {
        maxBitrate: 2_500_000,
        maxFramerate: 30,
      },
      audioPreset: { maxBitrate: audioMaxBitrate },
      dtx: false,
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
  view?: "speaker" | "gallery";
  onLeave?: () => void;
}

export default function VideoRoom({ token, wsUrl, isHost = false, audioProfile = "listener", programSlug, guestKey, avatarUrl, view = "gallery", onLeave }: Props) {
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
          view={view}
          initialAvatarUrl={avatarUrl ?? null}
        />
      </LiveKitRoom>
    </div>
  );
}
