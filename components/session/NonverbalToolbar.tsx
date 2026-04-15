"use client";

/**
 * NonverbalToolbar — signal buttons for all participants.
 *
 * Sends a signal via participant metadata so everyone in the room
 * can see it as a badge on your tile (via RIMParticipantTile).
 *
 * - ✋ Hand raise: persists until clicked again (toggle)
 * - ❤️ Heart, 🙏 Namaste, ✓ Yes, ✗ No: momentary, auto-clear after 5s
 */

import { useState, useEffect, useRef } from "react";
import type { LocalParticipant } from "livekit-client";
import type { Signal } from "./RIMParticipantTile";
import type { ParticipantMetadata } from "./RIMParticipantTile";

interface Props {
  localParticipant: LocalParticipant;
}

const SIGNALS: { signal: Signal; emoji: string; label: string; momentary: boolean }[] = [
  { signal: "hand",    emoji: "✋", label: "Raise hand", momentary: false },
  { signal: "heart",   emoji: "❤️", label: "Heart",      momentary: true  },
  { signal: "namaste", emoji: "🙏", label: "Namaste",    momentary: true  },
  { signal: "yes",     emoji: "✓",  label: "Yes",        momentary: true  },
  { signal: "no",      emoji: "✗",  label: "No",         momentary: true  },
];

function getMetadata(p: LocalParticipant): ParticipantMetadata {
  try { return JSON.parse(p.metadata || "{}"); } catch { return {}; }
}

export default function NonverbalToolbar({ localParticipant }: Props) {
  const [active, setActive] = useState<Signal>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync active state from metadata (in case of reconnect)
  useEffect(() => {
    if (!localParticipant) return;
    const meta = getMetadata(localParticipant);
    setActive(meta.signal ?? null);
  }, [localParticipant]);

  function sendSignal(signal: Signal, momentary: boolean) {
    if (!localParticipant) return;
    if (clearTimer.current) clearTimeout(clearTimer.current);

    const meta = getMetadata(localParticipant);

    // Toggle hand raise off if already raised
    const next: Signal = active === signal && signal === "hand" ? null : signal;

    localParticipant.setMetadata(JSON.stringify({ ...meta, signal: next }));
    setActive(next);

    // Momentary signals auto-clear after 5s
    if (next && momentary) {
      clearTimer.current = setTimeout(() => {
        const current = getMetadata(localParticipant);
        localParticipant.setMetadata(JSON.stringify({ ...current, signal: null }));
        setActive(null);
      }, 5000);
    }
  }

  return (
    <div className="rim-signals">
      {SIGNALS.map(({ signal, emoji, label, momentary }) => (
        <button
          key={signal}
          className={`rim-signals__btn${active === signal ? " rim-signals__btn--active" : ""}`}
          onClick={() => sendSignal(signal, momentary)}
          title={label}
          aria-label={label}
          aria-pressed={active === signal}
        >
          {emoji}
          {signal === "hand" && active === "hand" && (
            <span className="rim-signals__label">Lower</span>
          )}
        </button>
      ))}
    </div>
  );
}
