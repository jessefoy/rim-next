"use client";

/**
 * EndMenu — upward popover from the control bar's red End button.
 *
 * Host:     "End Meeting for All" (red) + "Leave Meeting"
 * Non-host: single "Leave Meeting" item
 *
 * Matches Zoom's two-step end affordance — the destructive action requires a
 * second tap, on a clearly distinct item.
 */

import { useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";

interface Props {
  open: boolean;
  onClose: () => void;
  isHost: boolean;
  programSlug: string;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export default function EndMenu({ open, onClose, isHost, programSlug, anchorRef }: Props) {
  const room = useRoomContext();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [ending, setEnding] = useState(false);

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

  function leave() {
    onClose();
    room?.disconnect();
  }

  async function endForAll() {
    setEnding(true);
    try {
      await fetch("/api/livekit/end-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programSlug }),
      });
    } catch {}
    // The server delete-room triggers all participants to disconnect, which
    // fires LiveKitRoom.onDisconnected on each client.
    setEnding(false);
    onClose();
  }

  if (!open) return null;

  return (
    <div ref={menuRef} className="rim-cb-popover rim-cb-popover--end" role="menu">
      {isHost && (
        <button
          type="button"
          className="rim-cb-popover__item rim-cb-popover__item--destructive"
          onClick={endForAll}
          disabled={ending}
          role="menuitem"
        >
          {ending ? "Ending…" : "End Meeting for All"}
        </button>
      )}
      <button
        type="button"
        className="rim-cb-popover__item"
        onClick={leave}
        role="menuitem"
      >
        Leave Meeting
      </button>
    </div>
  );
}
