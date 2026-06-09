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
 * Krisp noise cancellation is enabled by default on every join via the
 * useKrispNoiseFilter hook from @livekit/components-react/krisp. Co-hosts
 * (teachers, host managers, the session host) see a "Bell mode" toggle in
 * the control bar that turns NC off so the full tone of bells, gongs, and
 * singing bowls passes through unfiltered. The state resets to NC-on at
 * every session join — Bell mode is a deliberate per-bell action, not a
 * preference that persists.
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
  FocusLayoutContainer,
  CarouselLayout,
  useSpeakingParticipants,
} from "@livekit/components-react";
import { useKrispNoiseFilter } from "@livekit/components-react/krisp";
import { Track, RoomEvent, LocalAudioTrack, DataPacket_Kind, ConnectionState } from "livekit-client";
import type { LocalTrackPublication } from "livekit-client";
import RIMParticipantTile from "./RIMParticipantTile";
import ParticipantsPanel from "./ParticipantsPanel";
import VideoSettingsPanel from "./VideoSettingsPanel";
import RIMControlBar from "./RIMControlBar";
import RIMChat, { CHAT_TOPIC } from "./RIMChat";
import { SessionRoleProvider } from "./sessionRole";
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
}

function getMetadata(raw: string | undefined): ParticipantMetadata {
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

export default function RIMConference({ isSessionHost, hasEndAllAuthority, isCoHost, isProgramTeacher, teacherLabel, programSlug, sessionDate, guestKey, view = "gallery", initialAvatarUrl }: Props) {
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

  // Krisp NC — enable by default on every join. Co-host UI exposes a
  // "Bell mode" toggle in the control bar that flips this off; the state
  // is component-local so it resets to ON whenever the conference mounts.
  //
  // `krisp.processor` is undefined until the WASM filter loads successfully.
  // On unsupported browsers (older Safari, some Firefox configs) the hook
  // logs a warn and never creates the processor — we use that as the
  // "Krisp actually available" signal to gate the Bell mode toggle, so
  // teachers on unsupported browsers don't see a button that would lie
  // about NC state.
  //
  // **Mic-track race.** In principle, calling `setNoiseFilterEnabled(true)`
  // before the mic publishes is safe — the hook's own attach effect re-runs
  // when the mic publication arrives. In practice we hit a case where the
  // processor was loaded but never attached, and the symptom was invisible
  // (no UI signal, no thrown error — the hook's Promise swallows). The
  // verification effect below subscribes to LocalTrackPublished, waits
  // 500ms after the mic publishes, reads `track.getProcessor()` directly,
  // and retries the enable if nothing is attached. Belt-and-suspenders for
  // the hook's happy-path assumption.
  //
  // Diagnostic logs (`[rim-krisp]` prefix) document the full lifecycle.
  // These are intentionally unconditional — they need to fire in production
  // (Vercel) for Jesse to verify Krisp on the deployed site via DevTools.
  // Remove once Krisp's runtime state is confirmed solid in real sessions.
  const krisp = useKrispNoiseFilter();
  const noiseFilterAvailable = krisp.processor !== undefined;
  const krispDefaultRef = useRef(false);
  const krispRef = useRef(krisp);
  useEffect(() => { krispRef.current = krisp; });

  // Initial enable — fires once on mount with explicit error handling.
  useEffect(() => {
    if (krispDefaultRef.current) return;
    krispDefaultRef.current = true;
    console.log("[rim-krisp] requesting initial enable");
    Promise.resolve(krisp.setNoiseFilterEnabled(true))
      .then(() => {
        console.log("[rim-krisp] initial enable returned");
      })
      .catch((err) => {
        console.error("[rim-krisp] initial enable failed:", err);
      });
  }, [krisp]);

  // State diagnostic — logs whenever the hook's reported state transitions
  // (WASM loaded, enable flipped, pending true/false). Filter the console
  // by `[rim-krisp]` to see the full timeline.
  useEffect(() => {
    console.log("[rim-krisp] state:", {
      processorReady: !!krisp.processor,
      enabled: krisp.isNoiseFilterEnabled,
      pending: krisp.isNoiseFilterPending,
    });
  }, [krisp.processor, krisp.isNoiseFilterEnabled, krisp.isNoiseFilterPending]);

  // Mic-track attach verification — when the local mic actually publishes,
  // give the hook ~500ms to attach its processor, then read
  // `track.getProcessor()` directly to verify. Catches the race where the
  // initial setNoiseFilterEnabled landed before the mic existed and the
  // hook's internal effect didn't re-fire correctly. One retry on miss.
  // krispRef keeps the closure pointed at the current hook return without
  // re-subscribing the room event listener on every render.
  const roomCtx = useRoomContext();
  useEffect(() => {
    if (!roomCtx) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    function onLocalTrackPublished(pub: LocalTrackPublication) {
      if (pub.source !== Track.Source.Microphone) return;
      console.log("[rim-krisp] local mic published, scheduling 500ms attach verify");
      const t = setTimeout(() => {
        const track = pub.track;
        const k = krispRef.current;
        if (!(track instanceof LocalAudioTrack)) {
          console.warn("[rim-krisp] verify: mic track is not LocalAudioTrack");
          return;
        }
        const proc = track.getProcessor();
        const attached = proc?.name === "livekit-noise-filter";
        console.log("[rim-krisp] verify (500ms after publish):", {
          processorName: proc?.name ?? "(none)",
          attached,
          krispProcessorReady: !!k.processor,
          krispEnabled: k.isNoiseFilterEnabled,
          krispPending: k.isNoiseFilterPending,
        });
        // Gate retry on "not currently enabled or pending" — a republish
        // (mute → unmute → publish) re-fires this effect and we don't want
        // to spam setNoiseFilterEnabled when the hook is already actively
        // managing the attach.
        if (!attached && k.processor && !k.isNoiseFilterEnabled && !k.isNoiseFilterPending) {
          console.warn("[rim-krisp] verify: WASM loaded but NOT attached to mic — retrying enable");
          Promise.resolve(k.setNoiseFilterEnabled(true))
            .then(() => console.log("[rim-krisp] retry enable returned"))
            .catch((err) => console.error("[rim-krisp] retry enable failed:", err));
        }
      }, 500);
      timers.push(t);
    }
    roomCtx.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
    return () => {
      timers.forEach(clearTimeout);
      roomCtx.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
    };
  }, [roomCtx]);

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

  // Track the last identity we asked to pin, so the effect can short-circuit
  // before doing any work during the render-storm after a dispatch (the pin
  // state update would otherwise re-trigger this effect via fresh
  // `tracks` / `speakers` array identities on every render).
  const lastPinnedIdentityRef = useRef<string | null>(null);

  // Pin orchestration:
  //  - manual pin (this viewer): always wins. Pin that participant and stop
  //    following the active speaker. Re-pins on camera on/off (placeholder ↔
  //    real track) and releases if they leave.
  //  - speaker: ensure a pin exists (first active speaker, else first remote),
  //    following the active speaker as it changes.
  //  - gallery: clear any pin so the grid is the layout.
  useEffect(() => {
    // Manual pin takes precedence over view + active-speaker follow.
    if (pinnedIdentity) {
      const target = tracks.find(
        (t) => t.source === Track.Source.Camera && t.participant.identity === pinnedIdentity,
      );
      if (!target) {
        // Pinned participant left the room — release the pin gracefully.
        if (layoutContext.pin.state && layoutContext.pin.state.length > 0) {
          layoutContext.pin.dispatch?.({ msg: "clear_pin" });
        }
        lastPinnedIdentityRef.current = null;
        setPinnedIdentity(null);
        return;
      }
      // Re-dispatch only when the pinned track ref differs (identity changed,
      // or the same person's camera toggled placeholder ↔ real track). Comparing
      // the publication sid converges in one extra render instead of looping.
      const pinnedRef = layoutContext.pin.state?.[0];
      const samePin =
        !!pinnedRef &&
        pinnedRef.participant.identity === pinnedIdentity &&
        pinnedRef.publication?.trackSid === target.publication?.trackSid;
      if (!samePin) {
        lastPinnedIdentityRef.current = pinnedIdentity;
        layoutContext.pin.dispatch?.({ msg: "set_pin", trackReference: target });
      }
      return;
    }

    // Active screen share auto-focuses (Zoom-style), overriding gallery/speaker
    // — but not a manual pin (handled above). Everyone with no manual pin sees
    // the share fill the main view; camera tiles drop to the filmstrip.
    const shareTrack = tracks.find(
      (t) => t.source === Track.Source.ScreenShare && !!t.publication,
    );
    if (shareTrack) {
      const pinnedRef = layoutContext.pin.state?.[0];
      const sameShare =
        !!pinnedRef &&
        pinnedRef.source === Track.Source.ScreenShare &&
        pinnedRef.publication?.trackSid === shareTrack.publication?.trackSid;
      if (!sameShare) {
        lastPinnedIdentityRef.current = shareTrack.participant.identity;
        layoutContext.pin.dispatch?.({ msg: "set_pin", trackReference: shareTrack });
      }
      return;
    }

    if (view === "gallery") {
      if (layoutContext.pin.state && layoutContext.pin.state.length > 0) {
        layoutContext.pin.dispatch?.({ msg: "clear_pin" });
        lastPinnedIdentityRef.current = null;
      }
      return;
    }
    // Speaker view — pick the target identity first; only filter tracks if we
    // actually need to dispatch a change. This keeps the per-render cost cheap.
    const activeSpeakerIdentity = speakers
      .map((sp) => sp.identity)
      .find((id) =>
        tracks.some(
          (t) => t.source === Track.Source.Camera && t.participant.identity === id,
        ),
      );

    const currentPinnedRef = layoutContext.pin.state?.[0];
    const currentlyPinnedIdentity = currentPinnedRef?.participant.identity;
    // Only "keep" the current pin if it's actually a camera track. When a
    // screen share stops in speaker view, the pin still holds the (now-dead)
    // ScreenShare ref for the sharer's identity; without this guard the
    // identity-only checks below would keep it and focus a blank tile. Treating
    // a non-camera pin as "not keepable" forces a re-pin to a camera track.
    const currentPinIsCamera = currentPinnedRef?.source === Track.Source.Camera;

    // If an active speaker already matches the current camera pin, nothing to do.
    if (currentPinIsCamera && activeSpeakerIdentity && activeSpeakerIdentity === currentlyPinnedIdentity) {
      lastPinnedIdentityRef.current = activeSpeakerIdentity;
      return;
    }

    // If the current camera pin is still present and no one else is speaking, keep it.
    if (
      currentPinIsCamera &&
      currentlyPinnedIdentity &&
      tracks.some(
        (t) => t.source === Track.Source.Camera && t.participant.identity === currentlyPinnedIdentity,
      ) &&
      !activeSpeakerIdentity
    ) {
      lastPinnedIdentityRef.current = currentlyPinnedIdentity;
      return;
    }

    // Need to (re)pin. Pick the active speaker; else a remote camera; else first.
    const cameraTracks = tracks.filter((t) => t.source === Track.Source.Camera);
    if (cameraTracks.length === 0) return;
    const nextTrack =
      (activeSpeakerIdentity &&
        cameraTracks.find((t) => t.participant.identity === activeSpeakerIdentity)) ||
      cameraTracks.find((t) => t.participant.identity !== localParticipant?.identity) ||
      cameraTracks[0];
    if (!nextTrack) return;

    // Guard against re-dispatch loops while the pin state catches up to us.
    if (lastPinnedIdentityRef.current === nextTrack.participant.identity && currentlyPinnedIdentity === nextTrack.participant.identity) {
      return;
    }
    lastPinnedIdentityRef.current = nextTrack.participant.identity;
    layoutContext.pin.dispatch?.({ msg: "set_pin", trackReference: nextTrack });
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
  const carouselTracks = focusTrackRef
    ? sortedTracks.filter(
        (t) =>
          !(
            t.participant.identity === focusTrackRef.participant.identity &&
            t.publication?.trackSid === focusTrackRef.publication?.trackSid
          ),
      )
    : sortedTracks;

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
              <FocusLayoutContainer>
                <CarouselLayout tracks={carouselTracks}>
                  <RIMParticipantTile />
                </CarouselLayout>
                <FocusLayout trackRef={layoutContext.pin.state![0]} />
              </FocusLayoutContainer>
            ) : (
              <GridLayout tracks={sortedTracks}>
                <RIMParticipantTile />
              </GridLayout>
            )}
          </div>

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
          noiseFilterAvailable={noiseFilterAvailable}
          noiseFilterEnabled={krisp.isNoiseFilterEnabled}
          noiseFilterPending={krisp.isNoiseFilterPending}
          onToggleNoiseFilter={() => krisp.setNoiseFilterEnabled(!krisp.isNoiseFilterEnabled)}
        />

        {/* Audio playback prompt — Safari blocks audio until user interaction */}
        <AudioPlaybackPrompt />

        {/* Audio renderer — must be present for remote audio to play */}
        <RoomAudioRenderer />

        {/* Overlays */}
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
