"use client";

/**
 * ReactionsMenu — upward popover from the control bar's "Reactions" button.
 *
 * Replaces the top-of-room NonverbalToolbar. Matches Zoom's "Reactions"
 * popover behavior: a horizontal row of emoji that fly briefly above the
 * sender's tile, plus a contextual "Clear" item at the top when the local
 * user is currently showing a persistent signal.
 *
 * Signal model — single signal per participant at a time (mutually
 * exclusive). Persistence varies by signal:
 *
 *   ✋ Raised hand — persistent. Click to set, click again (or the Clear
 *       row) to lower. Reorders the tile to the top-left of the grid in
 *       raise order (handled in RIMConference).
 *   ✓ / ✗      — persistent (voting). Same toggle semantics as the hand.
 *                Does NOT reorder the tile — the badge stays in place so
 *                the host can read votes without the grid shuffling.
 *   ❤️ / 🙏    — timed reaction (~5s auto-clear). Quick acknowledgment;
 *                no commitment expected from the sender, so no clear-up
 *                step is needed.
 *
 * Component-local `active` state syncs from metadata on mount and resets
 * on session rejoin (the component remounts), matching the Bell-mode
 * "reset on join" convention from session 122.
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

type SignalDef = {
  signal: NonNullable<Signal>;
  emoji: string;
  label: string;
  /** Persistent signals toggle on/off and require an explicit clear.
   *  Non-persistent signals auto-clear after AUTO_CLEAR_MS. */
  persistent: boolean;
};

// Order matters — this is the order rendered in the popover row.
// Persistent signals come first (hand, then votes), then quick reactions.
const SIGNALS: SignalDef[] = [
  { signal: "hand",    emoji: "✋",  label: "Raise hand", persistent: true  },
  { signal: "yes",     emoji: "✓",  label: "Yes",        persistent: true  },
  { signal: "no",      emoji: "✗",  label: "No",         persistent: true  },
  { signal: "heart",   emoji: "❤️", label: "Heart",      persistent: false },
  { signal: "namaste", emoji: "🙏", label: "Namaste",    persistent: false },
];

const AUTO_CLEAR_MS = 5000;

type PersistentSignal = "hand" | "yes" | "no";

/** Plain-language label for the contextual "Clear" row at the top of the
 *  popover. Shown only when the local user has a persistent signal active. */
const CLEAR_LABEL: Record<PersistentSignal, string> = {
  hand: "✋ Lower hand",
  yes:  "✓ Clear Yes",
  no:   "✗ Clear No",
};

function isPersistentSignal(s: Signal): s is PersistentSignal {
  return s === "hand" || s === "yes" || s === "no";
}

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

  function sendSignal(signal: NonNullable<Signal>, persistent: boolean) {
    if (!localParticipant) return;
    if (clearTimer.current) clearTimeout(clearTimer.current);

    const meta = getMetadata(localParticipant);
    // Toggle off on second tap for any persistent signal (hand / yes / no).
    // Non-persistent signals (heart / namaste) always replace whatever is
    // active — re-tapping doesn't clear because the timer will.
    const next: Signal = active === signal && persistent ? null : signal;

    const nextMeta: ParticipantMetadata = { ...meta, signal: next };
    if (next === "hand") {
      // Stamp the moment the hand went up so the grid can sort by it.
      // Only set when transitioning into the hand state; existing hand
      // raises preserve their original timestamp (a no-op toggle is a
      // clear, handled above).
      nextMeta.raisedHandAt = Date.now();
    } else {
      // Any non-hand state clears the queue stamp. Safe to delete an
      // absent property.
      delete nextMeta.raisedHandAt;
    }

    localParticipant.setMetadata(JSON.stringify(nextMeta));
    setActive(next);

    if (next && !persistent) {
      clearTimer.current = setTimeout(() => {
        const current = getMetadata(localParticipant);
        const cleared: ParticipantMetadata = { ...current, signal: null };
        delete cleared.raisedHandAt;
        localParticipant.setMetadata(JSON.stringify(cleared));
        setActive(null);
      }, AUTO_CLEAR_MS);
    }
    // Close popover after any selection (Zoom behavior)
    onClose();
  }

  function clearSignal() {
    if (!localParticipant) return;
    if (clearTimer.current) clearTimeout(clearTimer.current);
    const meta = getMetadata(localParticipant);
    const cleared: ParticipantMetadata = { ...meta, signal: null };
    delete cleared.raisedHandAt;
    localParticipant.setMetadata(JSON.stringify(cleared));
    setActive(null);
    onClose();
  }

  if (!open) return null;

  // The clear affordance is only meaningful for the three persistent
  // signals. Timed reactions clear themselves; surfacing a clear row for
  // them would offer the user a button that races with the auto-timer.
  // Type predicate narrows `active` to PersistentSignal inside the branch
  // so the label lookup type-checks without a cast.
  const showClear = isPersistentSignal(active);

  return (
    <div ref={menuRef} className="rim-cb-popover rim-cb-popover--reactions" role="menu">
      {showClear && (
        <button
          type="button"
          className="rim-cb-popover__item rim-cb-popover__item--clear-signal"
          onClick={clearSignal}
          role="menuitem"
        >
          {CLEAR_LABEL[active]}
        </button>
      )}
      <div className="rim-cb-popover__reactions-row">
        {SIGNALS.map(({ signal, emoji, label, persistent }) => (
          <button
            key={signal}
            type="button"
            className={`rim-cb-popover__reaction${active === signal ? " rim-cb-popover__reaction--active" : ""}`}
            onClick={() => sendSignal(signal, persistent)}
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
