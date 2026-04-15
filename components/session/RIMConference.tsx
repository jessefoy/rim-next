"use client";

/**
 * RIMConference — custom LiveKit conference layout.
 *
 * - Participant tiles with avatar overlays + signal badges (via RIMParticipantTile)
 * - Nonverbal toolbar: ✋ ❤️ 🙏 ✓ ✗ for all participants
 * - Focus/pin layout: hover a tile and click the pin icon to promote one speaker
 * - Chat sidebar: all participants can chat
 * - Raised-hand banner: floating indicator at the top of the video area
 * - Host-only: Participants panel with per-participant mute + raised hand queue
 * - Video settings: blur, brightness/contrast preview, avatar upload
 */

import { useState, useEffect } from "react";
import {
  GridLayout,
  ControlBar,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  LayoutContextProvider,
  useCreateLayoutContext,
  Chat,
  FocusLayout,
  FocusLayoutContainer,
  CarouselLayout,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import RIMParticipantTile from "./RIMParticipantTile";
import NonverbalToolbar from "./NonverbalToolbar";
import ParticipantsPanel from "./ParticipantsPanel";
import VideoSettingsPanel from "./VideoSettingsPanel";
import type { ParticipantMetadata } from "./RIMParticipantTile";

interface Props {
  isHost: boolean;
  programSlug: string;
  initialAvatarUrl: string | null;
}

function getMetadata(raw: string | undefined): ParticipantMetadata {
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

export default function RIMConference({ isHost, programSlug, initialAvatarUrl }: Props) {
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

        {/* Toolbar row — dark, above the video grid */}
        <div className="rim-conference__toolbar">
          {isHost && (
            <button
              className={`rim-conf-btn${participantsOpen ? " rim-conf-btn--active" : ""}`}
              onClick={() => setParticipantsOpen((v) => !v)}
            >
              👥 Participants
              {raisedHandCount > 0 && (
                <span className="rim-conf-btn__badge">{raisedHandCount}</span>
              )}
            </button>
          )}
          <NonverbalToolbar localParticipant={localParticipant} />
          <button
            className={`rim-conf-btn${chatOpen ? " rim-conf-btn--active" : ""}`}
            onClick={() => setChatOpen((v) => !v)}
            aria-label="Toggle chat"
          >
            💬 Chat
          </button>
          <button
            className={`rim-conf-btn${settingsOpen ? " rim-conf-btn--active" : ""}`}
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="Video settings"
          >
            ⚙ Settings
          </button>
        </div>

        {/* Raised-hand banner — at-a-glance, visible without opening the panel */}
        {raisedHandCount > 0 && (
          <div className="rim-hand-banner">
            <span>
              ✋{" "}
              {raisedHandCount === 1
                ? `${raisedHands[0].name || raisedHands[0].identity} raised their hand`
                : `${raisedHandCount} people raised their hand`}
            </span>
            {isHost && !participantsOpen && (
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
              <Chat />
            </div>
          )}
        </div>

        {/* LiveKit control bar (mic, cam, screen share, leave) */}
        <ControlBar />

        {/* Audio renderer — must be present for remote audio to play */}
        <RoomAudioRenderer />

        {/* Overlays */}
        {isHost && (
          <ParticipantsPanel
            open={participantsOpen}
            onClose={() => setParticipantsOpen(false)}
            participants={remoteParticipants}
            programSlug={programSlug}
            localIdentity={localParticipant?.identity ?? ""}
          />
        )}
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
