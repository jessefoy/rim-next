"use client";

/**
 * RIMChat — RIM-branded in-session chat with persistence + direct messages.
 *
 * Replaces LiveKit's stock <Chat /> (broadcast-only, in-memory). Messages are:
 *   - POSTed to /api/livekit/chat for persistence
 *   - Re-emitted on the LiveKit data channel (topic "rim-chat") so other
 *     clients in the room see them instantly
 *   - Optionally targeted to specific identities for private DMs
 *
 * On mount, fetches up to 100 prior messages from the DB so new joiners and
 * post-refresh users see history.
 *
 * Guests (open-access programs) send/receive with their LiveKit identity
 * plus their guestKey for server-side gate.
 */

import { useEffect, useRef, useState } from "react";
import { useRoomContext, useRemoteParticipants } from "@livekit/components-react";
import { RoomEvent, DataPacket_Kind } from "livekit-client";

interface ChatMessage {
  id: string;
  fromUserId: string | null;
  fromIdentity: string;
  fromName: string;
  body: string;
  toIdentities: string[];
  sentAt: string;
}

interface Props {
  programSlug: string;
  sessionDate?: string;
  guestKey?: string;
  guestName?: string;
  /** Controlled DM recipient (LiveKit identity); "" = Everyone. Lifted to
   *  RIMConference so the Participants panel can open a private message by
   *  clicking a name. */
  recipient: string;
  onRecipientChange: (identity: string) => void;
}

/** Data-channel topic for chat packets. Exported so RIMConference can count
 *  unread messages on the same topic while the chat panel is closed. */
export const CHAT_TOPIC = "rim-chat";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.round((now - then) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return new Date(iso).toLocaleString();
}

export default function RIMChat({ programSlug, sessionDate, guestKey, guestName, recipient, onRecipientChange }: Props) {
  const room = useRoomContext();
  const remoteParticipants = useRemoteParticipants();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const localIdentity = room?.localParticipant?.identity ?? "";

  function appendDedup(msg: ChatMessage) {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }

  // Seed history
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const qs = new URLSearchParams({ programSlug });
      if (sessionDate) qs.set("sessionDate", sessionDate);
      if (guestKey) qs.set("guestKey", guestKey);
      if (guestKey && localIdentity) qs.set("guestIdentity", localIdentity);
      try {
        const res = await fetch(`/api/livekit/chat?${qs.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as { messages: ChatMessage[] };
        if (!cancelled) setMessages(data.messages);
      } catch {}
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [programSlug, sessionDate, guestKey, localIdentity]);

  // Subscribe to live data-channel events for our topic
  useEffect(() => {
    if (!room) return;
    const handler = (payload: Uint8Array, _participant: unknown, _kind?: DataPacket_Kind, topic?: string) => {
      if (topic !== CHAT_TOPIC) return;
      try {
        const decoded = new TextDecoder().decode(payload);
        const msg = JSON.parse(decoded) as ChatMessage;
        if (msg && typeof msg.id === "string" && typeof msg.body === "string") {
          appendDedup(msg);
        }
      } catch {}
    };
    room.on(RoomEvent.DataReceived, handler);
    return () => {
      room.off(RoomEvent.DataReceived, handler);
    };
  }, [room]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  async function send() {
    if (!draft.trim() || sending || !room) return;
    setSending(true);
    setError(null);
    const toIdentities = recipient ? [recipient] : [];

    try {
      const body: Record<string, unknown> = {
        programSlug,
        sessionDate,
        body: draft.trim(),
        toIdentities,
      };
      if (guestKey) {
        body.guestKey = guestKey;
        body.guestIdentity = localIdentity;
        body.guestName = guestName ?? room.localParticipant.name ?? "Guest";
      }
      const res = await fetch("/api/livekit/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send");
      }
      const saved = (await res.json()) as ChatMessage;

      // Append locally — LiveKit doesn't echo publishData to the sender
      appendDedup(saved);

      // Re-emit on the data channel so other clients see it without polling
      const encoded = new TextEncoder().encode(JSON.stringify(saved));
      try {
        await room.localParticipant.publishData(encoded, {
          reliable: true,
          topic: CHAT_TOPIC,
          destinationIdentities: toIdentities.length > 0 ? toIdentities : undefined,
        });
      } catch {}

      setDraft("");
      // After sending a DM, return to broadcast — matches Zoom default
      if (toIdentities.length > 0) onRecipientChange("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    }
    setSending(false);
  }

  function recipientName(identity: string): string {
    const p = remoteParticipants.find((rp) => rp.identity === identity);
    return p?.name || identity;
  }

  return (
    <div className="rim-chat">
      <div className="rim-chat__list" ref={listRef}>
        {messages.length === 0 && (
          <p className="rim-chat__empty">No messages yet.</p>
        )}
        {messages.map((m) => {
          const isMine = m.fromIdentity === localIdentity;
          const isPrivate = m.toIdentities.length > 0;
          let meta: string;
          if (isPrivate) {
            if (isMine) {
              meta = `To ${m.toIdentities.map(recipientName).join(", ")} (private)`;
            } else {
              meta = `${m.fromName} → you (private)`;
            }
          } else {
            meta = m.fromName;
          }
          return (
            <div
              key={m.id}
              className={`rim-chat-msg${isPrivate ? " rim-chat-msg--private" : ""}${isMine ? " rim-chat-msg--mine" : ""}`}
            >
              <div className="rim-chat-msg__meta">
                <span className="rim-chat-msg__from">{meta}</span>
                <span className="rim-chat-msg__time">{relativeTime(m.sentAt)}</span>
              </div>
              <div className="rim-chat-msg__body">{m.body}</div>
            </div>
          );
        })}
      </div>
      <div className="rim-chat-compose">
        <label className="rim-chat-compose__to">
          To:{" "}
          <select
            className="rim-chat-compose__to-select"
            value={recipient}
            onChange={(e) => onRecipientChange(e.target.value)}
          >
            <option value="">Everyone</option>
            {remoteParticipants
              .filter((p) => p.identity !== localIdentity)
              .map((p) => (
                <option key={p.identity} value={p.identity}>
                  {p.name || p.identity} (private)
                </option>
              ))}
          </select>
        </label>
        <textarea
          className="rim-chat-compose__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={recipient ? `Message to ${recipientName(recipient)}…` : "Message everyone…"}
          rows={2}
          maxLength={2000}
        />
        <button
          type="button"
          className="rim-chat-compose__send"
          onClick={send}
          disabled={sending || !draft.trim()}
        >
          {sending ? "Sending…" : "Send"}
        </button>
        {error && <p className="rim-chat-compose__error">{error}</p>}
      </div>
    </div>
  );
}
