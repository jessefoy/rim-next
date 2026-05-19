"use client";

/**
 * ParticipantsPanel — slide-in roster.
 *
 * Hosts see name + signal + mic state + a "Mute" button per participant.
 * Non-hosts see the same list without the mute controls — so everyone can
 * tell who's in the room.
 *
 * Re-renders on TrackMuted / TrackUnmuted / TrackPublished / TrackUnpublished
 * because `useRemoteParticipants()` in the parent is configured with
 * the corresponding RoomEvents. We read `isMicrophoneEnabled` directly
 * off the Participant — that's the canonical flag and avoids the
 * `[].every()` race that hid the Mute button on fresh joins.
 */

import { useEffect, useState } from "react";
import type { RemoteParticipant } from "livekit-client";
import { RoomEvent } from "livekit-client";
import { useRoomContext } from "@livekit/components-react";
import type { Signal, ParticipantMetadata } from "./RIMParticipantTile";

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
  isHost: boolean;
}

export default function ParticipantsPanel({ open, onClose, participants, programSlug, localIdentity, isHost }: Props) {
  const room = useRoomContext();
  const [muting, setMuting] = useState<Record<string, boolean>>({});
  const [mutingAll, setMutingAll] = useState(false);
  const [muteAllResult, setMuteAllResult] = useState<number | null>(null);
  // Tick to force re-render when remote participants' mic state changes,
  // since RemoteParticipant prop identity doesn't change on toggle.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!room) return;
    const update = () => setTick((n) => n + 1);
    room.on(RoomEvent.TrackMuted, update);
    room.on(RoomEvent.TrackUnmuted, update);
    room.on(RoomEvent.TrackPublished, update);
    room.on(RoomEvent.TrackUnpublished, update);
    return () => {
      room.off(RoomEvent.TrackMuted, update);
      room.off(RoomEvent.TrackUnmuted, update);
      room.off(RoomEvent.TrackPublished, update);
      room.off(RoomEvent.TrackUnpublished, update);
    };
  }, [room]);

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

  async function muteAll() {
    setMutingAll(true);
    setMuteAllResult(null);
    try {
      const res = await fetch("/api/livekit/mute-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programSlug }),
      });
      if (res.ok) {
        const data = await res.json();
        setMuteAllResult(typeof data.muted === "number" ? data.muted : 0);
        setTimeout(() => setMuteAllResult(null), 3000);
      }
    } catch {}
    setMutingAll(false);
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
            Participants ({participants.length + 1})
            {handCount > 0 && <span className="rim-pp__hands"> · ✋ {handCount}</span>}
          </span>
          <button className="rim-pp__close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="rim-pp__list">
          {/* Local participant row — clarifies that the count includes "you" */}
          <div className="rim-pp__row rim-pp__row--self">
            <span className="rim-pp__signal" />
            <span className="rim-pp__name">{(room?.localParticipant?.name) || "You"} (you)</span>
          </div>
          {sorted.length === 0 && (
            <p className="rim-pp__empty">No one else is here yet.</p>
          )}
          {sorted.map((p) => {
            const meta = getMetadata(p);
            const isMicEnabled = p.isMicrophoneEnabled;
            return (
              <div key={p.identity} className="rim-pp__row">
                <span className="rim-pp__signal">
                  {meta.signal ? SIGNAL_EMOJI[meta.signal] : ""}
                </span>
                <span className="rim-pp__name">{p.name || p.identity}</span>
                <span
                  className={`rim-pp__mic${isMicEnabled ? "" : " rim-pp__mic--muted"}`}
                  title={isMicEnabled ? "Mic on" : "Muted"}
                >
                  {isMicEnabled ? "🎤" : "🔇"}
                </span>
                {isHost && (
                  isMicEnabled ? (
                    <button
                      className="rim-pp__mute-btn"
                      onClick={() => muteParticipant(p.identity)}
                      disabled={muting[p.identity]}
                      title={`Mute ${p.name || p.identity}`}
                    >
                      {muting[p.identity] ? "…" : "Mute"}
                    </button>
                  ) : (
                    <span className="rim-pp__muted-pill">Muted</span>
                  )
                )}
              </div>
            );
          })}
        </div>
        {isHost && participants.length > 0 && (
          <div className="rim-pp__footer">
            <button
              type="button"
              className="rim-pp__mute-all"
              onClick={muteAll}
              disabled={mutingAll}
            >
              {mutingAll
                ? "Muting…"
                : muteAllResult !== null
                ? `Muted ${muteAllResult}`
                : "Mute All"}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
