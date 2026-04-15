"use client";

/**
 * VideoSettingsPanel — gear icon opens this overlay.
 *
 * Controls:
 * - Background blur (via @livekit/track-processors — affects outgoing stream)
 * - Brightness / contrast (CSS filter on local display — adjusts your preview only)
 * - Presence photo: upload or clear (saves to /api/account/avatar and updates room metadata)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { upload } from "@vercel/blob/client";
import type { LocalParticipant, LocalVideoTrack } from "livekit-client";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inject / update a CSS filter on all video elements in the conference.
  // This is a local display adjustment — it does not affect what others see of you.
  useEffect(() => {
    const id = "rim-video-filter";
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = id;
      document.head.appendChild(style);
    }
    if (brightness === 1.0 && contrast === 1.0) {
      style.textContent = "";
    } else {
      style.textContent = `.rim-conference video { filter: brightness(${brightness}) contrast(${contrast}); }`;
    }
  }, [brightness, contrast]);

  // Remove the injected style when the session ends (component unmounts)
  useEffect(() => {
    return () => { document.getElementById("rim-video-filter")?.remove(); };
  }, []);

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
      // Recover camera if blur fails to load
      try { await track.stopProcessor(); } catch {}
      setBlurEnabled(false);
    }
    setBlurLoading(false);
  }, [blurEnabled, blurStrength, localParticipant]);

  const updateBlurStrength = useCallback(async (value: number) => {
    setBlurStrength(value);
    if (blurEnabled) {
      const track = getLocalVideoTrack(localParticipant);
      if (!track) return;
      try {
        const { BackgroundBlur } = await import("@livekit/track-processors");
        await track.setProcessor(BackgroundBlur(value));
      } catch (e) {
        console.error("Blur strength update error:", e);
      }
    }
  }, [blurEnabled, localParticipant]);

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
      // Update in room metadata immediately so others see it
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

          {/* Brightness / contrast */}
          <section className="rim-settings__section">
            <div className="rim-settings__label">Brightness &amp; contrast</div>
            <div className="rim-settings__hint">Adjusts your local display — helpful in a dim room.</div>
            <div className="rim-settings__slider-row">
              <label className="rim-settings__slider-label">Brightness</label>
              <input
                type="range" min={0.5} max={2.0} step={0.05}
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="rim-settings__slider"
              />
              <span className="rim-settings__slider-val">
                {Math.round((brightness - 1) * 100) > 0 ? "+" : ""}{Math.round((brightness - 1) * 100)}%
              </span>
            </div>
            <div className="rim-settings__slider-row">
              <label className="rim-settings__slider-label">Contrast</label>
              <input
                type="range" min={0.5} max={2.0} step={0.05}
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="rim-settings__slider"
              />
              <span className="rim-settings__slider-val">
                {Math.round((contrast - 1) * 100) > 0 ? "+" : ""}{Math.round((contrast - 1) * 100)}%
              </span>
            </div>
            {(brightness !== 1 || contrast !== 1) && (
              <button
                className="rim-settings__reset"
                onClick={() => { setBrightness(1.0); setContrast(1.0); }}
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
