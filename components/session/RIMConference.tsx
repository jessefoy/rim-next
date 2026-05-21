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

import { useState, useEffect, useRef } from "react";
import {
  GridLayout,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  LayoutContextProvider,
  useCreateLayoutContext,
  useStartAudio,
  useRoomContext,
  FocusLayout,
  FocusLayoutContainer,
  CarouselLayout,
  useSpeakingParticipants,
} from "@livekit/components-react";
import { useKrispNoiseFilter } from "@livekit/components-react/krisp";
import { Track, RoomEvent, LocalAudioTrack } from "livekit-client";
import type { LocalTrackPublication } from "livekit-client";
import RIMParticipantTile from "./RIMParticipantTile";
import ParticipantsPanel from "./ParticipantsPanel";
import VideoSettingsPanel from "./VideoSettingsPanel";
import RIMControlBar from "./RIMControlBar";
import RIMChat from "./RIMChat";
import { SessionRoleProvider } from "./sessionRole";
import type { ParticipantMetadata } from "./RIMParticipantTile";

interface Props {
  isSessionHost: boolean;
  isCoHost: boolean;
  isProgramTeacher: boolean;
  programSlug: string;
  guestKey?: string;
  view?: "speaker" | "gallery";
  initialAvatarUrl: string | null;
}

function getMetadata(raw: string | undefined): ParticipantMetadata {
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

export default function RIMConference({ isSessionHost, isCoHost, isProgramTeacher, programSlug, guestKey, view = "gallery", initialAvatarUrl }: Props) {
  const { localParticipant } = useLocalParticipant();
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
    if (!needsAvatarUpdate && !needsHostUpdate && !needsTeacherUpdate && !needsCohostUpdate) return;
    const next: ParticipantMetadata = { ...meta };
    if (needsAvatarUpdate) next.avatarUrl = avatarUrl ?? undefined;
    if (needsHostUpdate) next.host = true;
    if (needsTeacherUpdate) next.teacher = true;
    if (needsCohostUpdate) next.cohost = true;
    localParticipant.setMetadata(JSON.stringify(next));
  }, [localParticipant, avatarUrl, isSessionHost, isProgramTeacher, isCoHost]);

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

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const speakers = useSpeakingParticipants();

  // Track the last identity we asked to pin, so the effect can short-circuit
  // before doing any work during the render-storm after a dispatch (the pin
  // state update would otherwise re-trigger this effect via fresh
  // `tracks` / `speakers` array identities on every render).
  const lastPinnedIdentityRef = useRef<string | null>(null);

  // Speaker / Gallery view orchestration:
  //  - speaker: ensure a pin exists (first active speaker, else first remote).
  //             Refresh pin to follow active speaker as they change.
  //  - gallery: clear any pin so the grid is the layout.
  useEffect(() => {
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

    const currentlyPinnedIdentity = layoutContext.pin.state?.[0]?.participant.identity;

    // If an active speaker already matches the current pin, nothing to do.
    if (activeSpeakerIdentity && activeSpeakerIdentity === currentlyPinnedIdentity) {
      lastPinnedIdentityRef.current = activeSpeakerIdentity;
      return;
    }

    // If the current pin is still present and no one else is speaking, keep it.
    if (
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
  }, [view, speakers, tracks, layoutContext.pin, localParticipant?.identity]);

  // Render speaker layout when view === speaker AND we have a pinned track.
  // Otherwise gallery.
  const inSpeakerView = view === "speaker" && !!layoutContext.pin.state && layoutContext.pin.state.length > 0;

  return (
    <SessionRoleProvider
      value={{
        isSessionHost,
        isCoHost,
        isProgramTeacher,
        programSlug,
        localIdentity: localParticipant?.identity ?? null,
      }}
    >
    <LayoutContextProvider value={layoutContext}>
      <div className={`rim-conference rim-conference--${view}`}>

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

        {/* Video grid + optional chat sidebar */}
        <div className="rim-conference__main">
          <div className="rim-conference__video">
            {inSpeakerView ? (
              <FocusLayoutContainer>
                <CarouselLayout tracks={tracks}>
                  <RIMParticipantTile />
                </CarouselLayout>
                <FocusLayout trackRef={layoutContext.pin.state![0]} />
              </FocusLayoutContainer>
            ) : (
              <GridLayout tracks={tracks}>
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
              <RIMChat programSlug={programSlug} guestKey={guestKey} />
            </div>
          )}
        </div>

        {/* Zoom-aligned bottom control bar — every action button lives here. */}
        <RIMControlBar
          programSlug={programSlug}
          isSessionHost={isSessionHost}
          isCoHost={isCoHost}
          participantsOpen={participantsOpen}
          onToggleParticipants={() => setParticipantsOpen((v) => !v)}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen((v) => !v)}
          settingsOpen={settingsOpen}
          onToggleSettings={() => setSettingsOpen((v) => !v)}
          onOpenSettings={() => setSettingsOpen(true)}
          participantCount={remoteParticipants.length + 1}
          raisedHandCount={raisedHandCount}
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
          localIdentity={localParticipant?.identity ?? ""}
          isCoHost={isCoHost}
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
