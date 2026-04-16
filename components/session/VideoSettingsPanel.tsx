"use client";

/**
 * VideoSettingsPanel — settings overlay (⚙ button in toolbar).
 *
 * Presence photo: upload from this panel or from /account/settings.
 * - Saved to DB via PATCH /api/account/avatar
 * - Broadcast to the room immediately via participant metadata
 * - Shown on your tile when camera is off
 */

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import type { LocalParticipant } from "livekit-client";
import type { ParticipantMetadata } from "./RIMParticipantTile";

interface Props {
  open: boolean;
  onClose: () => void;
  localParticipant: LocalParticipant;
  avatarUrl: string | null;
  onAvatarChange: (url: string | null) => void;
}

function getMetadata(p: LocalParticipant): ParticipantMetadata {
  try { return JSON.parse(p.metadata || "{}"); } catch { return {}; }
}

export default function VideoSettingsPanel({ open, onClose, localParticipant, avatarUrl, onAvatarChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
