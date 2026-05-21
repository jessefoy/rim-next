"use client";

/**
 * ParticipantsPanel — Zoom-aligned slide-in roster.
 *
 * Sticky local "Me" row at the top with a Host tag when applicable, then
 * remote participants below (raised hands float to top). Host tag is also
 * shown on remote rows whose token grants roomAdmin. Co-hosts see a Mute
 * button per row + Mute All in the footer. A search box appears when
 * participant count exceeds 10.
 *
 * Re-renders on TrackMuted / TrackUnmuted / TrackPublished / TrackUnpublished.
 * Uses `participant.isMicrophoneEnabled` (the canonical flag) for mic state.
 */

import { useEffect, useMemo, useState } from "react";
import type { RemoteParticipant } from "livekit-client";
import { RoomEvent } from "livekit-client";
import { useLocalParticipant, useParticipantInfo, useRoomContext } from "@livekit/components-react";
import type { Signal, ParticipantMetadata } from "./RIMParticipantTile";

const SIGNAL_EMOJI: Record<NonNullable<Signal>, string> = {
  hand: "✋",
  heart: "❤️",
  namaste: "🙏",
  yes: "✓",
  no: "✗",
};

const SEARCH_THRESHOLD = 10;

function getMetadata(p: { metadata?: string }): ParticipantMetadata {
  try { return JSON.parse(p.metadata || "{}"); } catch { return {}; }
}

/**
 * Renders the local participant's role pills from their LiveKit metadata.
 * Mirrors the remote tile pill logic: Host, Teacher, then Co-host (only
 * when neither of the others applies). Uses `useParticipantInfo` (not the
 * bare localParticipant.metadata field) so the component re-renders when
 * metadata changes — without this subscription, a Step-In reconnect that
 * updates flags mid-session would leave the local pills stale until the
 * panel was reopened.
 */
function LocalRolePills() {
  const { localParticipant } = useLocalParticipant();
  const info = useParticipantInfo({ participant: localParticipant });
  const meta: ParticipantMetadata = info.metadata
    ? getMetadata({ metadata: info.metadata })
    : {};
  return (
    <>
      {meta.host && (
        <span className="rim-pp__role-tag rim-pp__role-tag--host">Host</span>
      )}
      {meta.teacher && (
        <span className="rim-pp__role-tag rim-pp__role-tag--teacher">Teacher</span>
      )}
      {meta.cohost && !meta.host && !meta.teacher && (
        <span className="rim-pp__role-tag rim-pp__role-tag--cohost">Co-host</span>
      )}
    </>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  participants: RemoteParticipant[];
  programSlug: string;
  localIdentity: string;
  /** Co-host or higher: gates the per-row Mute and the Mute All footer. */
  isCoHost: boolean;
}

export default function ParticipantsPanel({ open, onClose, participants, programSlug, localIdentity, isCoHost }: Props) {
  const room = useRoomContext();
  const [muting, setMuting] = useState<Record<string, boolean>>({});
  const [mutingAll, setMutingAll] = useState(false);
  const [muteAllResult, setMuteAllResult] = useState<number | null>(null);
  const [search, setSearch] = useState("");
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

  // Sort + filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? participants.filter((p) => (p.name || p.identity).toLowerCase().includes(q))
      : participants;
    return [...list].sort((a, b) => {
      const aMeta = getMetadata(a);
      const bMeta = getMetadata(b);
      const aHand = aMeta.signal === "hand" ? 0 : 1;
      const bHand = bMeta.signal === "hand" ? 0 : 1;
      if (aHand !== bHand) return aHand - bHand;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [participants, search]);

  const handCount = participants.filter((p) => getMetadata(p).signal === "hand").length;
  const totalCount = participants.length + 1;
  const showSearch = totalCount > SEARCH_THRESHOLD;

  if (!open) return null;

  const localName = room?.localParticipant?.name || "You";

  return (
    <>
      <div className="rim-pp-backdrop" onClick={onClose} />
      <aside className="rim-pp">
        <div className="rim-pp__header">
          <span className="rim-pp__title">
            Participants ({totalCount})
            {handCount > 0 && <span className="rim-pp__hands"> · ✋ {handCount}</span>}
          </span>
          <button className="rim-pp__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {showSearch && (
          <div className="rim-pp__search">
            <input
              type="search"
              className="rim-pp__search-input"
              placeholder="Search participants"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        <div className="rim-pp__list">
          {/* Sticky local "Me" row. Role pills follow the same priority
              order as remote tiles: Host, Teacher, Co-host. We read the
              local participant's own metadata (set by RIMConference's
              seeding effect) so the local view matches what others see. */}
          <div className="rim-pp__row rim-pp__row--self">
            <span className="rim-pp__signal" />
            <span className="rim-pp__name">
              {localName} <span className="rim-pp__self-tag">(you)</span>
            </span>
            <LocalRolePills />
          </div>

          {filtered.length === 0 && (
            <p className="rim-pp__empty">
              {search ? "No participants match that search." : "No one else is here yet."}
            </p>
          )}

          {filtered.map((p) => {
            const meta = getMetadata(p);
            const isMicEnabled = p.isMicrophoneEnabled;
            return (
              <div key={p.identity} className="rim-pp__row">
                <span className="rim-pp__signal">
                  {meta.signal ? SIGNAL_EMOJI[meta.signal] : ""}
                </span>
                <span className="rim-pp__name">{p.name || p.identity}</span>
                {meta.host && (
                  <span className="rim-pp__role-tag rim-pp__role-tag--host">Host</span>
                )}
                {meta.teacher && (
                  <span className="rim-pp__role-tag rim-pp__role-tag--teacher">Teacher</span>
                )}
                {meta.cohost && !meta.host && !meta.teacher && (
                  <span className="rim-pp__role-tag rim-pp__role-tag--cohost">Co-host</span>
                )}
                <span
                  className={`rim-pp__mic${isMicEnabled ? "" : " rim-pp__mic--muted"}`}
                  title={isMicEnabled ? "Mic on" : "Muted"}
                >
                  {isMicEnabled ? "🎤" : "🔇"}
                </span>
                {isCoHost && (
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

        {isCoHost && participants.length > 0 && (
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
