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

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  useRoomInfo,
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
  // Host "Spotlight" — room-wide focus override (Zoom parity), distributed via
  // LiveKit room metadata so every client (incl. late-joiners) reflects it.
  // Read-only here; co-hosts set it through the server route below.
  const roomInfo = useRoomInfo();
  const spotlightedIdentity = useMemo(() => {
    try {
      const m = JSON.parse(roomInfo.metadata || "{}");
      return typeof m.spotlight === "string" && m.spotlight.length > 0 ? m.spotlight : null;
    } catch {
      return null;
    }
  }, [roomInfo.metadata]);
  const toggleSpotlight = useCallback(
    (identity: string) => {
      const next = spotlightedIdentity === identity ? null : identity;
      fetch("/api/livekit/spotlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programSlug, sessionDate, identity: next }),
      }).catch(() => {});
    },
    [spotlightedIdentity, programSlug, sessionDate],
  );

  // Auto-clear a spotlight whose target has left (Zoom parity). Co-hosts only
  // (the route gates it too), and only while fully connected so a transient
  // reconnect (a momentarily empty participant list) can't spuriously clear it.
  // Idempotent: a multi-co-host race just POSTs null twice.
  useEffect(() => {
    if (!isCoHost || !spotlightedIdentity) return;
    if (connectionState !== ConnectionState.Connected) return;
    const present =
      localParticipant?.identity === spotlightedIdentity ||
      remoteParticipants.some((p) => p.identity === spotlightedIdentity);
    if (present) return;
    fetch("/api/livekit/spotlight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programSlug, sessionDate, identity: null }),
    }).catch(() => {});
  }, [isCoHost, spotlightedIdentity, connectionState, localParticipant, remoteParticipants, programSlug, sessionDate]);
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

  // Focus target — computed SYNCHRONOUSLY from the live `tracks` each render, NOT
  // via LiveKit's deferred pin reducer. Precedence: manual pin (this viewer) >
  // active screen share > speaker-view active speaker > gallery (none). Deriving
  // focus straight off `tracks` is what makes a mid-session screen share engage
  // immediately — the old effect→dispatch→pin.state round-trip had a gap that
  // left receivers stuck in gallery until they refreshed — and keeps the rendered
  // ref LIVE so it carries freshly-subscribed remote media. No dispatch, no
  // reducer, so none of the prior #185 render-loop surface applies.
  const lastSpeakerFocusRef = useRef<string | null>(null);
  let focusTarget: (typeof tracks)[number] | null = null;
  if (pinnedIdentity) {
    // Manual pin (this viewer). If their camera is gone, focusTarget is null and
    // the effect below releases the stale pinnedIdentity (can't setState here).
    focusTarget =
      tracks.find(
        (t) => t.source === Track.Source.Camera && t.participant.identity === pinnedIdentity,
      ) ?? null;
  } else {
    const share = tracks.find((t) => t.source === Track.Source.ScreenShare && !!t.publication);
    if (share) {
      focusTarget = share;
    } else if (spotlightedIdentity) {
      // Host spotlight — forces everyone's stage onto the spotlighted person
      // (Zoom parity). A personal pin (above) and an active screen share still
      // win. If the spotlighted camera isn't present (camera off / left), fall
      // through to gallery rather than forcing an empty stage.
      focusTarget =
        tracks.find(
          (t) => t.source === Track.Source.Camera && t.participant.identity === spotlightedIdentity,
        ) ?? null;
    } else if (view === "speaker") {
      const cams = tracks.filter((t) => t.source === Track.Source.Camera);
      const activeId = speakers
        .map((sp) => sp.identity)
        .find((id) => cams.some((t) => t.participant.identity === id));
      if (activeId) {
        focusTarget = cams.find((t) => t.participant.identity === activeId) ?? null;
      } else {
        // No active speaker — keep the last focused speaker while present; else
        // first remote camera; else first camera.
        const keptId = lastSpeakerFocusRef.current;
        focusTarget =
          (keptId ? cams.find((t) => t.participant.identity === keptId) : undefined) ??
          cams.find((t) => t.participant.identity !== localParticipant?.identity) ??
          cams[0] ??
          null;
      }
      // Remember who we're focusing so silence keeps them (caching a derived
      // value in a ref across renders — read above, written here).
      if (focusTarget) lastSpeakerFocusRef.current = focusTarget.participant.identity;
    }
  }

  // Release a manual pin whose participant has left (can't setState during render).
  useEffect(() => {
    if (
      pinnedIdentity &&
      !tracks.some(
        (t) => t.source === Track.Source.Camera && t.participant.identity === pinnedIdentity,
      )
    ) {
      setPinnedIdentity(null);
    }
  }, [pinnedIdentity, tracks]);

  // Focus view whenever there's a focus target (computed synchronously above),
  // so it engages the same render a screen share appears — no deferred round-trip.
  const inFocusView = !!focusTarget;

  // Name of the manually pinned participant, for the pin banner.
  const pinnedName = pinnedIdentity
    ? (localParticipant?.identity === pinnedIdentity
        ? (localParticipant?.name || "you")
        : (() => {
            const p = remoteParticipants.find((rp) => rp.identity === pinnedIdentity);
            return p?.name || p?.identity || "participant";
          })())
    : "";

  // Name of the spotlighted participant, for the spotlight banner.
  const spotlightName = spotlightedIdentity
    ? (localParticipant?.identity === spotlightedIdentity
        ? (localParticipant?.name || "you")
        : (() => {
            const p = remoteParticipants.find((rp) => rp.identity === spotlightedIdentity);
            return p?.name || p?.identity || "participant";
          })())
    : "";
  // Whether the spotlighted participant is actually present — gates the banner so
  // it doesn't go stale (the auto-clear effect above also removes the orphaned
  // room-metadata shortly after they leave).
  const spotlightPresent =
    !!spotlightedIdentity &&
    (localParticipant?.identity === spotlightedIdentity ||
      remoteParticipants.some((p) => p.identity === spotlightedIdentity));

  // Filmstrip = camera tiles MINUS the focused camera (a focused camera would
  // otherwise render full-size in the stage AND again in the strip; a
  // screen-share focus excludes nothing, since sortedTracks is camera-only).
  // Memoized so the strip's array identity stays stable across renders (it
  // renders via TrackLoop), keyed on the focused camera's identity + trackSid.
  const focusIdentity = focusTarget?.participant.identity;
  const focusTrackSid = focusTarget?.publication?.trackSid;
  const hasFocus = !!focusTarget;
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
        spotlightedIdentity,
        onToggleSpotlight: toggleSpotlight,
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

        {/* Spotlight banner — room-wide host spotlight; everyone sees who's
            spotlighted. Hidden when this viewer has their own pin (their stage
            shows the pinned person, so the note would mislead). Co-hosts get Stop. */}
        {spotlightedIdentity && spotlightPresent && !pinnedIdentity && (
          <div className="rim-spotlight-banner">
            <span>🔦 Spotlighting {spotlightName} for everyone</span>
            {isCoHost && (
              <button
                className="rim-spotlight-banner__open"
                onClick={() => toggleSpotlight(spotlightedIdentity)}
              >
                Stop
              </button>
            )}
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
                  <FocusLayout trackRef={focusTarget!} />
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
