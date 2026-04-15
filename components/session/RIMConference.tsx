"use client";

/**
 * RIMConference — replaces LiveKit's pre-built <VideoConference />.
 *
 * Uses LiveKit primitives (GridLayout, ControlBar, RoomAudioRenderer) plus
 * our custom components:
 *   - RIMParticipantTile: avatar overlay + signal badges on each tile
 *   - NonverbalToolbar: ✋ ❤️ 🙏 ✓ ✗ signal buttons for all participants
 *   - ParticipantsPanel: host-only sidebar with per-participant mute + raised hand queue
 *   - VideoSettingsPanel: blur, brightness/contrast, avatar upload
 */

import { useState, useEffect } from "react";
import {
  GridLayout,
  ControlBar,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
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
  const remoteParticipants = useRemoteParticipants();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);

  // Raised hands count — shown on the Participants button badge
  const raisedHandCount = remoteParticipants.filter(
    (p) => getMetadata(p.metadata).signal === "hand"
  ).length;

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

  return (
    <div className="rim-conference">
      {/* Floating toolbar row above the LiveKit control bar */}
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
          className={`rim-conf-btn${settingsOpen ? " rim-conf-btn--active" : ""}`}
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label="Video settings"
        >
          ⚙ Settings
        </button>
      </div>

      {/* Video grid */}
      <div className="rim-conference__grid">
        <GridLayout tracks={tracks}>
          <RIMParticipantTile />
        </GridLayout>
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
  );
}
