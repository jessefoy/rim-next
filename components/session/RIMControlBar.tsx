"use client";

/**
 * RIMControlBar — Zoom-aligned bottom control bar.
 *
 * Layout: a centered main cluster (Zoom-style) — Mute · Start Video |
 *         Participants · Chat | Share · Reactions · Settings · Bell mode ·
 *         Mute All (the last three Co-host only) — with the red End/Leave
 *         pinned to the far right in its own zone. The cluster is truly
 *         centered (left gutter / center / End-zone are balanced grid tracks);
 *         on phones it collapses to a centered wrap.
 *
 * Mic and Video are single toggle buttons. Device selection (mic / speaker /
 * camera) lives in the Settings panel (VideoSettingsPanel), reached via the
 * Settings button — the inline device-picker chevrons were removed (they
 * duplicated Settings and read as dead controls).
 *
 * The Reactions and End buttons open upward popovers (ReactionsMenu, EndMenu).
 *
 * Bell mode (Co-host only) toggles RNNoise noise cancellation OFF so the full
 * tone of bells, gongs, and singing bowls passes through unfiltered. NC is
 * on by default at every join; Bell mode is a deliberate per-bell action,
 * not a persisted preference. The button label is stable ("Bell mode") and
 * the on-state is shown with a gold highlight + "On" marker — the label no
 * longer flips to "Clean voice", which read backwards. The state lives in
 * RIMConference's useNoiseFilter hook and is passed in as the
 * noiseFilterEnabled / noiseFilterPending / onToggleNoiseFilter prop trio.
 */

import { useRef, useState, useEffect } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { detectPlatform } from "@/lib/detectPlatform";
import ReactionsMenu from "./ReactionsMenu";
import EndMenu from "./EndMenu";
import ShareScreenPrimer from "./ShareScreenPrimer";
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
  /** True when the browser supports the RNNoise filter (AudioWorklet) and its
   *  WASM loaded. Browsers where it's unsupported report this as false; we hide
   *  the Bell mode toggle entirely in that case so it doesn't lie about NC state. */
  noiseFilterAvailable: boolean;
  /** Whether RNNoise NC is currently active on the local mic track. */
  noiseFilterEnabled: boolean;
  /** True while RNNoise is attaching/swapping; disables the Bell mode toggle. */
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
  const [shareIntroOpen, setShareIntroOpen] = useState(false);
  // Mute All (co-host) — moved here from the Participants footer so it sits
  // with the other host controls. The button label reports the count briefly;
  // a failure surfaces as a transient notice above the bar.
  const [mutingAll, setMutingAll] = useState(false);
  const [muteAllResult, setMuteAllResult] = useState<number | null>(null);
  const [muteAllFailed, setMuteAllFailed] = useState(false);

  const reactionsAnchor = useRef<HTMLButtonElement | null>(null);
  const endAnchor = useRef<HTMLButtonElement | null>(null);
  const shareAnchor = useRef<HTMLButtonElement | null>(null);

  async function toggleMic() {
    if (!room) return;
    setPendingMic(true);
    try {
      await room.localParticipant.setMicrophoneEnabled(!micEnabled);
    } catch {}
    setPendingMic(false);
  }

  // Press `M` to toggle mute — a foot-pedal for your mic. Available to
  // everyone (the savvy member who wants it, and the mute-while-others-talk
  // echo habit for hosts). The toggle is the SAFE hotkey: an accidental
  // mute is harmless, the mute state is always visible in this bar, and we
  // never fire while the user is typing. (Hold-to-talk on Spacebar is NOT
  // bound here — Spacebar is overloaded (scroll / activate focused button),
  // so an accidental unmute could break a silent sit; push-to-talk is a
  // co-host-only follow-on, deliberately not opened to all.)
  //
  // A ref keeps the document listener pointed at the latest toggleMic
  // (current `micEnabled`) without re-subscribing on every mute flip.
  const toggleMicRef = useRef(toggleMic);
  toggleMicRef.current = toggleMic;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "m") return;
      if (e.repeat) return; // holding M shouldn't machine-gun the toggle
      // Leave OS / browser chords alone (⌘M minimize, etc.).
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Never steal the key while the user is typing in a field.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      toggleMicRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Hold-Spacebar push-to-talk — CO-HOST ONLY. Spacebar is overloaded (it
  // scrolls the page and activates a focused button), so we keep it off the
  // general member population: an accidental unmute would break a silent sit.
  // Hosts know the convention and actively manage audio, so they get it.
  //
  // Semantics: hold Space to talk WHILE MUTED, release to re-mute. If you're
  // already unmuted (via the M toggle), Space does nothing — it never
  // surprise-mutes you mid-sentence. The same typing guard as `M` applies, so
  // a space in the chat box types a space.
  const isCoHostRef = useRef(isCoHost);
  isCoHostRef.current = isCoHost;
  // True only while a Space-hold is actively holding the mic open, so keyup
  // (and the blur backstop) know to close it again — and so we never re-mute
  // someone who was already unmuted before the hold began.
  const pttActiveRef = useRef(false);
  useEffect(() => {
    function inField(target: EventTarget | null): boolean {
      const el = target as HTMLElement | null;
      return (
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      );
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      if (!isCoHostRef.current) return;
      if (e.repeat) return; // holding fires repeated keydowns — engage once
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (inField(e.target)) return;
      const lp = room?.localParticipant;
      if (!lp) return;
      // Already unmuted → leave it alone (never surprise-mute mid-sentence).
      // Edge: if you tap M to mute and grab Space within the mute's brief
      // in-flight window, this flag still reads true and PTT no-ops *that once*
      // — it fails CLOSED (mic stays muted), never open. The normal mute →
      // listen → PTT sequence is well clear of that window. (Reviewer-noted,
      // accepted: failing closed is the right side for a silent room.)
      if (lp.isMicrophoneEnabled) return;
      // Claim Space: suppress page scroll AND focused-button activation.
      e.preventDefault();
      pttActiveRef.current = true;
      Promise.resolve(lp.setMicrophoneEnabled(true)).catch(() => {
        pttActiveRef.current = false;
      });
    }
    // release() gates ONLY on pttActiveRef — deliberately NOT on inField.
    // pttActiveRef can only be true if a keydown already engaged PTT (which
    // can't happen from inside a field), so a stray keyup in the chat box is
    // a no-op. Do NOT add an inField guard here: holding Space, clicking into
    // chat, then releasing would otherwise strand the mic open.
    function release(e?: KeyboardEvent) {
      if (!pttActiveRef.current) return;
      e?.preventDefault();
      pttActiveRef.current = false;
      room?.localParticipant.setMicrophoneEnabled(false).catch(() => {});
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      release(e);
    }
    // Backstops: if the window loses focus mid-hold, keyup may never fire —
    // close the mic so push-to-talk can't get stuck open (which would
    // reintroduce exactly the echo this whole effort was about). `blur` covers
    // tab/window switches; `visibilitychange` covers a focus-steal that hides
    // the page without blurring the window (OS overlay, screen-share picker).
    function onBlur() {
      release();
    }
    function onVisibility() {
      if (document.hidden) release();
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [room]);

  async function toggleCamera() {
    if (!room) return;
    setPendingCam(true);
    try {
      await room.localParticipant.setCameraEnabled(!cameraEnabled);
    } catch {}
    setPendingCam(false);
  }

  // Start is initiated from the primer's "Choose what to share" button — that
  // click is the user gesture getDisplayMedia requires, so the call must run
  // directly from it. Stop is immediate (no primer).
  async function startScreenShare() {
    if (!room) return;
    setShareIntroOpen(false);
    setPendingShare(true);
    try {
      // Crisp screen share for slides/code: tell the encoder to prioritize
      // detail, and raise LiveKit's default 1080p capture cap to 1440p so a
      // high-res screen (small text) isn't pre-downscaled before encoding.
      // Safari 17 mis-captures at LOW res when any resolution is specified
      // (and isn't capped by default), so omit it there.
      const isSafari = detectPlatform().browser === "safari";
      await room.localParticipant.setScreenShareEnabled(true, {
        contentHint: "detail",
        ...(isSafari ? {} : { resolution: { width: 2560, height: 1440, frameRate: 15 } }),
      });
    } catch {}
    setPendingShare(false);
  }

  async function stopScreenShare() {
    if (!room) return;
    setPendingShare(true);
    try {
      await room.localParticipant.setScreenShareEnabled(false);
    } catch {}
    setPendingShare(false);
  }

  // Mute everyone — one tap, non-destructive (people can unmute themselves
  // again). The label flashes "Muted N" on success; a real failure (e.g. a
  // co-host whose hosting capability was paused → 403) flashes a brief notice.
  // The route returns a benign ok with muted:0 when there's no one to mute, so
  // the notice only appears on an actual failure (mirrors the per-row handlers
  // — host controls must surface failure, never swallow it).
  async function muteAll() {
    setMutingAll(true);
    setMuteAllResult(null);
    setMuteAllFailed(false);
    try {
      const res = await fetch("/api/livekit/mute-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programSlug, sessionDate }),
      });
      if (res.ok) {
        const data = await res.json();
        setMuteAllResult(typeof data.muted === "number" ? data.muted : 0);
        setTimeout(() => setMuteAllResult(null), 3000);
      } else {
        setMuteAllFailed(true);
        setTimeout(() => setMuteAllFailed(false), 4000);
      }
    } catch {
      setMuteAllFailed(true);
      setTimeout(() => setMuteAllFailed(false), 4000);
    }
    setMutingAll(false);
  }

  return (
    <div className="rim-cb" role="toolbar" aria-label="Session controls">
      {/* Centered main cluster (Zoom-style). End sits in its own right-hand
          zone below, so this group is truly centered in the bar rather than
          left-justified. On phones the layout collapses to a centered wrap. */}
      <div className="rim-cb__main">
      {/* ── Mic ─────────────────────────────────────────────────── */}
      <button
        type="button"
        className={`rim-cb-btn rim-cb-btn--mic${micEnabled ? "" : " rim-cb-btn--off"}`}
        onClick={toggleMic}
        disabled={pendingMic}
        aria-pressed={micEnabled}
        aria-label={micEnabled ? "Mute" : "Unmute"}
        title={
          micEnabled
            ? "Mute (M)"
            : `Unmute (M)${isCoHost ? " · or hold Space to talk" : ""}`
        }
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

      {/* ── Share Screen — Co-host or higher only ───────────────────
          Sharing fires the browser's own screen picker (web security won't
          let us restyle it). When not sharing, the button opens a short primer
          first so the browser dialog doesn't appear cold; the primer's button
          provides the gesture getDisplayMedia needs. Stopping is immediate. */}
      {isCoHost && (
        <div className="rim-cb-anchor">
          <button
            ref={shareAnchor}
            type="button"
            className={`rim-cb-btn rim-cb-btn--share${screenShareEnabled ? " rim-cb-btn--share-active" : ""}`}
            onClick={() => (screenShareEnabled ? stopScreenShare() : setShareIntroOpen((v) => !v))}
            disabled={pendingShare}
            aria-pressed={screenShareEnabled}
            aria-haspopup={screenShareEnabled ? undefined : "dialog"}
            aria-expanded={screenShareEnabled ? undefined : shareIntroOpen}
            aria-label={screenShareEnabled ? "Stop Share" : "Share Screen"}
          >
            <span className="rim-cb-btn__icon" aria-hidden="true"><IconShare /></span>
            <span className="rim-cb-btn__label">
              {screenShareEnabled ? "Stop Share" : "Share Screen"}
            </span>
          </button>
          <ShareScreenPrimer
            open={shareIntroOpen && !screenShareEnabled}
            onClose={() => setShareIntroOpen(false)}
            onConfirm={startScreenShare}
            anchorRef={shareAnchor}
          />
        </div>
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

      {/* ── Bell mode — Co-host only, only when RNNoise is available ──
          Bell mode ON  (NC off) — bells, gongs, singing bowls pass through
                                   unfiltered. Gold highlight + "On" marker.
          Bell mode OFF (NC on, default) — voice cleaned, ambient suppressed.
          The label stays "Bell mode" in both states (it used to flip to
          "Clean voice", which read backwards); the on-state is shown by the
          highlight and the "On" marker, not by changing the word. Resets to
          OFF at every join. Hidden when RNNoise isn't supported in the browser,
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

      {/* ── Mute All — Co-host only. Grouped here with the other host
          controls (Share / Bell). One tap; non-destructive — everyone can
          unmute themselves again. ── */}
      {isCoHost && (
        <button
          type="button"
          className="rim-cb-btn"
          onClick={muteAll}
          disabled={mutingAll}
          aria-label="Mute all participants"
          title="Mute everyone (they can unmute themselves)"
        >
          <span className="rim-cb-btn__icon" aria-hidden="true"><IconMicOff /></span>
          <span className="rim-cb-btn__label">
            {mutingAll
              ? "Muting…"
              : muteAllResult !== null
              ? `Muted ${muteAllResult}`
              : "Mute All"}
          </span>
        </button>
      )}
      </div>

      {/* ── End / Leave — pinned right; the main cluster above centers ─── */}
      <div className="rim-cb__end-zone">
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

      {/* Transient failure notice for Mute All (floats above the bar) */}
      {muteAllFailed && (
        <span className="rim-cb__notice" role="alert">
          Couldn&apos;t mute all — you may no longer have host controls.
        </span>
      )}
    </div>
  );
}
