"use client";

/**
 * RIMConference — Zoom-aligned LiveKit conference layout.
 *
 * Video grid (Gallery) or focus (Speaker) layout, with a raised-hand banner
 * across the top and the bottom Zoom-style control bar carrying every
 * action button. Participants / Chat / Settings open as overlays. The
 * nonverbal signal toolbar lives inside the Reactions menu in the control
 * bar (no longer a separate top toolbar).
 */

import { useState, useEffect } from "react";
import {
  GridLayout,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  LayoutContextProvider,
  useCreateLayoutContext,
  useStartAudio,
  FocusLayout,
  FocusLayoutContainer,
  CarouselLayout,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import RIMParticipantTile from "./RIMParticipantTile";
import ParticipantsPanel from "./ParticipantsPanel";
import VideoSettingsPanel from "./VideoSettingsPanel";
import RIMControlBar from "./RIMControlBar";
import RIMChat from "./RIMChat";
import type { ParticipantMetadata } from "./RIMParticipantTile";

interface Props {
  isHost: boolean;
  programSlug: string;
  guestKey?: string;
  initialAvatarUrl: string | null;
}

function getMetadata(raw: string | undefined): ParticipantMetadata {
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

export default function RIMConference({ isHost, programSlug, guestKey, initialAvatarUrl }: Props) {
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

  // Seed avatar into local participant metadata on connect
  useEffect(() => {
    if (!localParticipant) return;
    const meta = getMetadata(localParticipant.metadata);
    if (avatarUrl && meta.avatarUrl !== avatarUrl) {
      localParticipant.setMetadata(JSON.stringify({ ...meta, avatarUrl }));
    }
  }, [localParticipant, avatarUrl]);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  // Is a participant/track pinned (focus view active)?
  const hasPinnedTracks = layoutContext.pin.state && layoutContext.pin.state.length > 0;

  return (
    <LayoutContextProvider value={layoutContext}>
      <div className="rim-conference">

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
            {hasPinnedTracks ? (
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
          isHost={isHost}
          participantsOpen={participantsOpen}
          onToggleParticipants={() => setParticipantsOpen((v) => !v)}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen((v) => !v)}
          settingsOpen={settingsOpen}
          onToggleSettings={() => setSettingsOpen((v) => !v)}
          onOpenSettings={() => setSettingsOpen(true)}
          participantCount={remoteParticipants.length + 1}
          raisedHandCount={raisedHandCount}
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
          isHost={isHost}
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
