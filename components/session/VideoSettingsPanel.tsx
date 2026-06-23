"use client";

/**
 * VideoSettingsPanel — settings overlay (⚙ button in control bar).
 *
 * Sections:
 *   - Audio: microphone + speaker device dropdowns
 *   - Video: camera device dropdown
 *   - Presence photo: upload / change / remove
 *
 * Device selection is the deeper home for the in-control-bar chevron
 * popovers. Both write to the same localStorage prefs and call
 * `room.switchActiveDevice()` for live swap.
 */

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import type { LocalParticipant } from "livekit-client";
import { RoomEvent } from "livekit-client";
import { useRoomContext } from "@livekit/components-react";
import type { ParticipantMetadata } from "./RIMParticipantTile";
import type { BackgroundMode } from "./useBackgroundEffects";
import { BACKGROUND_SCENES, BLUR_RADIUS_MIN, BLUR_RADIUS_MAX } from "@/lib/backgroundProcessorConfig";

interface Props {
  open: boolean;
  onClose: () => void;
  localParticipant: LocalParticipant;
  avatarUrl: string | null;
  onAvatarChange: (url: string | null) => void;
  /** Background effects (Settings → Background) — wired from useBackgroundEffects in RIMConference. */
  backgroundAvailable: boolean;
  backgroundMode: BackgroundMode;
  blurRadius: number;
  backgroundImagePath: string | null;
  backgroundPending: boolean;
  backgroundCpuPaused: boolean;
  onBackgroundNone: () => void;
  onBackgroundBlur: () => void;
  onBackgroundImage: (path: string) => void;
  onBlurRadiusChange: (radius: number) => void;
  /** Camera switch routed through useBackgroundEffects so the blur/scene
   *  processor is detached before the device swap and re-attached after —
   *  LiveKit's in-switch processor.restart() blanks the tile on Safari. */
  onSwitchCamera: (deviceId: string) => Promise<boolean>;
}

type Kind = "audioinput" | "videoinput" | "audiooutput";

const LS_KEY = "rim-livekit-prefs";

function readPrefs(): Record<Kind, string | undefined> {
  if (typeof window === "undefined") return { audioinput: undefined, videoinput: undefined, audiooutput: undefined };
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    return {
      audioinput: raw.audioinput,
      videoinput: raw.videoinput,
      audiooutput: raw.audiooutput,
    };
  } catch {
    return { audioinput: undefined, videoinput: undefined, audiooutput: undefined };
  }
}

function writePref(kind: Kind, deviceId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    raw[kind] = deviceId;
    localStorage.setItem(LS_KEY, JSON.stringify(raw));
  } catch {}
}

function getMetadata(p: LocalParticipant): ParticipantMetadata {
  try { return JSON.parse(p.metadata || "{}"); } catch { return {}; }
}

export default function VideoSettingsPanel({ open, onClose, localParticipant, avatarUrl, onAvatarChange, backgroundAvailable, backgroundMode, blurRadius, backgroundImagePath, backgroundPending, backgroundCpuPaused, onBackgroundNone, onBackgroundBlur, onBackgroundImage, onBlurRadiusChange, onSwitchCamera }: Props) {
  const room = useRoomContext();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [active, setActive] = useState(readPrefs);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  // Audio-output selection (setSinkId) is unsupported on Safari/iOS — the
  // dropdown would be a dead control there, so we show an honest note instead.
  const [outputSupported, setOutputSupported] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setDevices(list);
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

  // Reflect the ACTUAL active devices (not just saved prefs) when the panel
  // opens, and keep them synced if they change elsewhere — otherwise the
  // dropdowns can show "Default"/a stale pick that doesn't match what's live.
  useEffect(() => {
    if (!open || !room) return;
    const prefs = readPrefs();
    // LiveKit seeds getActiveDevice() with the literal "default" before any
    // track is live; that won't match an enumerated <option>, so treat it as
    // "no explicit pick" and fall back to the saved pref (keeps the "Default"
    // option rendering instead of a blank/mismatched select).
    const real = (kind: Kind): string | undefined => {
      const id = room.getActiveDevice(kind);
      return id && id !== "default" ? id : undefined;
    };
    setActive({
      audioinput: real("audioinput") ?? prefs.audioinput,
      videoinput: real("videoinput") ?? prefs.videoinput,
      audiooutput: real("audiooutput") ?? prefs.audiooutput,
    });
    function onActive(kind: MediaDeviceKind, deviceId: string) {
      setActive((prev) => ({ ...prev, [kind]: deviceId === "default" ? undefined : deviceId }));
    }
    room.on(RoomEvent.ActiveDeviceChanged, onActive);
    return () => { room.off(RoomEvent.ActiveDeviceChanged, onActive); };
  }, [open, room]);

  // setSinkId (output-device selection) support — false on Safari/iOS.
  useEffect(() => {
    setOutputSupported(
      typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype,
    );
  }, []);

  async function pickDevice(kind: Kind, deviceId: string) {
    if (!room || !deviceId) return;
    setDeviceError(null);
    try {
      if (kind === "videoinput") {
        // Routed through the background-effects hook: it detaches the blur/scene
        // processor before the swap and re-attaches after (avoids the Safari
        // blank-tile from LiveKit's in-switch processor.restart()).
        const ok = await onSwitchCamera(deviceId);
        if (!ok) {
          setDeviceError("Couldn't switch camera. Please try again.");
          return;
        }
      } else {
        await room.switchActiveDevice(kind, deviceId);
      }
      setActive((prev) => ({ ...prev, [kind]: deviceId }));
      writePref(kind, deviceId);
    } catch {
      // onSwitchCamera handles its own errors and the speaker select only renders
      // where output switching is supported, so this realistically catches a mic
      // switch failure — keep the message generic.
      setDeviceError("Couldn't switch device. Please try again.");
    }
  }

  const audioInputs = devices.filter((d) => d.kind === "audioinput");
  const audioOutputs = devices.filter((d) => d.kind === "audiooutput");
  const videoInputs = devices.filter((d) => d.kind === "videoinput");

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      const url = blob.url;
      // Save to DB
      const res = await fetch("/api/account/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: url }),
      });
      if (!res.ok) throw new Error("Failed to save");
      // Broadcast to room immediately via participant metadata
      const meta = getMetadata(localParticipant);
      await localParticipant.setMetadata(JSON.stringify({ ...meta, avatarUrl: url }));
      onAvatarChange(url);
    } catch (e) {
      console.error("Avatar upload failed:", e);
      setError("Upload failed. Please try again.");
    }
    setUploading(false);
  }

  async function handleAvatarRemove() {
    setError(null);
    try {
      await fetch("/api/account/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: null }),
      });
      const meta = getMetadata(localParticipant);
      await localParticipant.setMetadata(JSON.stringify({ ...meta, avatarUrl: null }));
      onAvatarChange(null);
    } catch {
      setError("Could not remove photo.");
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="rim-settings-backdrop" onClick={onClose} />
      <aside className="rim-settings">
        <div className="rim-settings__header">
          <span className="rim-settings__title">Settings</span>
          <button className="rim-settings__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="rim-settings__body">

          {/* Audio */}
          <section className="rim-settings__section">
            <div className="rim-settings__label">Audio</div>
            <div className="rim-settings__hint">Choose your microphone and speaker.</div>
            <div className="rim-settings__field">
              <label className="rim-settings__field-label" htmlFor="rim-settings-mic">Microphone</label>
              <select
                id="rim-settings-mic"
                className="rim-settings__select"
                value={active.audioinput ?? ""}
                onChange={(e) => pickDevice("audioinput", e.target.value)}
              >
                {audioInputs.length === 0 && <option value="">No microphones detected</option>}
                {audioInputs.length > 0 && !active.audioinput && <option value="">Default</option>}
                {audioInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</option>
                ))}
              </select>
            </div>
            <div className="rim-settings__field">
              <label className="rim-settings__field-label" htmlFor="rim-settings-spk">Speaker</label>
              {outputSupported ? (
                <select
                  id="rim-settings-spk"
                  className="rim-settings__select"
                  value={active.audiooutput ?? ""}
                  onChange={(e) => pickDevice("audiooutput", e.target.value)}
                  disabled={audioOutputs.length === 0}
                >
                  {audioOutputs.length === 0 && <option value="">System default</option>}
                  {audioOutputs.length > 0 && !active.audiooutput && <option value="">Default</option>}
                  {audioOutputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || "Speaker"}</option>
                  ))}
                </select>
              ) : (
                <p className="rim-settings__hint">
                  Your browser sends audio to your system&apos;s default speaker — choose it in your
                  device or sound settings.
                </p>
              )}
            </div>
            {deviceError && <p className="rim-settings__error">{deviceError}</p>}
          </section>

          {/* Video */}
          <section className="rim-settings__section">
            <div className="rim-settings__label">Video</div>
            <div className="rim-settings__hint">Choose your camera.</div>
            <div className="rim-settings__field">
              <label className="rim-settings__field-label" htmlFor="rim-settings-cam">Camera</label>
              <select
                id="rim-settings-cam"
                className="rim-settings__select"
                value={active.videoinput ?? ""}
                onChange={(e) => pickDevice("videoinput", e.target.value)}
              >
                {videoInputs.length === 0 && <option value="">No cameras detected</option>}
                {videoInputs.length > 0 && !active.videoinput && <option value="">Default</option>}
                {videoInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || "Camera"}</option>
                ))}
              </select>
            </div>
          </section>

          {/* Background — blur / scene / none. Off by default (calm-first),
              available to everyone, hidden where the browser can't run it. */}
          <section className="rim-settings__section">
            <div className="rim-settings__label">Background</div>
            {backgroundAvailable ? (
              <>
                <div className="rim-settings__hint">
                  Blur your background for privacy, or choose a calm scene. Off by default.
                </div>
                <div className="rim-settings__bg-options">
                  <button
                    type="button"
                    className={`rim-settings__bg-opt${backgroundMode === "none" ? " rim-settings__bg-opt--active" : ""}`}
                    onClick={onBackgroundNone}
                    disabled={backgroundPending}
                  >
                    None
                  </button>
                  <button
                    type="button"
                    className={`rim-settings__bg-opt${backgroundMode === "blur" ? " rim-settings__bg-opt--active" : ""}`}
                    onClick={onBackgroundBlur}
                    disabled={backgroundPending}
                  >
                    Blur
                  </button>
                  {BACKGROUND_SCENES.map((scene) => (
                    <button
                      key={scene.id}
                      type="button"
                      className={`rim-settings__bg-thumb${backgroundMode === "image" && backgroundImagePath === scene.path ? " rim-settings__bg-thumb--active" : ""}`}
                      style={{ backgroundImage: `url(${scene.path})` }}
                      onClick={() => onBackgroundImage(scene.path)}
                      disabled={backgroundPending}
                      title={scene.label}
                      aria-label={`Background: ${scene.label}`}
                    />
                  ))}
                </div>
                {backgroundMode === "blur" && (
                  <div className="rim-settings__slider-row">
                    <span className="rim-settings__slider-label">Strength</span>
                    <input
                      type="range"
                      className="rim-settings__slider"
                      min={BLUR_RADIUS_MIN}
                      max={BLUR_RADIUS_MAX}
                      value={blurRadius}
                      onChange={(e) => onBlurRadiusChange(Number(e.target.value))}
                      disabled={backgroundPending}
                    />
                    <span className="rim-settings__slider-val">{blurRadius}</span>
                  </div>
                )}
                {backgroundCpuPaused && (
                  <p className="rim-settings__bg-note">
                    Paused to keep your video smooth on this device. Tap an option to try again.
                  </p>
                )}
                {backgroundPending && <p className="rim-settings__bg-note">Applying…</p>}
              </>
            ) : (
              <div className="rim-settings__hint">
                Background effects aren&apos;t supported in this browser.
              </div>
            )}
          </section>

          <section className="rim-settings__section">
            <div className="rim-settings__label">Presence photo</div>
            <div className="rim-settings__hint">
              Shown on your tile when your camera is off. Also available in your account settings.
            </div>
            <div className="rim-settings__avatar-row">
              {avatarUrl ? (
                <div
                  className="rim-settings__avatar-preview"
                  style={{ backgroundImage: `url(${avatarUrl})` }}
                />
              ) : (
                <div className="rim-settings__avatar-empty">No photo</div>
              )}
              <div className="rim-settings__avatar-actions">
                <button
                  className="rim-settings__avatar-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Add photo"}
                </button>
                {avatarUrl && (
                  <button className="rim-settings__avatar-remove" onClick={handleAvatarRemove}>
                    Remove
                  </button>
                )}
              </div>
            </div>
            {error && <p className="rim-settings__error">{error}</p>}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="rim-settings__file-input"
              onChange={handleAvatarUpload}
            />
          </section>
        </div>
      </aside>
    </>
  );
}
