"use client";

/**
 * RIMConference — Zoom-aligned LiveKit conference layout.
 *
 * Video grid (Gallery) or focus (Speaker) layout, with a raised-hand banner
 * across the top and the bottom Zoom-style control bar carrying every
 * action button. Participants / Chat / Settings open as overlays. The
 * nonverbal signal toolbar lives inside the Reactions menu in the control
 * bar (no longer a separate top toolbar).
 *
 * Noise suppression is RNNoise (in-browser, self-hosted) via the local
 * useNoiseFilter hook — the replacement for Cloud-only Krisp after RIM moved
 * off LiveKit Cloud (session 150). It's enabled by default on every join;
 * co-hosts (teachers, host managers, the session host) see a "Bell mode"
 * toggle in the control bar that turns NC off so the full tone of bells,
 * gongs, and singing bowls passes through unfiltered. The state resets to
 * NC-on at every session join — Bell mode is a deliberate per-bell action,
 * not a preference that persists.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import {
  GridLayout,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  useParticipantInfo,
  LayoutContextProvider,
  useCreateLayoutContext,
  useStartAudio,
  useRoomContext,
  useConnectionState,
  FocusLayout,
  TrackLoop,
  useSpeakingParticipants,
} from "@livekit/components-react";
import { Track, RoomEvent, DataPacket_Kind, ConnectionState } from "livekit-client";
import RIMParticipantTile from "./RIMParticipantTile";
import ParticipantsPanel, { UNMUTE_REQUEST_TOPIC } from "./ParticipantsPanel";
import VideoSettingsPanel from "./VideoSettingsPanel";
import RIMControlBar from "./RIMControlBar";
import RIMChat, { CHAT_TOPIC } from "./RIMChat";
import { SessionRoleProvider } from "./sessionRole";
import { useNoiseFilter } from "./useNoiseFilter";
import type { ParticipantMetadata } from "./RIMParticipantTile";

interface Props {
  isSessionHost: boolean;
  /** End-for-All capability. Drives the End button label and the EndMenu
   *  "End for all" option. Distinct from `isSessionHost` (identity), held
   *  by assigned hosts, ADMIN, GUIDING_TEACHER, and Teacher-when-no-host. */
  hasEndAllAuthority: boolean;
  isCoHost: boolean;
  isProgramTeacher: boolean;
  /** Per-program override for the Teacher pill text ("Guide", "Facilitator",
   *  etc.). Null/undefined means the pill renders the default "Teacher".
   *  Seeded into participant metadata when the user is a ProgramTeacher. */
  teacherLabel?: string | null;
  programSlug: string;
  /** YYYY-MM-DD in CT — scopes chat to this session. */
  sessionDate?: string;
  guestKey?: string;
  view?: "speaker" | "gallery";
  initialAvatarUrl: string | null;
  /** Reports whether any participant (local included) carries the Host
   *  metadata flag — i.e. a designated host is present in the room. Drives
   *  the page header's context-aware Step-In label. UI-only signal:
   *  metadata is forgeable, so never gate a real action on this. */
  onHostPresence?: (present: boolean) => void;
}

function getMetadata(raw: string | undefined): ParticipantMetadata {
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

export default function RIMConference({ isSessionHost, hasEndAllAuthority, isCoHost, isProgramTeacher, teacherLabel, programSlug, sessionDate, guestKey, view = "gallery", initialAvatarUrl, onHostPresence }: Props) {
  const { localParticipant } = useLocalParticipant();
  // Connection state — drives the "Reconnecting…" banner during a transient
  // drop so the participant knows a recovery is underway (rather than staring
  // at frozen tiles). LiveKit auto-recovers most blips; a failed recovery
  // surfaces separately via onDisconnected → the page's "Connection lost"
  // screen. (Audit CONN-4.)
  const connectionState = useConnectionState();
  // updateOnlyOn ensures the component re-renders when metadata changes (for raised hand tracking)
  const remoteParticipants = useRemoteParticipants({
    updateOnlyOn: [
      RoomEvent.ParticipantMetadataChanged,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
    ],
  });
  const layoutContext = useCreateLayoutContext();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  // Chat DM recipient lifted here (was internal to RIMChat) so the Participants
  // panel can start a private message. "" = Everyone.
  const [chatRecipient, setChatRecipient] = useState<string>("");
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  // Local manual pin (this viewer only, not broadcast). null = auto/gallery.
  // Set by clicking Pin on a tile; overrides active-speaker auto-follow so a
  // viewer can keep e.g. the teacher full-screen regardless of who's speaking.
  const [pinnedIdentity, setPinnedIdentity] = useState<string | null>(null);
  // Ask-to-unmute prompt — the name of the co-host inviting this user to
  // unmute, or null. Set by the data-channel listener below; cleared by
  // either of the prompt's two buttons. We can't force a mic on (browser
  // consent) — the user's own tap on "Unmute" is the unmute.
  const [unmuteAskFrom, setUnmuteAskFrom] = useState<string | null>(null);

  // Raised hands — reactive because of updateOnlyOn above
  const raisedHands = remoteParticipants.filter(
    (p) => getMetadata(p.metadata).signal === "hand"
  );
  const raisedHandCount = raisedHands.length;

  // Seed avatar + role pills into local participant metadata on connect.
  // The pill badges ([RIMParticipantTile.tsx]) key on `meta.host`,
  // `meta.teacher`, and `meta.cohost` — normally seeded by the token
  // route at issuance. This client-side pass is belt-and-suspenders for
  // every reconnect path (Step-In, mid-session token refresh): if the
  // server seed didn't land (e.g. a race during reconnect, or LiveKit's
  // participant rejoin reusing prior metadata), the explicit setMetadata
  // call here broadcasts the corrected state to every other client
  // immediately, so all three pills appear in the same render that the
  // capability tier changes.
  //
  // The `cohost` flag is the only one with a constraint: it should be
  // true *only* when the user has Co-host capability AND is neither
  // Session Host nor a ProgramTeacher (Host/Teacher pills take priority).
  // We only promote flags upward — we don't clear stale flags here, so
  // a former host who somehow lost their HostAssignment mid-session would
  // still show the Host pill until they rejoin. Acceptable; defense-in-
  // depth lives at the token-issue layer.
  useEffect(() => {
    if (!localParticipant) return;
    const meta = getMetadata(localParticipant.metadata);
    const wantCohost = isCoHost && !isSessionHost && !isProgramTeacher;
    const needsAvatarUpdate = !!avatarUrl && meta.avatarUrl !== avatarUrl;
    const needsHostUpdate = isSessionHost && meta.host !== true;
    const needsTeacherUpdate = isProgramTeacher && meta.teacher !== true;
    const needsCohostUpdate = wantCohost && meta.cohost !== true;
    // teacherLabel piggybacks on the teacher flag. We only update it when
    // a label is supplied AND the user is a ProgramTeacher AND the metadata
    // doesn't already carry the same string. We don't *clear* the label on
    // its own (cleared only by a full meta reset). Keeps the propagation
    // narrow — same shape as host/teacher/cohost: promote, don't demote.
    const needsTeacherLabelUpdate =
      isProgramTeacher && !!teacherLabel && meta.teacherLabel !== teacherLabel;
    if (
      !needsAvatarUpdate &&
      !needsHostUpdate &&
      !needsTeacherUpdate &&
      !needsCohostUpdate &&
      !needsTeacherLabelUpdate
    ) return;
    const next: ParticipantMetadata = { ...meta };
    if (needsAvatarUpdate) next.avatarUrl = avatarUrl ?? undefined;
    if (needsHostUpdate) next.host = true;
    if (needsTeacherUpdate) next.teacher = true;
    if (needsTeacherLabelUpdate) next.teacherLabel = teacherLabel ?? undefined;
    if (needsCohostUpdate) next.cohost = true;
    localParticipant.setMetadata(JSON.stringify(next));
  }, [localParticipant, avatarUrl, isSessionHost, isProgramTeacher, teacherLabel, isCoHost]);

  // Noise suppression — RNNoise, on by default every join (the conference
  // remounts each join, so this resets to on). Co-host "Bell mode" toggles it
  // off so bells/bowls pass raw. The processor attaches to the mic when it
  // publishes; see useNoiseFilter / RnnoiseAudioProcessor.
  const nc = useNoiseFilter();

  const roomCtx = useRoomContext();

  // Unread chat badge. The live chat listener lives in RIMChat, which only
  // mounts while the panel is open — so when chat is closed nothing counts
  // incoming messages. This always-on listener fills that gap: it counts
  // CHAT_TOPIC packets received while the panel is closed and resets to 0 when
  // the panel opens. LiveKit doesn't loop publishData back to the sender, so a
  // user's own messages never inflate their own count; DM packets addressed to
  // others never reach this client, so the count only reflects messages this
  // user can actually read.
  const chatOpenRef = useRef(chatOpen);
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);
  useEffect(() => { if (chatOpen) setUnreadChatCount(0); }, [chatOpen]);
  useEffect(() => {
    if (!roomCtx) return;
    const handler = (
      _payload: Uint8Array,
      _participant: unknown,
      _kind?: DataPacket_Kind,
      topic?: string,
    ) => {
      if (topic !== CHAT_TOPIC) return;
      if (chatOpenRef.current) return;
      setUnreadChatCount((n) => n + 1);
    };
    roomCtx.on(RoomEvent.DataReceived, handler);
    return () => { roomCtx.off(RoomEvent.DataReceived, handler); };
  }, [roomCtx]);

  // Ask-to-unmute listener — a co-host tapped "Ask to unmute" on this user's
  // roster row (sent via data channel, addressed to this identity only).
  // Ignored when the mic is already on (a stale or racing invite). Same
  // trust tier as Reactions: any client could emit this topic, but the
  // prompt only ever *invites* — the user's own tap performs the unmute.
  useEffect(() => {
    if (!roomCtx) return;
    const handler = (
      payload: Uint8Array,
      _participant: unknown,
      _kind?: DataPacket_Kind,
      topic?: string,
    ) => {
      if (topic !== UNMUTE_REQUEST_TOPIC) return;
      if (roomCtx.localParticipant?.isMicrophoneEnabled) return;
      let fromName = "The host";
      try {
        const parsed = JSON.parse(new TextDecoder().decode(payload));
        if (typeof parsed.fromName === "string" && parsed.fromName.trim()) {
          fromName = parsed.fromName.trim();
        }
      } catch {
        // Unparseable payload — keep the generic name.
      }
      setUnmuteAskFrom(fromName);
    };
    roomCtx.on(RoomEvent.DataReceived, handler);
    return () => { roomCtx.off(RoomEvent.DataReceived, handler); };
  }, [roomCtx]);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  // Subscribe to local metadata changes so the sort below re-runs when the
  // local user raises/lowers their own hand. useRemoteParticipants already
  // covers remote metadata changes via its updateOnlyOn config above; this
  // adds the symmetric reactivity for the local participant.
  const { metadata: localMetadataRaw } = useParticipantInfo({ participant: localParticipant });

  // Host presence — true when any participant (local included) carries the
  // Host metadata flag. Reported up to the page so the Step-In affordance
  // can speak to the actual situation ("No host yet" vs "Take over").
  // Reactive via the same sources as the hand-raise sort: remoteParticipants
  // re-renders on ParticipantMetadataChanged / connect / disconnect, and
  // localMetadataRaw covers the local seeding effect landing.
  const hostPresent =
    getMetadata(localMetadataRaw ?? localParticipant?.metadata).host === true ||
    remoteParticipants.some((p) => getMetadata(p.metadata).host === true);
  const onHostPresenceRef = useRef(onHostPresence);
  useEffect(() => { onHostPresenceRef.current = onHostPresence; });
  useEffect(() => {
    onHostPresenceRef.current?.(hostPresent);
  }, [hostPresent]);

  // Zoom-style speaking queue: hand-raised tiles sort to the top-left of
  // the grid in the order they were raised (ascending raisedHandAt). Tiles
  // are not enlarged — the reordering itself is the focus mechanism, which
  // matches how Zoom actually solves this. Non-hand tiles preserve their
  // original order (Array.prototype.sort is stable since ES2019).
  //
  // The sort runs against the live `tracks` array returned by useTracks,
  // reading each participant's current metadata. We resolve the local
  // participant's metadata from the reactive `localMetadataRaw` source so
  // the local user's own raise reorders their tile too; remote tiles read
  // directly from `participant.metadata` and re-render via the
  // remoteParticipants subscription above.
  const sortedTracks = useMemo(() => {
    const localIdentity = localParticipant?.identity;
    function metaFor(identity: string, fallback: string | undefined): ParticipantMetadata {
      if (localIdentity && identity === localIdentity) {
        return getMetadata(localMetadataRaw ?? fallback);
      }
      return getMetadata(fallback);
    }
    // Camera tiles only — screen-share tracks are auto-focused (handled in the
    // pin-orchestration effect below), never shown as a grid/filmstrip tile.
    return [...tracks]
      .filter((t) => t.source === Track.Source.Camera)
      .sort((a, b) => {
      const aMeta = metaFor(a.participant.identity, a.participant.metadata);
      const bMeta = metaFor(b.participant.identity, b.participant.metadata);
      const aHand = aMeta.signal === "hand";
      const bHand = bMeta.signal === "hand";
      if (aHand && !bHand) return -1;
      if (bHand && !aHand) return 1;
      if (aHand && bHand) {
        const at = (aMeta.raisedHandAt ?? 0) - (bMeta.raisedHandAt ?? 0);
        if (at !== 0) return at;
        // Secondary sort by identity for cross-client determinism: if two
        // people raise their hands within the same millisecond, every
        // client agrees on the order (otherwise queue numbers can disagree
        // between participants, which makes "Marsha is #2" untrustworthy).
        return a.participant.identity.localeCompare(b.participant.identity);
      }
      return 0; // stable: preserve original order for non-hand tiles
    });
    // remoteParticipants is in deps to retrigger the memo when any remote
    // metadata changes (the hook re-runs on ParticipantMetadataChanged).
  }, [tracks, localParticipant, localMetadataRaw, remoteParticipants]);

  const speakers = useSpeakingParticipants();

  // The pin is dispatched from this effect. LiveKit's set_pin reducer returns a
  // FRESH array on every dispatch, so a guard that reads `layoutContext.pin.state`
  // back to ask "is this already pinned?" is fragile — when it fails to
  // recognize convergence it re-dispatches every render, the pin state churns,
  // and the focus stage (FocusLayout) re-subscribes forever (React #185,
  // "Maximum update depth"). So we gate on OUR OWN record of the last target we
  // asked for — a signature string — never on reading the state back: we
  // dispatch at most once per target and the state goes stable. "" = nothing yet.
  const lastPinSigRef = useRef<string>("");

  // Pin orchestration (precedence): manual pin (this viewer) > active screen
  // share > speaker-view active-speaker follow > gallery (no pin). Each branch
  // computes a desired signature; we dispatch only when it changes.
  useEffect(() => {
    const setPin = (sig: string, ref: (typeof tracks)[number]) => {
      if (sig === lastPinSigRef.current) return;
      lastPinSigRef.current = sig;
      layoutContext.pin.dispatch?.({ msg: "set_pin", trackReference: ref });
    };
    const clearPin = () => {
      if (lastPinSigRef.current === "clear") return;
      lastPinSigRef.current = "clear";
      layoutContext.pin.dispatch?.({ msg: "clear_pin" });
    };

    // 1. Manual pin (this viewer) — always wins; release if they left. Including
    //    the publication sid means a camera on/off (placeholder ↔ real track)
    //    re-pins automatically.
    if (pinnedIdentity) {
      const target = tracks.find(
        (t) => t.source === Track.Source.Camera && t.participant.identity === pinnedIdentity,
      );
      if (!target) {
        clearPin();
        setPinnedIdentity(null);
        return;
      }
      setPin(`pin:${pinnedIdentity}:${target.publication?.trackSid ?? "ph"}`, target);
      return;
    }

    // 2. Active screen share — auto-focus (Zoom-style), over gallery/speaker.
    const shareTrack = tracks.find(
      (t) => t.source === Track.Source.ScreenShare && !!t.publication,
    );
    if (shareTrack) {
      setPin(`share:${shareTrack.publication?.trackSid ?? "ph"}`, shareTrack);
      return;
    }

    // 3. Gallery — no pin.
    if (view === "gallery") {
      clearPin();
      return;
    }

    // 4. Speaker view — follow the active speaker; if none, keep the current
    //    speaker pin while that person is still present; else first remote camera.
    const cameraTracks = tracks.filter((t) => t.source === Track.Source.Camera);
    if (cameraTracks.length === 0) {
      clearPin();
      return;
    }
    const activeSpeakerIdentity = speakers
      .map((sp) => sp.identity)
      .find((id) => cameraTracks.some((t) => t.participant.identity === id));

    let nextTrack: (typeof tracks)[number] | null = null;
    if (activeSpeakerIdentity) {
      nextTrack = cameraTracks.find((t) => t.participant.identity === activeSpeakerIdentity) ?? null;
    }
    if (!nextTrack) {
      // No active speaker — keep the current speaker pin if its camera is still here.
      const sig = lastPinSigRef.current;
      if (sig.startsWith("speaker:")) {
        const keptIdentity = sig.slice("speaker:".length).split(":")[0];
        if (cameraTracks.some((t) => t.participant.identity === keptIdentity)) return;
      }
      nextTrack =
        cameraTracks.find((t) => t.participant.identity !== localParticipant?.identity) ??
        cameraTracks[0] ??
        null;
    }
    if (!nextTrack) return;
    setPin(
      `speaker:${nextTrack.participant.identity}:${nextTrack.publication?.trackSid ?? "ph"}`,
      nextTrack,
    );
  }, [view, speakers, tracks, layoutContext.pin, localParticipant?.identity, pinnedIdentity]);

  // Render focus layout when there's a pinned track — from a manual pin (any
  // view), an active screen share (any view, Zoom-style), or speaker view's
  // active-speaker follow. Otherwise gallery.
  const hasScreenShare = tracks.some(
    (t) => t.source === Track.Source.ScreenShare && !!t.publication,
  );
  const inFocusView =
    (!!pinnedIdentity || hasScreenShare || view === "speaker") &&
    !!layoutContext.pin.state &&
    layoutContext.pin.state.length > 0;

  // Name of the manually pinned participant, for the pin banner.
  const pinnedName = pinnedIdentity
    ? (localParticipant?.identity === pinnedIdentity
        ? (localParticipant?.name || "you")
        : (() => {
            const p = remoteParticipants.find((rp) => rp.identity === pinnedIdentity);
            return p?.name || p?.identity || "participant";
          })())
    : "";

  // Filmstrip (carousel) tracks in focus view: the camera list MINUS the track
  // already filling the main FocusLayout pane. Without this, a focused *camera*
  // track (speaker-view active-speaker follow, or a manual pin of a camera-on
  // participant) renders twice — full-size in the focus pane and again in the
  // filmstrip. (Screen-share focus is already safe: sortedTracks is camera-only,
  // so the share is never a carousel tile.) Match the pinned ref by identity +
  // publication.trackSid — the same comparison the pin-orchestration effect uses
  // — which also covers a camera-off pin: the pinned placeholder and its carousel
  // twin both carry an undefined trackSid, so identity alone disambiguates.
  // Mirrors stock VideoConference's `tracks.filter(t => !isEqualTrackRef(t, focusTrack))`.
  const focusTrackRef = layoutContext.pin.state?.[0];
  // Memoized so the filmstrip's track list keeps a stable identity across
  // renders (the focus view renders it via TrackLoop). Keyed on stable
  // primitives — the memoized sortedTracks plus the focused track's identity +
  // trackSid — so it recomputes only on a real change, not on every render.
  const focusIdentity = focusTrackRef?.participant.identity;
  const focusTrackSid = focusTrackRef?.publication?.trackSid;
  const hasFocus = !!focusTrackRef;
  const carouselTracks = useMemo(
    () =>
      hasFocus
        ? sortedTracks.filter(
            (t) =>
              !(
                t.participant.identity === focusIdentity &&
                t.publication?.trackSid === focusTrackSid
              ),
          )
        : sortedTracks,
    [sortedTracks, hasFocus, focusIdentity, focusTrackSid],
  );

  // The focus stage must render the LIVE track ref — it carries the freshly
  // subscribed remote media. focusTrackRef (from pin.state) is the snapshot we
  // dispatched, which for a remote screen share predates subscription, so
  // rendering it leaves *receivers* a blank stage (the sharer's own local track
  // has media immediately — which is why only they saw it). Re-resolve from the
  // live `tracks` (matched by identity + source: one camera / one share each).
  // Safe re: the prior #185 — FocusLayout's track-observer effects key on the
  // string getTrackReferenceId, so a new ref object with the same id doesn't
  // re-subscribe.
  const focusStageRef = focusTrackRef
    ? (tracks.find(
        (t) =>
          t.participant.identity === focusTrackRef.participant.identity &&
          t.source === focusTrackRef.source,
      ) ?? focusTrackRef)
    : focusTrackRef;

  return (
    <SessionRoleProvider
      value={{
        isSessionHost,
        isCoHost,
        isProgramTeacher,
        programSlug,
        sessionDate,
        localIdentity: localParticipant?.identity ?? null,
        pinnedIdentity,
        onTogglePin: (identity: string) =>
          setPinnedIdentity((prev) => (prev === identity ? null : identity)),
      }}
    >
    <LayoutContextProvider value={layoutContext}>
      <div className={`rim-conference rim-conference--${view}`}>

        {/* Reconnecting banner — transient connection recovery (Audit CONN-4) */}
        {(connectionState === ConnectionState.Reconnecting ||
          connectionState === ConnectionState.SignalReconnecting) && (
          <div className="rim-reconnect-banner" role="status">
            <span>Reconnecting…</span>
          </div>
        )}

        {/* Raised-hand banner — at-a-glance, visible without opening the panel */}
        {raisedHandCount > 0 && (
          <div className="rim-hand-banner">
            <span>
              ✋{" "}
              {raisedHandCount === 1
                ? `${raisedHands[0].name || raisedHands[0].identity} raised their hand`
                : `${raisedHandCount} people raised their hand`}
            </span>
            {!participantsOpen && (
              <button
                className="rim-hand-banner__open"
                onClick={() => setParticipantsOpen(true)}
              >
                View
              </button>
            )}
          </div>
        )}

        {/* Pin banner — visible named escape path while a manual pin is active */}
        {pinnedIdentity && (
          <div className="rim-pin-banner">
            <span>📌 Pinned {pinnedName} to your view</span>
            <button
              className="rim-pin-banner__open"
              onClick={() => setPinnedIdentity(null)}
            >
              Unpin
            </button>
          </div>
        )}

        {/* Video grid + optional chat sidebar */}
        <div className="rim-conference__main">
          <div className="rim-conference__video">
            {inFocusView ? (
              // Custom focus layout — a "stage" (screen share / pinned / active
              // speaker) over a fixed-height filmstrip. We deliberately do NOT
              // use LiveKit's FocusLayoutContainer + CarouselLayout: the carousel
              // sizes its tiles from a measured area that itself depends on the
              // tiles — a size↔count feedback loop that throws React #185
              // ("Maximum update depth") the instant focus view mounts, which is
              // what dropped every receiver on a screen share. A plain CSS strip
              // has no measurement, so it cannot loop. FocusLayout (the stage) is
              // a light, non-measuring wrapper and is kept as-is.
              <div className="rim-focus">
                <div className="rim-focus__stage">
                  <FocusLayout trackRef={focusStageRef!} />
                </div>
                {carouselTracks.length > 0 && (
                  <div className="rim-focus__strip">
                    <TrackLoop tracks={carouselTracks}>
                      <RIMParticipantTile />
                    </TrackLoop>
                  </div>
                )}
              </div>
            ) : (
              <GridLayout tracks={sortedTracks}>
                <RIMParticipantTile />
              </GridLayout>
            )}
          </div>

          {/* Right side column — Chat and Participants share it. On desktop
              both can be open at once, stacked Zoom-style (participants above
              chat); on phones (≤768px) the wrapper is display:contents and
              each keeps its original overlay/sidebar behavior — a phone
              can't host video plus two panels. */}
          {(chatOpen || participantsOpen) && (
            <div className="rim-conference__side">
              <ParticipantsPanel
                open={participantsOpen}
                onClose={() => setParticipantsOpen(false)}
                participants={remoteParticipants}
                programSlug={programSlug}
                sessionDate={sessionDate}
                localIdentity={localParticipant?.identity ?? ""}
                isCoHost={isCoHost}
                onMessageParticipant={(identity) => {
                  setChatRecipient(identity);
                  setParticipantsOpen(false);
                  setChatOpen(true);
                }}
              />
              {chatOpen && (
                <div className="rim-conference__chat">
                  <div className="rim-chat-header">
                    <span className="rim-chat-header__title">Chat</span>
                    <button
                      className="rim-chat-header__close"
                      onClick={() => setChatOpen(false)}
                      aria-label="Close chat"
                    >
                      ✕
                    </button>
                  </div>
                  <RIMChat
                    programSlug={programSlug}
                    sessionDate={sessionDate}
                    guestKey={guestKey}
                    recipient={chatRecipient}
                    onRecipientChange={setChatRecipient}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Zoom-aligned bottom control bar — every action button lives here.
            hasEndAllAuthority (capability) drives the End button label and
            the End-for-All option in EndMenu; isSessionHost is identity-only
            now and not consumed by the control bar. */}
        <RIMControlBar
          programSlug={programSlug}
          sessionDate={sessionDate}
          hasEndAllAuthority={hasEndAllAuthority}
          isCoHost={isCoHost}
          participantsOpen={participantsOpen}
          onToggleParticipants={() => setParticipantsOpen((v) => !v)}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen((v) => !v)}
          settingsOpen={settingsOpen}
          onToggleSettings={() => setSettingsOpen((v) => !v)}
          participantCount={remoteParticipants.length + 1}
          raisedHandCount={raisedHandCount}
          unreadChatCount={unreadChatCount}
          noiseFilterAvailable={nc.available}
          noiseFilterEnabled={nc.enabled}
          noiseFilterPending={nc.pending}
          onToggleNoiseFilter={nc.toggle}
        />

        {/* Ask-to-unmute prompt — a co-host invited this user to unmute.
            One dominant action; their own tap performs the unmute (we can
            never switch a mic on for someone). */}
        {unmuteAskFrom && (
          <div className="rim-unmute-prompt" role="dialog" aria-label="Invitation to unmute">
            <p className="rim-unmute-prompt__text">
              {unmuteAskFrom} is inviting you to unmute.
            </p>
            <div className="rim-unmute-prompt__actions">
              <button
                className="rim-unmute-prompt__yes"
                onClick={async () => {
                  try {
                    await roomCtx?.localParticipant.setMicrophoneEnabled(true);
                  } catch {
                    // Mic acquisition failed — leave them muted; the control
                    // bar button remains the retry path.
                  }
                  setUnmuteAskFrom(null);
                }}
              >
                Unmute
              </button>
              <button
                className="rim-unmute-prompt__no"
                onClick={() => setUnmuteAskFrom(null)}
              >
                Stay muted
              </button>
            </div>
          </div>
        )}

        {/* Audio playback prompt — Safari blocks audio until user interaction */}
        <AudioPlaybackPrompt />

        {/* Audio renderer — must be present for remote audio to play */}
        <RoomAudioRenderer />

        {/* Overlays */}
        <VideoSettingsPanel
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          localParticipant={localParticipant}
          avatarUrl={avatarUrl}
          onAvatarChange={setAvatarUrl}
        />
      </div>
    </LayoutContextProvider>
    </SessionRoleProvider>
  );
}

/**
 * AudioPlaybackPrompt — clear overlay when browser blocks audio.
 * Safari (and some other browsers) block audio playback until the user
 * explicitly interacts with the page. This replaces LiveKit's small
 * "Start Audio" button with a prominent, unmistakable prompt.
 */
function AudioPlaybackPrompt() {
  const { mergedProps, canPlayAudio } = useStartAudio({ props: {} });

  if (canPlayAudio) return null;

  return (
    <div className="rim-audio-prompt">
      <button {...mergedProps} className="rim-audio-prompt__btn">
        🔊 Tap to enable audio
      </button>
      <p className="rim-audio-prompt__hint">
        Your browser requires a tap before audio can play
      </p>
      <p className="rim-audio-prompt__hint">
        Headphones recommended — speakers can cause echo for others.
      </p>
    </div>
  );
}
