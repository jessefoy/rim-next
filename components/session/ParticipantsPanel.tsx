"use client";

/**
 * ParticipantsPanel — Zoom-aligned slide-in roster.
 *
 * Sticky local "Me" row at the top with a Host tag when applicable, then
 * remote participants below (raised hands float to top). Host tag is also
 * shown on remote rows whose token grants roomAdmin. Co-hosts get a per-row
 * Mute / Ask-to-unmute / Remove (the row stays a clean name + role pill —
 * no mic glyph; mute state is read from the action label and the tile
 * nameplate). Mute All lives on the control bar. A search box appears when
 * participant count exceeds 10.
 *
 * Re-renders on TrackMuted / TrackUnmuted / TrackPublished / TrackUnpublished.
 * Uses `participant.isMicrophoneEnabled` (the canonical flag) to choose the
 * per-row Mute vs Ask-to-unmute action.
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

/**
 * Data-channel topic for "ask to unmute" — a co-host taps the button on a
 * muted row; the target gets a calm one-tap prompt (rendered by
 * RIMConference). We can never force a mic on (browser consent), so the
 * invitation + the recipient's own tap IS the feature. Client-to-client like
 * Reactions: same trust tier as metadata — a UI courtesy, not a control.
 */
export const UNMUTE_REQUEST_TOPIC = "rim-unmute-request";

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
  /** YYYY-MM-DD in CT — scopes mute requests to this session's room. */
  sessionDate: string | undefined;
  localIdentity: string;
  /** Co-host or higher: gates the per-row Mute and the Mute All footer. */
  isCoHost: boolean;
  /** Start a private chat with this participant (by identity). Wired by
   *  RIMConference to set the chat recipient + open the chat panel. When
   *  provided, each remote participant's name becomes a clickable button. */
  onMessageParticipant?: (identity: string) => void;
}

export default function ParticipantsPanel({ open, onClose, participants, programSlug, sessionDate, localIdentity, isCoHost, onMessageParticipant }: Props) {
  const room = useRoomContext();
  const [muting, setMuting] = useState<Record<string, boolean>>({});
  const [muteNotice, setMuteNotice] = useState<string | null>(null);
  // Brief per-identity "Asked ✓" feedback after an ask-to-unmute send.
  const [asked, setAsked] = useState<Record<string, boolean>>({});
  // Remove flow: which row's confirm block is open / in flight.
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
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

  function flashMuteNotice(message?: string) {
    // Brief, calm feedback when a host action didn't take — almost always a
    // co-host whose hosting capability was paused mid-session (the server
    // 403s). The common "participant just left" race returns ok and stays
    // correctly silent (the action's end-state already holds). (Audit CHAT-3.)
    setMuteNotice(message ?? "Couldn't mute — you may no longer have host controls.");
    setTimeout(() => setMuteNotice(null), 4000);
  }

  async function muteParticipant(identity: string) {
    setMuting((prev) => ({ ...prev, [identity]: true }));
    try {
      const res = await fetch("/api/livekit/mute-participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programSlug, sessionDate, participantIdentity: identity }),
      });
      if (!res.ok) flashMuteNotice();
    } catch {
      flashMuteNotice();
    }
    setMuting((prev) => ({ ...prev, [identity]: false }));
  }

  async function askToUnmute(identity: string) {
    if (!room) return;
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({ fromName: room.localParticipant?.name || "The host" }),
      );
      await room.localParticipant.publishData(payload, {
        reliable: true,
        topic: UNMUTE_REQUEST_TOPIC,
        destinationIdentities: [identity],
      });
      setAsked((prev) => ({ ...prev, [identity]: true }));
      setTimeout(() => {
        setAsked((prev) => ({ ...prev, [identity]: false }));
      }, 4000);
    } catch {
      flashMuteNotice("Couldn't send the unmute invitation.");
    }
  }

  async function removeParticipant(identity: string, name: string, banForSession: boolean) {
    setRemoving(identity);
    try {
      const res = await fetch("/api/livekit/remove-participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programSlug,
          sessionDate,
          participantIdentity: identity,
          participantName: name,
          banForSession,
        }),
      });
      if (!res.ok) {
        flashMuteNotice("Couldn't remove — you may no longer have host controls.");
      }
    } catch {
      flashMuteNotice("Couldn't remove — you may no longer have host controls.");
    }
    setRemoving(null);
    setRemoveConfirm(null);
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
            {localMeta.signal && (
              <span className="rim-pp__signal">
                {localMeta.signal === "hand"
                  ? `${queueMap.get(localId ?? "") ?? ""} ✋`.trim()
                  : SIGNAL_EMOJI[localMeta.signal]}
              </span>
            )}
            <span className="rim-pp__name">
              {localName} <span className="rim-pp__self-tag">(you)</span>
            </span>
            {localMeta.host && (
              <span className="rim-pp__role-tag rim-pp__role-tag--host">Host</span>
            )}
            {localMeta.teacher && (
              <span className="rim-pp__role-tag rim-pp__role-tag--teacher">{localMeta.teacherLabel || "Teacher"}</span>
            )}
            {localId.startsWith("guest-") && (
              <span className="rim-pp__role-tag rim-pp__role-tag--guest">Guest</span>
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
            const displayName = p.name || p.identity;
            return (
              <div key={p.identity} className="rim-pp__entry">
              <div className="rim-pp__row">
                {meta.signal && (
                  <span className="rim-pp__signal">
                    {meta.signal === "hand" && queuePos != null
                      ? `${queuePos} ✋`
                      : SIGNAL_EMOJI[meta.signal]}
                  </span>
                )}
                {onMessageParticipant ? (
                  <button
                    type="button"
                    className="rim-pp__name rim-pp__name--action"
                    onClick={() => onMessageParticipant(p.identity)}
                    title={`Message ${p.name || p.identity} privately`}
                  >
                    {p.name || p.identity}
                  </button>
                ) : (
                  <span className="rim-pp__name">{p.name || p.identity}</span>
                )}
                {meta.host && (
                  <span className="rim-pp__role-tag rim-pp__role-tag--host">Host</span>
                )}
                {meta.teacher && (
                  <span className="rim-pp__role-tag rim-pp__role-tag--teacher">{meta.teacherLabel || "Teacher"}</span>
                )}
                {p.identity.startsWith("guest-") && (
                  <span className="rim-pp__role-tag rim-pp__role-tag--guest">Guest</span>
                )}
                {isCoHost && (
                  isMicEnabled ? (
                    <button
                      className="rim-pp__mute-btn"
                      onClick={() => muteParticipant(p.identity)}
                      disabled={muting[p.identity]}
                      title={`Mute ${displayName}`}
                    >
                      {muting[p.identity] ? "…" : "Mute"}
                    </button>
                  ) : (
                    // The 🔇 icon already says "muted" — this slot becomes
                    // the invitation affordance (we can't force a mic on;
                    // the recipient gets a one-tap prompt).
                    <button
                      className="rim-pp__mute-btn rim-pp__ask-btn"
                      onClick={() => askToUnmute(p.identity)}
                      disabled={!!asked[p.identity]}
                      title={`Invite ${displayName} to unmute`}
                    >
                      {asked[p.identity] ? "Asked ✓" : "Ask to unmute"}
                    </button>
                  )
                )}
                {isCoHost && (
                  <button
                    className="rim-pp__remove-btn"
                    onClick={() =>
                      setRemoveConfirm((prev) => (prev === p.identity ? null : p.identity))
                    }
                    aria-expanded={removeConfirm === p.identity}
                    title={`Remove ${displayName} from this session`}
                  >
                    Remove
                  </button>
                )}
              </div>
              {/* Remove confirm — plain language, a clear escape, and the two
                  modes Jesse specified. Random taps are survivable: nothing
                  happens without one of the explicit Remove choices. */}
              {isCoHost && removeConfirm === p.identity && (
                <div className="rim-pp__remove-confirm" role="dialog" aria-label={`Remove ${displayName}`}>
                  <p className="rim-pp__remove-confirm-text">
                    Remove {displayName} from this session?
                  </p>
                  <button
                    className="rim-pp__remove-confirm-btn"
                    onClick={() => removeParticipant(p.identity, displayName, false)}
                    disabled={removing === p.identity}
                  >
                    {removing === p.identity ? "Removing…" : "Remove — they can rejoin"}
                  </button>
                  <button
                    className="rim-pp__remove-confirm-btn rim-pp__remove-confirm-btn--ban"
                    onClick={() => removeParticipant(p.identity, displayName, true)}
                    disabled={removing === p.identity}
                  >
                    {removing === p.identity ? "Removing…" : "Remove for the rest of this session"}
                  </button>
                  <button
                    className="rim-pp__remove-confirm-cancel"
                    onClick={() => setRemoveConfirm(null)}
                    disabled={removing === p.identity}
                  >
                    Cancel
                  </button>
                </div>
              )}
              </div>
            );
          })}
        </div>

        {/* Mute All moved to the control bar (session: roster cleanup). The
            footer now only surfaces a transient failure notice from the
            per-row Mute / Ask / Remove actions. */}
        {muteNotice && (
          <div className="rim-pp__footer">
            <p className="rim-pp__notice" role="alert">{muteNotice}</p>
          </div>
        )}
      </aside>
    </>
  );
}
