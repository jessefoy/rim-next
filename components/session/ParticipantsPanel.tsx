"use client";

/**
 * ParticipantsPanel — host-only slide-in sidebar.
 *
 * Shows all remote participants with:
 * - Their display name + signal badge
 * - Raised hands surfaced at the top
 * - Individual mute button per participant
 *
 * Calls POST /api/livekit/mute-participant for each mute action (server-side).
 */

import { useState } from "react";
import type { RemoteParticipant } from "livekit-client";
import type { Signal } from "./RIMParticipantTile";
import type { ParticipantMetadata } from "./RIMParticipantTile";

const SIGNAL_EMOJI: Record<NonNullable<Signal>, string> = {
  hand: "✋",
  heart: "❤️",
  namaste: "🙏",
  yes: "✓",
  no: "✗",
};

function getMetadata(p: RemoteParticipant): ParticipantMetadata {
  try { return JSON.parse(p.metadata || "{}"); } catch { return {}; }
}

interface Props {
  open: boolean;
  onClose: () => void;
  participants: RemoteParticipant[];
  programSlug: string;
  localIdentity: string;
}

export default function ParticipantsPanel({ open, onClose, participants, programSlug, localIdentity }: Props) {
  const [muting, setMuting] = useState<Record<string, boolean>>({});

  if (!open) return null;

  async function muteParticipant(identity: string) {
    setMuting((prev) => ({ ...prev, [identity]: true }));
    try {
      await fetch("/api/livekit/mute-participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programSlug, participantIdentity: identity }),
      });
    } catch {}
    setMuting((prev) => ({ ...prev, [identity]: false }));
  }

  // Sort: raised hands first, then alphabetical
  const sorted = [...participants].sort((a, b) => {
    const aMeta = getMetadata(a);
    const bMeta = getMetadata(b);
    const aHand = aMeta.signal === "hand" ? 0 : 1;
    const bHand = bMeta.signal === "hand" ? 0 : 1;
    if (aHand !== bHand) return aHand - bHand;
    return (a.name || "").localeCompare(b.name || "");
  });

  // Count raised hands for the header
  const handCount = participants.filter((p) => getMetadata(p).signal === "hand").length;

  return (
    <>
      <div className="rim-pp-backdrop" onClick={onClose} />
      <aside className="rim-pp">
        <div className="rim-pp__header">
          <span className="rim-pp__title">
            Participants ({participants.length})
            {handCount > 0 && <span className="rim-pp__hands"> · ✋ {handCount}</span>}
          </span>
          <button className="rim-pp__close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="rim-pp__list">
          {sorted.length === 0 && (
            <p className="rim-pp__empty">No other participants yet.</p>
          )}
          {sorted.map((p) => {
            const meta = getMetadata(p);
            const isAudioMuted = [...(p.audioTrackPublications?.values() ?? [])].every(
              (pub) => pub.isMuted || !pub.track
            );
            return (
              <div key={p.identity} className="rim-pp__row">
                <span className="rim-pp__signal">
                  {meta.signal ? SIGNAL_EMOJI[meta.signal] : ""}
                </span>
                <span className="rim-pp__name">{p.name || p.identity}</span>
                <span className={`rim-pp__mic${isAudioMuted ? " rim-pp__mic--muted" : ""}`}>
                  {isAudioMuted ? "🔇" : "🎤"}
                </span>
                {!isAudioMuted && (
                  <button
                    className="rim-pp__mute-btn"
                    onClick={() => muteParticipant(p.identity)}
                    disabled={muting[p.identity]}
                    title={`Mute ${p.name || p.identity}`}
                  >
                    {muting[p.identity] ? "…" : "Mute"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
