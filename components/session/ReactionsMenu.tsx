"use client";

/**
 * ReactionsMenu — upward popover from the control bar's "Reactions" button.
 *
 * Replaces the top-of-room NonverbalToolbar. Matches Zoom's "Reactions"
 * popover behavior: a horizontal row of emoji that fly briefly above the
 * sender's tile, plus a "Lower hand" item at the top when hand is raised.
 *
 * Behavior unchanged from NonverbalToolbar:
 *   - signals broadcast via participant metadata
 *   - hand persists until toggled
 *   - others auto-clear after 5s
 */

import { useEffect, useRef, useState } from "react";
import type { LocalParticipant } from "livekit-client";
import type { Signal, ParticipantMetadata } from "./RIMParticipantTile";

interface Props {
  localParticipant: LocalParticipant;
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

const SIGNALS: { signal: Signal; emoji: string; label: string; momentary: boolean }[] = [
  { signal: "hand",    emoji: "✋",  label: "Raise hand", momentary: false },
  { signal: "heart",   emoji: "❤️", label: "Heart",      momentary: true  },
  { signal: "namaste", emoji: "🙏", label: "Namaste",    momentary: true  },
  { signal: "yes",     emoji: "✓",  label: "Yes",        momentary: true  },
  { signal: "no",      emoji: "✗",  label: "No",         momentary: true  },
];

function getMetadata(p: LocalParticipant): ParticipantMetadata {
  try { return JSON.parse(p.metadata || "{}"); } catch { return {}; }
}

export default function ReactionsMenu({ localParticipant, open, onClose, anchorRef }: Props) {
  const [active, setActive] = useState<Signal>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Sync from metadata
  useEffect(() => {
    if (!localParticipant) return;
    const meta = getMetadata(localParticipant);
    setActive(meta.signal ?? null);
  }, [localParticipant]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose, anchorRef]);

  function sendSignal(signal: Signal, momentary: boolean) {
    if (!localParticipant) return;
    if (clearTimer.current) clearTimeout(clearTimer.current);

    const meta = getMetadata(localParticipant);
    const next: Signal = active === signal && signal === "hand" ? null : signal;

    localParticipant.setMetadata(JSON.stringify({ ...meta, signal: next }));
    setActive(next);

    if (next && momentary) {
      clearTimer.current = setTimeout(() => {
        const current = getMetadata(localParticipant);
        localParticipant.setMetadata(JSON.stringify({ ...current, signal: null }));
        setActive(null);
      }, 5000);
    }
    // Close popover after any selection (Zoom behavior)
    onClose();
  }

  function lowerHand() {
    if (!localParticipant) return;
    const meta = getMetadata(localParticipant);
    localParticipant.setMetadata(JSON.stringify({ ...meta, signal: null }));
    setActive(null);
    onClose();
  }

  if (!open) return null;

  return (
    <div ref={menuRef} className="rim-cb-popover rim-cb-popover--reactions" role="menu">
      {active === "hand" && (
        <button
          type="button"
          className="rim-cb-popover__item rim-cb-popover__item--lower-hand"
          onClick={lowerHand}
          role="menuitem"
        >
          ✋ Lower hand
        </button>
      )}
      <div className="rim-cb-popover__reactions-row">
        {SIGNALS.map(({ signal, emoji, label, momentary }) => (
          <button
            key={signal}
            type="button"
            className={`rim-cb-popover__reaction${active === signal ? " rim-cb-popover__reaction--active" : ""}`}
            onClick={() => sendSignal(signal, momentary)}
            title={label}
            aria-label={label}
            aria-pressed={active === signal}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
