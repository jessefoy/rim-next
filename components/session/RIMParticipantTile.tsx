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
import { useState } from "react";
import { useSessionRole } from "./sessionRole";

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
  const sessionRole = useSessionRole();
  const [muting, setMuting] = useState(false);

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

  // Hover-mute affordance: visible only to Co-hosts on remote tiles. We
  // require localIdentity to be bound before showing the action — without
  // it we can't reliably tell whether this tile is the local participant,
  // and a brief render window could otherwise expose a self-mute button.
  const localIdentity = sessionRole?.localIdentity;
  const participantIdentity = participant.identity;
  const isLocal = !!localIdentity && localIdentity === participantIdentity;
  const showMuteAction = !!sessionRole?.isCoHost && !!localIdentity && !isLocal;

  async function handleMute() {
    if (!sessionRole) return;
    setMuting(true);
    try {
      await fetch("/api/livekit/mute-participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programSlug: sessionRole.programSlug,
          participantIdentity,
        }),
      });
    } catch {}
    setMuting(false);
  }

  const wrapperClass = [
    "rim-tile-wrapper",
    isVideoOff ? "rim-tile-wrapper--no-video" : "",
    showAvatar ? "rim-tile-wrapper--avatar" : "",
    isSpeaking ? "rim-tile-wrapper--speaking" : "",
    showMuteAction ? "rim-tile-wrapper--has-actions" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={wrapperClass}>
      <ParticipantTile />
      {showMuteAction && (
        isMicMuted ? (
          <span className="rim-tile-muted-pill" aria-hidden="true">Muted</span>
        ) : (
          <button
            type="button"
            className="rim-tile-mute"
            onClick={handleMute}
            disabled={muting}
            title={`Mute ${displayName}`}
            aria-label={`Mute ${displayName}`}
          >
            {muting ? "…" : "Mute"}
          </button>
        )
      )}
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
      {/* Zoom-style name bar — plain white text bottom-left, with a
          small red mic-off glyph only when the participant is muted. */}
      <div className="rim-tile-nameplate">
        {isMicMuted && (
          <span className="rim-tile-nameplate__mic-off" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="2" y1="2" x2="22" y2="22" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
              <path d="M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
            </svg>
          </span>
        )}
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
