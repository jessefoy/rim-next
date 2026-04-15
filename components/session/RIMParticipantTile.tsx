"use client";

/**
 * RIMParticipantTile — wraps LiveKit's ParticipantTile with:
 * - Avatar image overlay shown when camera is off
 * - Nonverbal signal badge (hand, heart, namaste, yes, no) — reactive via useParticipantInfo
 * - Pin button (FocusToggle) shown on hover — promotes participant to focus layout
 *
 * Must be rendered as a child of GridLayout or CarouselLayout
 * (provides TrackRefContext + ParticipantContext).
 */

import {
  ParticipantTile,
  useMaybeTrackRefContext,
  useMaybeParticipantContext,
  useParticipantInfo,
  FocusToggle,
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
  const participant = useMaybeParticipantContext();
  // useParticipantInfo subscribes to participantInfoObserver — re-renders when metadata changes
  const { metadata: metadataRaw } = useParticipantInfo();

  if (!trackRef || !participant) {
    return (
      <div className="rim-tile-wrapper">
        <ParticipantTile />
      </div>
    );
  }

  const meta = parseMetadata(metadataRaw);

  // Camera is off if there's no publication or the track is muted
  const isVideoOff =
    trackRef.source === Track.Source.Camera &&
    (!trackRef.publication || trackRef.publication.isMuted);

  return (
    <div className="rim-tile-wrapper">
      <ParticipantTile />
      {/* Avatar shown when camera off */}
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
      {/* Pin button — hover to reveal, click to enter focus/speaker view */}
      <FocusToggle trackRef={trackRef} className="rim-tile-pin" />
    </div>
  );
}
