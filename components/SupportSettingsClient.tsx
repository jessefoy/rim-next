"use client";

/**
 * SupportSettingsClient — Settings for the Support Hub.
 * CSS prefix: si-
 *
 * Sections:
 * 1. Gmail Connection (ADMIN only) — status + connect button
 * 2. My Signature — name, role, tagline for email replies
 */

import { useState } from "react";

interface Props {
  isAdmin: boolean;
  connected: boolean;
  credentialEmail: string | null;
  credentialExpires: string | null;
  initialSignature: {
    name: string;
    role: string;
    tagline: string;
  };
}

export default function SupportSettingsClient({
  isAdmin,
  connected,
  credentialEmail,
  credentialExpires,
  initialSignature,
}: Props) {
  const [sig, setSig] = useState(initialSignature);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveSignature = async () => {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/support/signature", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sig),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  return (
    <div className="si-settings">
      {/* Gmail Connection — ADMIN only */}
      {isAdmin && (
        <section className="si-settings__section">
          <h2 className="si-settings__heading">Gmail Connection</h2>

          {connected && (
            <div className="si-settings__success">
              Gmail connected successfully.
            </div>
          )}

          {credentialEmail ? (
            <div>
              <p className="si-settings__value">
                <strong>{credentialEmail}</strong> — Connected
              </p>
              {credentialExpires && (
                <p className="si-settings__meta">
                  Token expires:{" "}
                  {new Date(credentialExpires).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="si-settings__desc">
                No Gmail account connected. Connect
                support@rootedinmindfulness.org to start receiving messages.
              </p>
              <a href="/api/auth/gmail/connect" className="si-btn si-btn--send">
                Connect Gmail
              </a>
            </div>
          )}
        </section>
      )}

      {/* My Signature */}
      <section className="si-settings__section">
        <h2 className="si-settings__heading">My Signature</h2>
        <p className="si-settings__desc">
          This signature is appended to your outbound replies from the support
          inbox.
        </p>

        <div className="si-settings__form">
          <label className="si-settings__label">
            Name
            <input
              type="text"
              className="si-settings__input"
              value={sig.name}
              onChange={(e) => setSig({ ...sig, name: e.target.value })}
              placeholder="Your display name"
            />
          </label>

          <label className="si-settings__label">
            Role <span className="si-settings__optional">(optional)</span>
            <input
              type="text"
              className="si-settings__input"
              value={sig.role}
              onChange={(e) => setSig({ ...sig, role: e.target.value })}
              placeholder="e.g. Support Team"
            />
          </label>

          <label className="si-settings__label">
            Tagline
            <input
              type="text"
              className="si-settings__input"
              value={sig.tagline}
              onChange={(e) => setSig({ ...sig, tagline: e.target.value })}
              placeholder="e.g. May you be well."
            />
          </label>

          {/* Preview */}
          {sig.name && sig.tagline && (
            <div className="si-settings__preview">
              <div className="si-settings__preview-label">Preview</div>
              <div className="si-settings__preview-body">
                <strong>{sig.name}</strong>
                <br />
                {sig.role && (
                  <>
                    {sig.role}
                    <br />
                  </>
                )}
                {sig.tagline}
                <br />
                Rooted in Mindfulness · rootedinmindfulness.org
              </div>
            </div>
          )}

          <div className="si-settings__actions">
            <button
              className="si-btn si-btn--send"
              onClick={handleSaveSignature}
              disabled={saving || !sig.name || !sig.tagline}
            >
              {saving ? "Saving…" : "Save Signature"}
            </button>
            {saved && (
              <span className="si-settings__saved">Saved</span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
