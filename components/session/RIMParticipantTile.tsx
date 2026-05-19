"use client";

/**
 * RIMParticipantTile — Zoom-aligned tile.
 *
 * Custom name bar (bottom-left, dark, mic icon + name), avatar overlay when
 * camera off, active-speaker yellow border, nonverbal signal badge top-left.
 * Replaces LiveKit's default participant metadata bar.
 *
 * Participant comes from trackRef.participant (GridLayout provides
 * TrackRefContext, not ParticipantContext).
 *
 * useParticipantInfo subscribes to metadata changes for live signal badge
 * updates; useIsSpeaking gives the active-speaker border.
 */

import {
  ParticipantTile,
  useMaybeTrackRefContext,
  useParticipantInfo,
  useIsSpeaking,
} from "@livekit/components-react";
import { Track } from "livekit-client";

export type Signal = "hand" | "heart" | "namaste" | "yes" | "no" | null;

export interface ParticipantMetadata {
  avatarUrl?: string;
  signal?: Signal;
  /** Marker placed in the token metadata for participants granted host privileges. */
  host?: boolean;
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

/** First letter of first + last name token, uppercased. Falls back to "?". */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0][0] || "?").toUpperCase();
  return ((parts[0][0] || "") + (parts[parts.length - 1][0] || "")).toUpperCase();
}

/** Deterministic muted color from a small palette, hashed by identity. */
const INITIALS_PALETTE = [
  "#6b8794", // steel blue
  "#8b7355", // warm brown
  "#7b8d6f", // sage
  "#736987", // lavender
  "#996d6d", // muted brick
  "#878072", // taupe
];
function colorForIdentity(identity: string): string {
  let h = 0;
  for (let i = 0; i < identity.length; i++) {
    h = (h * 31 + identity.charCodeAt(i)) >>> 0;
  }
  return INITIALS_PALETTE[h % INITIALS_PALETTE.length];
}

export default function RIMParticipantTile() {
  const trackRef = useMaybeTrackRefContext();
  const participant = trackRef?.participant ?? undefined;
  const { metadata: metadataRaw } = useParticipantInfo({ participant });
  const isSpeaking = useIsSpeaking(participant);

  if (!trackRef || !participant) {
    return (
      <div className="rim-tile-wrapper">
        <ParticipantTile />
      </div>
    );
  }

  const meta = parseMetadata(metadataRaw);
  const displayName = participant.name || participant.identity;

  const isVideoOff =
    trackRef.source === Track.Source.Camera &&
    (!trackRef.publication || trackRef.publication.isMuted);

  const showAvatar = isVideoOff && !!meta.avatarUrl;
  const showInitials = isVideoOff && !meta.avatarUrl;
  const isMicMuted = !participant.isMicrophoneEnabled;

  const wrapperClass = [
    "rim-tile-wrapper",
    isVideoOff ? "rim-tile-wrapper--no-video" : "",
    showAvatar ? "rim-tile-wrapper--avatar" : "",
    isSpeaking ? "rim-tile-wrapper--speaking" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={wrapperClass}>
      <ParticipantTile />
      {showAvatar && (
        <div
          className="rim-tile-avatar"
          style={{ backgroundImage: `url(${meta.avatarUrl})` }}
          aria-hidden="true"
        />
      )}
      {showInitials && (
        <div
          className="rim-tile-initials"
          style={{ backgroundColor: colorForIdentity(participant.identity) }}
          aria-hidden="true"
        >
          {getInitials(displayName)}
        </div>
      )}
      {/* Custom Zoom-style name bar — bottom-left, mic icon + name */}
      <div className="rim-tile-nameplate">
        <span className={`rim-tile-nameplate__mic${isMicMuted ? " rim-tile-nameplate__mic--muted" : ""}`} aria-hidden="true">
          {isMicMuted ? "🔇" : "🎤"}
        </span>
        <span className="rim-tile-nameplate__name">{displayName}</span>
        {meta.host && <span className="rim-tile-nameplate__host-tag">Host</span>}
      </div>
      {/* Nonverbal signal badge */}
      {meta.signal && (
        <div className={`rim-tile-signal rim-tile-signal--${meta.signal}`}>
          {SIGNAL_EMOJI[meta.signal]}
        </div>
      )}
    </div>
  );
}
