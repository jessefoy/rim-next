"use client";

/**
 * VideoRoom — LiveKit video conferencing room.
 *
 * Wraps LiveKitRoom and renders a small phase machine inside it:
 *   greenroom  — pre-prompt screen that primes the user before the browser
 *                permission prompt fires (and skips itself silently when
 *                permissions are already granted from a prior session).
 *   recovery   — denial-state screen with Safari Mac instructions and a
 *                Refresh page button. Reached when permission was already
 *                denied on mount, or the Continue click threw NotAllowedError.
 *   conference — RIMConference, the actual room layout.
 *
 * LiveKitRoom is mounted with audio={false} video={false} so connection
 * happens in the background while Greenroom is showing, and so the user joins
 * muted + camera off (Zoom-style) — no track is published until they choose to.
 * Greenroom acquires the camera/mic permission via getUserMedia synchronously
 * from the Continue click handler (iOS Safari needs the user-gesture chain to
 * survive), then stops the tracks without publishing — priming the grant so a
 * later in-session toggle turns on instantly.
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
 *
 * Video publish bitrate ceiling is per-profile, sized to Zoom-equivalent
 * quality without overshooting what residential WiFi reliably sustains:
 *   teacher  — 2.0 Mbps @ 720p/30fps (Zoom Group HD territory)
 *   speaker  — 1.5 Mbps @ 720p/30fps (Zoom HD)
 *   listener — 1.5 Mbps @ 720p/30fps (session 124 — bumped from 1.0
 *              into the bottom of the recommended 1.5–2.5 band so
 *              a listener who gets pinned by anyone still looks decent;
 *              also keeps us comfortably under the 2.5 ceiling that
 *              caused the original freezes)
 * Three explicit simulcast layers [h180, h360, h720] give the SFU a full
 * adaptation ladder; adaptiveStream + dynacast handle the receiver-side
 * downscaling and uplink savings respectively. The previous flat 2.5 Mbps
 * ceiling for everyone was above what most consumer connections could
 * sustain and produced the layer-switch freezes ("choppy/freezing"
 * complaints).
 *
 * Noise cancellation is RNNoise, wired in RIMConference (via the local
 * useNoiseFilter hook + RnnoiseAudioProcessor) and enabled by default for
 * every participant — the in-browser replacement for Cloud-only Krisp after
 * RIM self-hosted LiveKit (session 150). Co-hosts can toggle it OFF via the
 * "Bell mode" button in the control bar to preserve the full tone of bells,
 * gongs, and singing bowls. The state resets to ON at every session join —
 * Bell mode is a deliberate per-bell action, not a preference.
 *
 * DTX is OFF for all profiles. The bandwidth savings during silence are
 * negligible and DTX can cause perceptible artifacts at the start/end of
 * speech ("choppy" complaints).
 */

import { useCallback, useEffect, useState } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import { RoomOptions, VideoPresets, DisconnectReason } from "livekit-client";
import RIMConference from "./session/RIMConference";
import Greenroom from "./session/Greenroom";
import Recovery from "./session/Recovery";

export type AudioProfile = "teacher" | "speaker" | "listener";

type Phase = "greenroom" | "recovery" | "conference";

/** Why the room closed, classified for the page so it can show the right
 *  screen without importing livekit-client itself. (Audit CONN-2/CONN-3.) */
export type LeaveKind = "ended" | "lost" | "duplicate" | "removed";

function classifyDisconnect(reason?: DisconnectReason): LeaveKind {
  // Same member joined from another tab/device — not an end.
  if (reason === DisconnectReason.DUPLICATE_IDENTITY) return "duplicate";
  // A host removed this participant (the Remove control). Telling them
  // "Session ended — thank you for practicing together" would be false;
  // the page shows an honest, calm removal screen instead.
  if (reason === DisconnectReason.PARTICIPANT_REMOVED) return "removed";
  switch (reason) {
    // Deliberate / authoritative ends → the calm "Session ended" screen.
    case DisconnectReason.CLIENT_INITIATED:
    case DisconnectReason.ROOM_DELETED:
    case DisconnectReason.SERVER_SHUTDOWN:
      return "ended";
    // Everything else (network drop past LiveKit's retry ladder, signal
    // close, join failure, unknown) — the room may still be live → offer Rejoin.
    default:
      return "lost";
  }
}

function buildRoomOptions(profile: AudioProfile): RoomOptions {
  const isTeacher = profile === "teacher";
  const audioMaxBitrate =
    profile === "teacher" ? 128_000 : profile === "speaker" ? 96_000 : 64_000;
  // Listener now matches speaker at 1.5 Mbps (was 1.0). See the comment
  // block above for the rationale — kept the ternary shape for clarity
  // even though speaker and listener happen to share a value.
  const videoMaxBitrate =
    profile === "teacher" ? 2_000_000 : profile === "speaker" ? 1_500_000 : 1_500_000;
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
      videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360, VideoPresets.h720],
      videoCodec: "h264",
      videoEncoding: {
        maxBitrate: videoMaxBitrate,
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
  /** Session Host identity: has a HostAssignment for this session. Drives the "Host" pill. */
  isSessionHost?: boolean;
  /** End-for-All capability: assigned host OR ADMIN OR GUIDING_TEACHER OR
   *  (Teacher when no host assigned). Separate from identity so the pill
   *  doesn't lie when a safety-override role is doing the ending. */
  hasEndAllAuthority?: boolean;
  /** Co-host: active host-team member, teacher, manager, or session host. Gates mute/share/manage. */
  isCoHost?: boolean;
  /** ProgramTeacher row exists for this program — drives Teacher pill + audio profile. */
  isProgramTeacher?: boolean;
  /** Per-program override for the Teacher pill text. Threaded into
   *  RIMConference's metadata seeder. */
  teacherLabel?: string | null;
  audioProfile?: AudioProfile;
  programSlug: string;
  /** YYYY-MM-DD in CT — scopes chat to this session. */
  sessionDate?: string;
  guestKey?: string;
  avatarUrl?: string | null;
  view?: "speaker" | "gallery";
  onLeave?: (kind?: LeaveKind) => void;
  /** Fired when LiveKit fails to connect (the connect promise rejects).
   *  Without this the user is stranded on the Greenroom "Connecting…" with
   *  no retry — LiveKitRoom swallows the rejection. (Audit CONN-1.) */
  onConnectError?: () => void;
  /** Whether a designated host (Host metadata flag) is in the room — drives
   *  the page header's context-aware Step-In label. UI cue only. */
  onHostPresence?: (present: boolean) => void;
}

export default function VideoRoom({ token, wsUrl, isSessionHost = false, hasEndAllAuthority = false, isCoHost = false, isProgramTeacher = false, teacherLabel = null, audioProfile = "listener", programSlug, sessionDate, guestKey, avatarUrl, view = "gallery", onLeave, onConnectError, onHostPresence }: Props) {
  const roomOptions = buildRoomOptions(audioProfile);
  const [phase, setPhase] = useState<Phase>("greenroom");

  // Stable callbacks so Greenroom's permission-check effect doesn't re-fire
  // on every VideoRoom re-render (LiveKit state updates flow through context
  // and trigger frequent parent re-renders).
  const handleJoined = useCallback(() => setPhase("conference"), []);
  const handleDenied = useCallback(() => setPhase("recovery"), []);

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
        audio={false}
        video={false}
        options={roomOptions}
        onDisconnected={(reason) => onLeave?.(classifyDisconnect(reason))}
        onError={() => onConnectError?.()}
        data-lk-theme="default"
        style={{ height: "100%" }}
      >
        {phase === "greenroom" && (
          <Greenroom onJoined={handleJoined} onDenied={handleDenied} />
        )}
        {phase === "recovery" && <Recovery />}
        {phase === "conference" && (
          <RIMConference
            isSessionHost={isSessionHost}
            hasEndAllAuthority={hasEndAllAuthority}
            isCoHost={isCoHost}
            isProgramTeacher={isProgramTeacher}
            teacherLabel={teacherLabel}
            programSlug={programSlug}
            sessionDate={sessionDate}
            guestKey={guestKey}
            view={view}
            initialAvatarUrl={avatarUrl ?? null}
            onHostPresence={onHostPresence}
          />
        )}
      </LiveKitRoom>
    </div>
  );
}
