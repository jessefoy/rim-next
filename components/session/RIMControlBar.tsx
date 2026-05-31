"use client";

/**
 * RIMControlBar — Zoom-aligned bottom control bar.
 *
 * Layout LTR: Mute · Start Video | Participants · Chat | Share · Reactions
 *             · Settings · Bell mode (Co-host) · spacer · End (red)
 *
 * Mic and Video are single toggle buttons. Device selection (mic / speaker /
 * camera) lives in the Settings panel (VideoSettingsPanel), reached via the
 * Settings button — the inline device-picker chevrons were removed (they
 * duplicated Settings and read as dead controls).
 *
 * The Reactions and End buttons open upward popovers (ReactionsMenu, EndMenu).
 *
 * Bell mode (Co-host only) toggles Krisp noise cancellation OFF so the full
 * tone of bells, gongs, and singing bowls passes through unfiltered. NC is
 * on by default at every join; Bell mode is a deliberate per-bell action,
 * not a persisted preference. The button label is stable ("Bell mode") and
 * the on-state is shown with a gold highlight + "On" marker — the label no
 * longer flips to "Clean voice", which read backwards. The state lives in
 * RIMConference's useKrispNoiseFilter hook and is passed in as the
 * noiseFilterEnabled / noiseFilterPending / onToggleNoiseFilter prop trio.
 */

import { useRef, useState, useEffect } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import ReactionsMenu from "./ReactionsMenu";
import EndMenu from "./EndMenu";
import {
  IconMicOn,
  IconMicOff,
  IconCamOn,
  IconCamOff,
  IconParticipants,
  IconChat,
  IconShare,
  IconReactions,
  IconSettings,
  IconBell,
} from "./ControlBarIcons";

interface Props {
  programSlug: string;
  /** YYYY-MM-DD in CT — scopes End-for-All to this session's room. */
  sessionDate: string | undefined;
  /** End-for-All capability — drives the End button label ("End" vs "Leave")
   *  and the EndMenu's "End for all" option. Held by the assigned host,
   *  ADMIN, GUIDING_TEACHER, and the Teacher when no host is assigned. */
  hasEndAllAuthority: boolean;
  /** Co-host (or higher): gates Share Screen affordance and the Bell mode toggle. */
  isCoHost: boolean;
  participantsOpen: boolean;
  onToggleParticipants: () => void;
  chatOpen: boolean;
  onToggleChat: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  participantCount: number;
  raisedHandCount: number;
  unreadChatCount?: number;
  /** True once the Krisp WASM processor has loaded successfully. Browsers
   *  where Krisp is unsupported (older Safari, some Firefox configs) report
   *  this as false; we hide the Bell mode toggle entirely in that case so
   *  it doesn't appear to lie about NC state. */
  noiseFilterAvailable: boolean;
  /** Whether Krisp NC is currently active on the local mic track. */
  noiseFilterEnabled: boolean;
  /** True while Krisp is loading/swapping; disables the Bell mode toggle. */
  noiseFilterPending: boolean;
  /** Flip NC on ↔ off. Bell mode = NC off. */
  onToggleNoiseFilter: () => void;
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
  sessionDate,
  hasEndAllAuthority,
  isCoHost,
  participantsOpen,
  onToggleParticipants,
  chatOpen,
  onToggleChat,
  settingsOpen,
  onToggleSettings,
  participantCount,
  raisedHandCount,
  unreadChatCount,
  noiseFilterAvailable,
  noiseFilterEnabled,
  noiseFilterPending,
  onToggleNoiseFilter,
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
      {/* ── Mic ─────────────────────────────────────────────────── */}
      <button
        type="button"
        className={`rim-cb-btn rim-cb-btn--mic${micEnabled ? "" : " rim-cb-btn--off"}`}
        onClick={toggleMic}
        disabled={pendingMic}
        aria-pressed={micEnabled}
        aria-label={micEnabled ? "Mute" : "Unmute"}
      >
        <span className="rim-cb-btn__icon" aria-hidden="true">
          {micEnabled ? <IconMicOn /> : <IconMicOff />}
        </span>
        <span className="rim-cb-btn__label">{micEnabled ? "Mute" : "Unmute"}</span>
      </button>

      {/* ── Video ───────────────────────────────────────────────── */}
      <button
        type="button"
        className={`rim-cb-btn rim-cb-btn--cam${cameraEnabled ? "" : " rim-cb-btn--off"}`}
        onClick={toggleCamera}
        disabled={pendingCam}
        aria-pressed={cameraEnabled}
        aria-label={cameraEnabled ? "Stop Video" : "Start Video"}
      >
        <span className="rim-cb-btn__icon" aria-hidden="true">
          {cameraEnabled ? <IconCamOn /> : <IconCamOff />}
        </span>
        <span className="rim-cb-btn__label">
          {cameraEnabled ? "Stop Video" : "Start Video"}
        </span>
      </button>

      {/* ── Participants ────────────────────────────────────────── */}
      <button
        type="button"
        className={`rim-cb-btn${participantsOpen ? " rim-cb-btn--active" : ""}`}
        onClick={onToggleParticipants}
        aria-pressed={participantsOpen}
        aria-label="Participants"
      >
        <span className="rim-cb-btn__icon" aria-hidden="true"><IconParticipants /></span>
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
        <span className="rim-cb-btn__icon" aria-hidden="true"><IconChat /></span>
        <span className="rim-cb-btn__label">Chat</span>
        {unreadChatCount && unreadChatCount > 0 ? (
          <span
            className="rim-cb-btn__badge"
            aria-label={`${unreadChatCount} unread message${unreadChatCount === 1 ? "" : "s"}`}
          >
            {unreadChatCount > 9 ? "9+" : unreadChatCount}
          </span>
        ) : null}
      </button>

      {/* ── Share Screen — Co-host or higher only ───────────────── */}
      {isCoHost && (
        <button
          type="button"
          className={`rim-cb-btn rim-cb-btn--share${screenShareEnabled ? " rim-cb-btn--share-active" : ""}`}
          onClick={toggleScreenShare}
          disabled={pendingShare}
          aria-pressed={screenShareEnabled}
          aria-label={screenShareEnabled ? "Stop Share" : "Share Screen"}
        >
          <span className="rim-cb-btn__icon" aria-hidden="true"><IconShare /></span>
          <span className="rim-cb-btn__label">
            {screenShareEnabled ? "Stop Share" : "Share Screen"}
          </span>
        </button>
      )}

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
          <span className="rim-cb-btn__icon" aria-hidden="true"><IconReactions /></span>
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
        <span className="rim-cb-btn__icon" aria-hidden="true"><IconSettings /></span>
        <span className="rim-cb-btn__label">Settings</span>
      </button>

      {/* ── Bell mode — Co-host only, only when Krisp is available ──
          Bell mode ON  (NC off) — bells, gongs, singing bowls pass through
                                   unfiltered. Gold highlight + "On" marker.
          Bell mode OFF (NC on, default) — voice cleaned, ambient suppressed.
          The label stays "Bell mode" in both states (it used to flip to
          "Clean voice", which read backwards); the on-state is shown by the
          highlight and the "On" marker, not by changing the word. Resets to
          OFF at every join. Hidden when Krisp isn't supported in the browser,
          so the button can't lie about its state. */}
      {isCoHost && noiseFilterAvailable && (
        <button
          type="button"
          className={`rim-cb-btn rim-cb-btn--bell${!noiseFilterEnabled ? " rim-cb-btn--bell-active" : ""}`}
          onClick={onToggleNoiseFilter}
          disabled={noiseFilterPending}
          aria-pressed={!noiseFilterEnabled}
          aria-label={
            noiseFilterEnabled
              ? "Turn on Bell mode to let a bell's full tone through"
              : "Bell mode is on — tap to return to clean voice"
          }
          title={
            noiseFilterEnabled
              ? "Tap before ringing a bell to let its full tone through"
              : "Bell mode is on — bells pass through. Tap to return to clean voice."
          }
        >
          <span className="rim-cb-btn__icon" aria-hidden="true"><IconBell /></span>
          <span className="rim-cb-btn__label">Bell mode</span>
          {!noiseFilterEnabled && (
            <span className="rim-cb-btn__badge rim-cb-btn__badge--bell">On</span>
          )}
        </button>
      )}

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
          <span className="rim-cb-btn__label">{hasEndAllAuthority ? "End" : "Leave"}</span>
        </button>
        <EndMenu
          open={endOpen}
          onClose={() => setEndOpen(false)}
          hasEndAllAuthority={hasEndAllAuthority}
          programSlug={programSlug}
          sessionDate={sessionDate}
          anchorRef={endAnchor}
        />
      </div>
    </div>
  );
}
