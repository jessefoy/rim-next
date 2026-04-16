"use client";

/**
 * RIMParticipantTile — wraps LiveKit's ParticipantTile with:
 * - Avatar image overlay shown when camera is off
 * - Nonverbal signal badge (hand, heart, namaste, yes, no) — reactively updated
 *
 * Participant comes from trackRef.participant, NOT from ParticipantContext.
 * GridLayout only provides TrackRefContext; it does NOT provide ParticipantContext.
 * Using useMaybeParticipantContext() here would always return null and fall
 * through to the early return, so avatars and signals would never render.
 *
 * useParticipantInfo({ participant }) subscribes to participantInfoObserver,
 * which fires on ParticipantEvent.ParticipantMetadataChanged — so signal badges
 * and the avatar re-render immediately when metadata changes (e.g., hand raise).
 *
 * The built-in FocusToggle (pin to speaker view) is part of LiveKit's default
 * ParticipantTile content and shows on hover automatically. No custom pin needed.
 */

import {
  ParticipantTile,
  useMaybeTrackRefContext,
  useParticipantInfo,
} from "@livekit/components-react";
import { Track } from "livekit-client";

export type Signal = "hand" | "heart" | "namaste" | "yes" | "no" | null;

export interface ParticipantMetadata {
  avatarUrl?: string;
  signal?: Signal;
}

const SIGNAL_EMOJI: Record<NonNullable<Signal>, string> = {
  hand: "✋",
  heart: "❤️",
  namaste: "🙏",
  yes: "✓",
  no: "✗",
};

function parseMetadata(raw: string | undefined): ParticipantMetadata {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export default function RIMParticipantTile() {
  const trackRef = useMaybeTrackRefContext();
  // Get participant directly from the track reference.
  // GridLayout provides TrackRefContext but NOT ParticipantContext,
  // so useMaybeParticipantContext() would always return null here.
  const participant = trackRef?.participant ?? undefined;

  // Reactive metadata: fires whenever this participant's metadata changes
  // (works for both local participant raising hand and remote participants)
  const { metadata: metadataRaw } = useParticipantInfo({ participant });

  if (!trackRef || !participant) {
    return (
      <div className="rim-tile-wrapper">
        <ParticipantTile />
      </div>
    );
  }

  const meta = parseMetadata(metadataRaw);

  // Camera is off when there's no publication (placeholder) or the track is muted
  const isVideoOff =
    trackRef.source === Track.Source.Camera &&
    (!trackRef.publication || trackRef.publication.isMuted);

  return (
    <div className="rim-tile-wrapper">
      {/* ParticipantTile renders video, name bar, speaking indicator, and
          the built-in hover-reveal FocusToggle (pin) button */}
      <ParticipantTile />
      {/* Avatar shown when camera is off — overlays the LiveKit placeholder */}
      {isVideoOff && meta.avatarUrl && (
        <div
          className="rim-tile-avatar"
          style={{ backgroundImage: `url(${meta.avatarUrl})` }}
          aria-hidden="true"
        />
      )}
      {/* Nonverbal signal badge */}
      {meta.signal && (
        <div className={`rim-tile-signal rim-tile-signal--${meta.signal}`}>
          {SIGNAL_EMOJI[meta.signal]}
        </div>
      )}
    </div>
  );
}
