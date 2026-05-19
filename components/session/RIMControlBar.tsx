"use client";

/**
 * RIMControlBar — the in-room control bar (mic, camera, screen share, leave).
 *
 * Replaces LiveKit's stock <ControlBar />, which renders each toggle as
 * "primary button + adjacent device-selector chevron" — Sangha members
 * couldn't tell which half was the actual mute.
 *
 * This bar is one big labeled button per action. Device selection (which
 * mic, which camera) lives in the ⚙ Settings panel — opened from the
 * top toolbar — so the control bar has nothing to mis-tap.
 */

import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useEffect, useState } from "react";

interface Props {
  onLeave?: () => void;
}

function useLocalTrackState(): {
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
} {
  const room = useRoomContext();
  const [state, setState] = useState({
    micEnabled: room?.localParticipant?.isMicrophoneEnabled ?? false,
    cameraEnabled: room?.localParticipant?.isCameraEnabled ?? false,
    screenShareEnabled: room?.localParticipant?.isScreenShareEnabled ?? false,
  });

  useEffect(() => {
    if (!room) return;
    const update = () => {
      const lp = room.localParticipant;
      setState({
        micEnabled: lp.isMicrophoneEnabled,
        cameraEnabled: lp.isCameraEnabled,
        screenShareEnabled: lp.isScreenShareEnabled,
      });
    };
    update();
    room.on(RoomEvent.TrackMuted, update);
    room.on(RoomEvent.TrackUnmuted, update);
    room.on(RoomEvent.LocalTrackPublished, update);
    room.on(RoomEvent.LocalTrackUnpublished, update);
    return () => {
      room.off(RoomEvent.TrackMuted, update);
      room.off(RoomEvent.TrackUnmuted, update);
      room.off(RoomEvent.LocalTrackPublished, update);
      room.off(RoomEvent.LocalTrackUnpublished, update);
    };
  }, [room]);

  return state;
}

export default function RIMControlBar({ onLeave }: Props) {
  const room = useRoomContext();
  const { micEnabled, cameraEnabled, screenShareEnabled } = useLocalTrackState();
  const [pendingMic, setPendingMic] = useState(false);
  const [pendingCam, setPendingCam] = useState(false);
  const [pendingShare, setPendingShare] = useState(false);

  async function toggleMic() {
    if (!room) return;
    setPendingMic(true);
    try {
      await room.localParticipant.setMicrophoneEnabled(!micEnabled);
    } catch {}
    setPendingMic(false);
  }

  async function toggleCamera() {
    if (!room) return;
    setPendingCam(true);
    try {
      await room.localParticipant.setCameraEnabled(!cameraEnabled);
    } catch {}
    setPendingCam(false);
  }

  async function toggleScreenShare() {
    if (!room) return;
    setPendingShare(true);
    try {
      await room.localParticipant.setScreenShareEnabled(!screenShareEnabled);
    } catch {}
    setPendingShare(false);
  }

  function leave() {
    room?.disconnect();
    onLeave?.();
  }

  return (
    <div className="rim-cb" role="toolbar" aria-label="Session controls">
      <button
        type="button"
        className={`rim-cb-btn rim-cb-btn--mic${micEnabled ? "" : " rim-cb-btn--off"}`}
        onClick={toggleMic}
        disabled={pendingMic}
        aria-pressed={micEnabled}
        aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
      >
        <span className="rim-cb-btn__icon" aria-hidden="true">
          {micEnabled ? "🎤" : "🔇"}
        </span>
        <span className="rim-cb-btn__label">
          {micEnabled ? "Mute" : "Unmute"}
        </span>
      </button>

      <button
        type="button"
        className={`rim-cb-btn rim-cb-btn--cam${cameraEnabled ? "" : " rim-cb-btn--off"}`}
        onClick={toggleCamera}
        disabled={pendingCam}
        aria-pressed={cameraEnabled}
        aria-label={cameraEnabled ? "Stop video" : "Start video"}
      >
        <span className="rim-cb-btn__icon" aria-hidden="true">
          {cameraEnabled ? "📹" : "📷"}
        </span>
        <span className="rim-cb-btn__label">
          {cameraEnabled ? "Stop video" : "Start video"}
        </span>
      </button>

      <button
        type="button"
        className={`rim-cb-btn${screenShareEnabled ? " rim-cb-btn--active" : ""}`}
        onClick={toggleScreenShare}
        disabled={pendingShare}
        aria-pressed={screenShareEnabled}
        aria-label={screenShareEnabled ? "Stop sharing" : "Share screen"}
      >
        <span className="rim-cb-btn__icon" aria-hidden="true">🖥️</span>
        <span className="rim-cb-btn__label">
          {screenShareEnabled ? "Stop sharing" : "Share screen"}
        </span>
      </button>

      <button
        type="button"
        className="rim-cb-btn rim-cb-btn--leave"
        onClick={leave}
        aria-label="Leave session"
      >
        <span className="rim-cb-btn__icon" aria-hidden="true">📞</span>
        <span className="rim-cb-btn__label">Leave</span>
      </button>
    </div>
  );
}
