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
 * Subscribes to the local participant's metadata reactively. Used by the
 * panel to keep the local "Me" row in sync with role pills AND raised-hand
 * state — without this, a Step-In reconnect or a raise/lower from the
 * Reactions menu would leave the local row stale until the panel was
 * reopened. Returns the parsed metadata once, so callers can read every
 * field (signal, raisedHandAt, role flags) without re-subscribing.
 */
function useLocalMetadata(): ParticipantMetadata {
  const { localParticipant } = useLocalParticipant();
  const info = useParticipantInfo({ participant: localParticipant });
  return info.metadata ? getMetadata({ metadata: info.metadata }) : {};
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

  const localMeta = useLocalMetadata();
  const localId = room?.localParticipant?.identity ?? localIdentity;

  // Sort + filter remotes. Hand-raised participants float to the top in
  // raise order (ascending raisedHandAt) — same ordering rule the grid
  // uses, so the panel and the tile layout tell the same story.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? participants.filter((p) => (p.name || p.identity).toLowerCase().includes(q))
      : participants;
    return [...list].sort((a, b) => {
      const aMeta = getMetadata(a);
      const bMeta = getMetadata(b);
      const aHand = aMeta.signal === "hand";
      const bHand = bMeta.signal === "hand";
      if (aHand && !bHand) return -1;
      if (bHand && !aHand) return 1;
      if (aHand && bHand) {
        const at = (aMeta.raisedHandAt ?? 0) - (bMeta.raisedHandAt ?? 0);
        if (at !== 0) return at;
        // Secondary sort by identity — matches RIMConference.sortedTracks
        // so the panel order agrees with the grid order on every client
        // even when two hands go up in the same millisecond.
        return a.identity.localeCompare(b.identity);
      }
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [participants, search]);

  // Numbered speaking queue — a 1-based position for every raised hand,
  // computed across local + remote participants and ordered by
  // raisedHandAt. The identity → number map drives the small "1 ✋",
  // "2 ✋" prefix shown next to each hand-raised row, so the host can
  // call on people in order without parsing timestamps. Single source of
  // truth: same sort the grid uses (see RIMConference.sortedTracks).
  const queueMap = useMemo(() => {
    const queue: { identity: string; at: number }[] = [];
    if (localId && localMeta.signal === "hand") {
      queue.push({ identity: localId, at: localMeta.raisedHandAt ?? 0 });
    }
    for (const p of participants) {
      const m = getMetadata(p);
      if (m.signal === "hand") {
        queue.push({ identity: p.identity, at: m.raisedHandAt ?? 0 });
      }
    }
    queue.sort((a, b) => {
      if (a.at !== b.at) return a.at - b.at;
      // Tie-break on identity so every client computes the same queue
      // numbers when two people raise within the same millisecond.
      return a.identity.localeCompare(b.identity);
    });
    const map = new Map<string, number>();
    queue.forEach((entry, i) => map.set(entry.identity, i + 1));
    return map;
  }, [participants, localId, localMeta.signal, localMeta.raisedHandAt]);

  const handCount = queueMap.size;
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
              seeding effect) so the local view matches what others see.
              The signal slot also displays the local user's own queue
              position when their hand is raised — so they can see where
              they are in line. */}
          <div className="rim-pp__row rim-pp__row--self">
            <span className="rim-pp__signal">
              {localMeta.signal === "hand"
                ? `${queueMap.get(localId ?? "") ?? ""} ✋`.trim()
                : localMeta.signal
                ? SIGNAL_EMOJI[localMeta.signal]
                : ""}
            </span>
            <span className="rim-pp__name">
              {localName} <span className="rim-pp__self-tag">(you)</span>
            </span>
            {localMeta.host && (
              <span className="rim-pp__role-tag rim-pp__role-tag--host">Host</span>
            )}
            {localMeta.teacher && (
              <span className="rim-pp__role-tag rim-pp__role-tag--teacher">Teacher</span>
            )}
            {localMeta.cohost && !localMeta.host && !localMeta.teacher && (
              <span className="rim-pp__role-tag rim-pp__role-tag--cohost">Host Volunteer</span>
            )}
          </div>

          {filtered.length === 0 && (
            <p className="rim-pp__empty">
              {search ? "No participants match that search." : "No one else is here yet."}
            </p>
          )}

          {filtered.map((p) => {
            const meta = getMetadata(p);
            const isMicEnabled = p.isMicrophoneEnabled;
            const queuePos = queueMap.get(p.identity);
            return (
              <div key={p.identity} className="rim-pp__row">
                <span className="rim-pp__signal">
                  {meta.signal === "hand" && queuePos != null
                    ? `${queuePos} ✋`
                    : meta.signal
                    ? SIGNAL_EMOJI[meta.signal]
                    : ""}
                </span>
                <span className="rim-pp__name">{p.name || p.identity}</span>
                {meta.host && (
                  <span className="rim-pp__role-tag rim-pp__role-tag--host">Host</span>
                )}
                {meta.teacher && (
                  <span className="rim-pp__role-tag rim-pp__role-tag--teacher">Teacher</span>
                )}
                {meta.cohost && !meta.host && !meta.teacher && (
                  <span className="rim-pp__role-tag rim-pp__role-tag--cohost">Host Volunteer</span>
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
