"use client";

/**
 * VideoSettingsPanel — gear icon opens this overlay.
 *
 * Controls:
 * - Background blur (via @livekit/track-processors — affects outgoing stream)
 * - Brightness / contrast (via BrightnessProcessor — affects outgoing stream)
 * - Presence photo: upload or clear (saves to /api/account/avatar and updates room metadata)
 *
 * Both blur and brightness processors affect what others see of you, not just your preview.
 */

import { useState, useRef, useCallback } from "react";
import { upload } from "@vercel/blob/client";
import type { LocalParticipant, LocalVideoTrack } from "livekit-client";
import { BrightnessProcessor } from "./BrightnessProcessor";
import type { ParticipantMetadata } from "./RIMParticipantTile";

interface Props {
  open: boolean;
  onClose: () => void;
  localParticipant: LocalParticipant;
  avatarUrl: string | null;
  onAvatarChange: (url: string | null) => void;
}

function getLocalVideoTrack(p: LocalParticipant): LocalVideoTrack | null {
  for (const pub of p.videoTrackPublications.values()) {
    if (pub.track) return pub.track as LocalVideoTrack;
  }
  return null;
}

function getMetadata(p: LocalParticipant): ParticipantMetadata {
  try { return JSON.parse(p.metadata || "{}"); } catch { return {}; }
}

export default function VideoSettingsPanel({ open, onClose, localParticipant, avatarUrl, onAvatarChange }: Props) {
  const [blurEnabled, setBlurEnabled] = useState(false);
  const [blurStrength, setBlurStrength] = useState(10);
  const [brightness, setBrightness] = useState(1.0);
  const [contrast, setContrast] = useState(1.0);
  const [uploading, setUploading] = useState(false);
  const [blurLoading, setBlurLoading] = useState(false);

  const brightnessProcessorRef = useRef<BrightnessProcessor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Blur ---
  const toggleBlur = useCallback(async () => {
    const track = getLocalVideoTrack(localParticipant);
    if (!track) return;
    setBlurLoading(true);
    try {
      if (blurEnabled) {
        await track.stopProcessor();
        setBlurEnabled(false);
      } else {
        const { BackgroundBlur } = await import("@livekit/track-processors");
        await track.setProcessor(BackgroundBlur(blurStrength));
        setBlurEnabled(true);
      }
    } catch (e) {
      console.error("Blur error:", e);
    }
    setBlurLoading(false);
  }, [blurEnabled, blurStrength, localParticipant]);

  const updateBlurStrength = useCallback(async (value: number) => {
    setBlurStrength(value);
    if (blurEnabled) {
      const track = getLocalVideoTrack(localParticipant);
      if (!track) return;
      const { BackgroundBlur } = await import("@livekit/track-processors");
      await track.setProcessor(BackgroundBlur(value));
    }
  }, [blurEnabled, localParticipant]);

  // --- Brightness / Contrast ---
  const applyBrightness = useCallback(async (b: number, c: number) => {
    const track = getLocalVideoTrack(localParticipant);
    if (!track) return;
    // If values are default (1, 1) and no processor active, skip
    if (b === 1.0 && c === 1.0 && !brightnessProcessorRef.current) return;

    if (brightnessProcessorRef.current) {
      brightnessProcessorRef.current.setValues(b, c);
      if (b === 1.0 && c === 1.0) {
        await track.stopProcessor();
        brightnessProcessorRef.current = null;
      }
    } else if (b !== 1.0 || c !== 1.0) {
      const processor = new BrightnessProcessor(b, c);
      brightnessProcessorRef.current = processor;
      await track.setProcessor(processor as Parameters<typeof track.setProcessor>[0]);
    }
  }, [localParticipant]);

  const handleBrightness = useCallback(async (value: number) => {
    setBrightness(value);
    await applyBrightness(value, contrast);
  }, [applyBrightness, contrast]);

  const handleContrast = useCallback(async (value: number) => {
    setContrast(value);
    await applyBrightness(brightness, value);
  }, [applyBrightness, brightness]);

  // --- Avatar upload ---
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      const url = blob.url;
      // Save to DB
      await fetch("/api/account/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: url }),
      });
      // Update in room metadata immediately
      const meta = getMetadata(localParticipant);
      localParticipant.setMetadata(JSON.stringify({ ...meta, avatarUrl: url }));
      onAvatarChange(url);
    } catch (e) {
      console.error("Avatar upload failed:", e);
    }
    setUploading(false);
  }

  async function handleAvatarRemove() {
    await fetch("/api/account/avatar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl: null }),
    });
    const meta = getMetadata(localParticipant);
    localParticipant.setMetadata(JSON.stringify({ ...meta, avatarUrl: null }));
    onAvatarChange(null);
  }

  if (!open) return null;

  return (
    <>
      <div className="rim-settings-backdrop" onClick={onClose} />
      <aside className="rim-settings">
        <div className="rim-settings__header">
          <span className="rim-settings__title">Video Settings</span>
          <button className="rim-settings__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="rim-settings__body">

          {/* Background blur */}
          <section className="rim-settings__section">
            <div className="rim-settings__row">
              <div>
                <div className="rim-settings__label">Background blur</div>
                <div className="rim-settings__hint">Hides your surroundings. Others see a soft background.</div>
              </div>
              <button
                className={`rim-settings__toggle${blurEnabled ? " rim-settings__toggle--on" : ""}`}
                onClick={toggleBlur}
                disabled={blurLoading}
              >
                {blurLoading ? "…" : blurEnabled ? "On" : "Off"}
              </button>
            </div>
            {blurEnabled && (
              <div className="rim-settings__slider-row">
                <label className="rim-settings__slider-label">Strength</label>
                <input
                  type="range" min={2} max={20} step={1}
                  value={blurStrength}
                  onChange={(e) => updateBlurStrength(Number(e.target.value))}
                  className="rim-settings__slider"
                />
                <span className="rim-settings__slider-val">{blurStrength}</span>
              </div>
            )}
          </section>

          {/* Brightness */}
          <section className="rim-settings__section">
            <div className="rim-settings__label">Brightness &amp; contrast</div>
            <div className="rim-settings__hint">Helps if you are in a dim room. Adjusts what others see of you.</div>
            <div className="rim-settings__slider-row">
              <label className="rim-settings__slider-label">Brightness</label>
              <input
                type="range" min={0.5} max={2.0} step={0.05}
                value={brightness}
                onChange={(e) => handleBrightness(Number(e.target.value))}
                className="rim-settings__slider"
              />
              <span className="rim-settings__slider-val">{Math.round((brightness - 1) * 100) > 0 ? "+" : ""}{Math.round((brightness - 1) * 100)}%</span>
            </div>
            <div className="rim-settings__slider-row">
              <label className="rim-settings__slider-label">Contrast</label>
              <input
                type="range" min={0.5} max={2.0} step={0.05}
                value={contrast}
                onChange={(e) => handleContrast(Number(e.target.value))}
                className="rim-settings__slider"
              />
              <span className="rim-settings__slider-val">{Math.round((contrast - 1) * 100) > 0 ? "+" : ""}{Math.round((contrast - 1) * 100)}%</span>
            </div>
            {(brightness !== 1 || contrast !== 1) && (
              <button
                className="rim-settings__reset"
                onClick={() => { handleBrightness(1.0); handleContrast(1.0); }}
              >
                Reset to default
              </button>
            )}
          </section>

          {/* Presence photo */}
          <section className="rim-settings__section">
            <div className="rim-settings__label">Presence photo</div>
            <div className="rim-settings__hint">
              Shown when your camera is off. Saved to your profile — you can also set it from your account settings.
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
