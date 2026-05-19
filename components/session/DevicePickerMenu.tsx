"use client";

/**
 * DevicePickerMenu — upward popover from a mic/camera chevron.
 *
 * Lists devices for the requested kind (audio input / video input /
 * audio output), marks the active one, and switches live via
 * `room.switchActiveDevice(kind, deviceId)`.
 *
 * Selection is persisted in localStorage under `rim-livekit-prefs` so
 * the choice carries across sessions.
 */

import { useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";

type Kind = "audioinput" | "videoinput" | "audiooutput";

interface Props {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  /** Which device kinds to show. "mic" shows audioinput + audiooutput; "camera" shows videoinput. */
  variant: "mic" | "camera";
  onOpenSettings: () => void;
}

const LS_KEY = "rim-livekit-prefs";

interface Prefs {
  audioinput?: string;
  videoinput?: string;
  audiooutput?: string;
}

function readPrefs(): Prefs {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}

function writePrefs(p: Prefs) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {}
}

export default function DevicePickerMenu({ open, onClose, anchorRef, variant, onOpenSettings }: Props) {
  const room = useRoomContext();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [active, setActive] = useState<Record<Kind, string | undefined>>({
    audioinput: undefined,
    videoinput: undefined,
    audiooutput: undefined,
  });

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

  // Enumerate devices when opened
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        setDevices(list);
      } catch {}
    }
    load();
    function refresh() { if (!cancelled) load(); }
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
    };
  }, [open]);

  // Read the currently-active device ids from the room
  useEffect(() => {
    if (!room) return;
    const lp = room.localParticipant;
    const micTrack = lp.getTrackPublication
      ? lp.getTrackPublication("microphone" as never)?.track
      : undefined;
    const camTrack = lp.getTrackPublication
      ? lp.getTrackPublication("camera" as never)?.track
      : undefined;
    setActive((prev) => ({
      ...prev,
      audioinput: (micTrack?.mediaStreamTrack?.getSettings().deviceId as string | undefined) ?? prev.audioinput,
      videoinput: (camTrack?.mediaStreamTrack?.getSettings().deviceId as string | undefined) ?? prev.videoinput,
    }));
  }, [room, open]);

  async function pick(kind: Kind, deviceId: string) {
    if (!room) return;
    try {
      await room.switchActiveDevice(kind, deviceId);
      setActive((prev) => ({ ...prev, [kind]: deviceId }));
      const prefs = readPrefs();
      prefs[kind] = deviceId;
      writePrefs(prefs);
    } catch {}
    onClose();
  }

  if (!open) return null;

  const audioInputs = devices.filter((d) => d.kind === "audioinput");
  const audioOutputs = devices.filter((d) => d.kind === "audiooutput");
  const videoInputs = devices.filter((d) => d.kind === "videoinput");

  return (
    <div ref={menuRef} className="rim-cb-popover rim-cb-popover--devices" role="menu">
      {variant === "mic" && (
        <>
          <div className="rim-cb-popover__section-label">Select a Microphone</div>
          {audioInputs.length === 0 && (
            <div className="rim-cb-popover__empty">No microphones detected</div>
          )}
          {audioInputs.map((d) => (
            <button
              key={d.deviceId}
              type="button"
              className="rim-cb-popover__item rim-cb-popover__item--device"
              onClick={() => pick("audioinput", d.deviceId)}
              role="menuitem"
            >
              <span className="rim-cb-popover__device-marker" aria-hidden="true">
                {active.audioinput === d.deviceId ? "●" : ""}
              </span>
              <span className="rim-cb-popover__device-label">{d.label || "Microphone"}</span>
            </button>
          ))}
          {audioOutputs.length > 0 && (
            <>
              <div className="rim-cb-popover__divider" aria-hidden="true" />
              <div className="rim-cb-popover__section-label">Select a Speaker</div>
              {audioOutputs.map((d) => (
                <button
                  key={d.deviceId}
                  type="button"
                  className="rim-cb-popover__item rim-cb-popover__item--device"
                  onClick={() => pick("audiooutput", d.deviceId)}
                  role="menuitem"
                >
                  <span className="rim-cb-popover__device-marker" aria-hidden="true">
                    {active.audiooutput === d.deviceId ? "●" : ""}
                  </span>
                  <span className="rim-cb-popover__device-label">{d.label || "Speaker"}</span>
                </button>
              ))}
            </>
          )}
          <div className="rim-cb-popover__divider" aria-hidden="true" />
          <button
            type="button"
            className="rim-cb-popover__item rim-cb-popover__item--settings-link"
            onClick={() => { onOpenSettings(); onClose(); }}
            role="menuitem"
          >
            Audio Settings…
          </button>
        </>
      )}

      {variant === "camera" && (
        <>
          <div className="rim-cb-popover__section-label">Select a Camera</div>
          {videoInputs.length === 0 && (
            <div className="rim-cb-popover__empty">No cameras detected</div>
          )}
          {videoInputs.map((d) => (
            <button
              key={d.deviceId}
              type="button"
              className="rim-cb-popover__item rim-cb-popover__item--device"
              onClick={() => pick("videoinput", d.deviceId)}
              role="menuitem"
            >
              <span className="rim-cb-popover__device-marker" aria-hidden="true">
                {active.videoinput === d.deviceId ? "●" : ""}
              </span>
              <span className="rim-cb-popover__device-label">{d.label || "Camera"}</span>
            </button>
          ))}
          <div className="rim-cb-popover__divider" aria-hidden="true" />
          <button
            type="button"
            className="rim-cb-popover__item rim-cb-popover__item--settings-link"
            onClick={() => { onOpenSettings(); onClose(); }}
            role="menuitem"
          >
            Camera Settings…
          </button>
        </>
      )}
    </div>
  );
}
