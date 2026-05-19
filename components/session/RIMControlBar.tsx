"use client";

/**
 * RIMControlBar — Zoom-aligned bottom control bar.
 *
 * Layout LTR: Mute · Start Video | Participants · Chat | Share · Reactions
 *             · Settings · spacer · End (red)
 *
 * Mic and Video buttons are two-part clusters: main toggle on the left,
 * thin vertical divider, chevron on the right that opens an upward
 * device-picker popover (DevicePickerMenu — added in commit 2).
 *
 * The Reactions and End buttons open upward popovers (ReactionsMenu, EndMenu).
 */

import { useRef, useState, useEffect } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import ReactionsMenu from "./ReactionsMenu";
import EndMenu from "./EndMenu";

interface Props {
  programSlug: string;
  isHost: boolean;
  participantsOpen: boolean;
  onToggleParticipants: () => void;
  chatOpen: boolean;
  onToggleChat: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  participantCount: number;
  raisedHandCount: number;
  unreadChatCount?: number;
}

function useLocalTrackState() {
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

export default function RIMControlBar({
  programSlug,
  isHost,
  participantsOpen,
  onToggleParticipants,
  chatOpen,
  onToggleChat,
  settingsOpen,
  onToggleSettings,
  participantCount,
  raisedHandCount,
  unreadChatCount,
}: Props) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const { micEnabled, cameraEnabled, screenShareEnabled } = useLocalTrackState();
  const [pendingMic, setPendingMic] = useState(false);
  const [pendingCam, setPendingCam] = useState(false);
  const [pendingShare, setPendingShare] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const reactionsAnchor = useRef<HTMLButtonElement | null>(null);
  const endAnchor = useRef<HTMLButtonElement | null>(null);

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

  return (
    <div className="rim-cb" role="toolbar" aria-label="Session controls">
      {/* ── Mic cluster: main + chevron ─────────────────────────── */}
      <div className={`rim-cb-cluster${micEnabled ? "" : " rim-cb-cluster--off"}`}>
        <button
          type="button"
          className="rim-cb-btn rim-cb-btn--mic"
          onClick={toggleMic}
          disabled={pendingMic}
          aria-pressed={micEnabled}
          aria-label={micEnabled ? "Mute" : "Unmute"}
        >
          <span className="rim-cb-btn__icon" aria-hidden="true">
            {micEnabled ? "🎤" : "🔇"}
          </span>
          <span className="rim-cb-btn__label">{micEnabled ? "Mute" : "Unmute"}</span>
        </button>
        <span className="rim-cb-cluster__divider" aria-hidden="true" />
        <button
          type="button"
          className="rim-cb-chevron"
          aria-label="Select microphone"
          disabled
          aria-disabled="true"
          title="Device selection — coming next"
        >
          ▴
        </button>
      </div>

      {/* ── Video cluster: main + chevron ───────────────────────── */}
      <div className={`rim-cb-cluster${cameraEnabled ? "" : " rim-cb-cluster--off"}`}>
        <button
          type="button"
          className="rim-cb-btn rim-cb-btn--cam"
          onClick={toggleCamera}
          disabled={pendingCam}
          aria-pressed={cameraEnabled}
          aria-label={cameraEnabled ? "Stop Video" : "Start Video"}
        >
          <span className="rim-cb-btn__icon" aria-hidden="true">
            {cameraEnabled ? "📹" : "📷"}
          </span>
          <span className="rim-cb-btn__label">
            {cameraEnabled ? "Stop Video" : "Start Video"}
          </span>
        </button>
        <span className="rim-cb-cluster__divider" aria-hidden="true" />
        <button
          type="button"
          className="rim-cb-chevron"
          aria-label="Select camera"
          disabled
          aria-disabled="true"
          title="Device selection — coming next"
        >
          ▴
        </button>
      </div>

      <div className="rim-cb-gap" aria-hidden="true" />

      {/* ── Participants ────────────────────────────────────────── */}
      <button
        type="button"
        className={`rim-cb-btn${participantsOpen ? " rim-cb-btn--active" : ""}`}
        onClick={onToggleParticipants}
        aria-pressed={participantsOpen}
        aria-label="Participants"
      >
        <span className="rim-cb-btn__icon" aria-hidden="true">👥</span>
        <span className="rim-cb-btn__label">Participants</span>
        {raisedHandCount > 0 && (
          <span className="rim-cb-btn__badge rim-cb-btn__badge--hand" aria-label={`${raisedHandCount} raised hand${raisedHandCount === 1 ? "" : "s"}`}>
            ✋ {raisedHandCount}
          </span>
        )}
        {participantCount > 0 && raisedHandCount === 0 && (
          <span className="rim-cb-btn__badge">{participantCount}</span>
        )}
      </button>

      {/* ── Chat ────────────────────────────────────────────────── */}
      <button
        type="button"
        className={`rim-cb-btn${chatOpen ? " rim-cb-btn--active" : ""}`}
        onClick={onToggleChat}
        aria-pressed={chatOpen}
        aria-label="Chat"
      >
        <span className="rim-cb-btn__icon" aria-hidden="true">💬</span>
        <span className="rim-cb-btn__label">Chat</span>
        {unreadChatCount && unreadChatCount > 0 ? (
          <span className="rim-cb-btn__badge">{unreadChatCount}</span>
        ) : null}
      </button>

      <div className="rim-cb-gap" aria-hidden="true" />

      {/* ── Share Screen ────────────────────────────────────────── */}
      <button
        type="button"
        className={`rim-cb-btn rim-cb-btn--share${screenShareEnabled ? " rim-cb-btn--share-active" : ""}`}
        onClick={toggleScreenShare}
        disabled={pendingShare}
        aria-pressed={screenShareEnabled}
        aria-label={screenShareEnabled ? "Stop Share" : "Share Screen"}
      >
        <span className="rim-cb-btn__icon" aria-hidden="true">🖥️</span>
        <span className="rim-cb-btn__label">
          {screenShareEnabled ? "Stop Share" : "Share Screen"}
        </span>
      </button>

      {/* ── Reactions ───────────────────────────────────────────── */}
      <div className="rim-cb-anchor">
        <button
          ref={reactionsAnchor}
          type="button"
          className={`rim-cb-btn${reactionsOpen ? " rim-cb-btn--active" : ""}`}
          onClick={() => setReactionsOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={reactionsOpen}
          aria-label="Reactions"
        >
          <span className="rim-cb-btn__icon" aria-hidden="true">🙂</span>
          <span className="rim-cb-btn__label">Reactions</span>
        </button>
        {localParticipant && (
          <ReactionsMenu
            localParticipant={localParticipant}
            open={reactionsOpen}
            onClose={() => setReactionsOpen(false)}
            anchorRef={reactionsAnchor}
          />
        )}
      </div>

      {/* ── Settings ────────────────────────────────────────────── */}
      <button
        type="button"
        className={`rim-cb-btn${settingsOpen ? " rim-cb-btn--active" : ""}`}
        onClick={onToggleSettings}
        aria-pressed={settingsOpen}
        aria-label="Settings"
      >
        <span className="rim-cb-btn__icon" aria-hidden="true">⚙</span>
        <span className="rim-cb-btn__label">Settings</span>
      </button>

      <div className="rim-cb-spacer" aria-hidden="true" />

      {/* ── End / Leave ─────────────────────────────────────────── */}
      <div className="rim-cb-anchor">
        <button
          ref={endAnchor}
          type="button"
          className="rim-cb-btn rim-cb-btn--end"
          onClick={() => setEndOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={endOpen}
          aria-label="End"
        >
          <span className="rim-cb-btn__label">{isHost ? "End" : "Leave"}</span>
        </button>
        <EndMenu
          open={endOpen}
          onClose={() => setEndOpen(false)}
          isHost={isHost}
          programSlug={programSlug}
          anchorRef={endAnchor}
        />
      </div>
    </div>
  );
}
