"use client";

/**
 * SupportSettingsClient — Settings for the Support Hub.
 * CSS prefix: si-
 *
 * Sections:
 * 1. Gmail Connection (ADMIN only)
 * 2. Default Assignee (ADMIN only)
 * 3. Re-match Members (ADMIN only)
 * 4. My Signature (all support members)
 * 5. Email Notifications (all support members)
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
  emailNotifications: boolean;
  defaultAssigneeId: string | null;
  supportTeam: { id: string; name: string }[];
}

export default function SupportSettingsClient({
  isAdmin,
  connected,
  credentialEmail,
  credentialExpires,
  initialSignature,
  emailNotifications,
  defaultAssigneeId,
  supportTeam,
}: Props) {
  const [sig, setSig] = useState(initialSignature);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [assignee, setAssignee] = useState(defaultAssigneeId ?? "");
  const [assigneeSaving, setAssigneeSaving] = useState(false);
  const [assigneeSaved, setAssigneeSaved] = useState(false);

  const [rematching, setRematching] = useState(false);
  const [rematchResult, setRematchResult] = useState<string | null>(null);

  const [notifEnabled, setNotifEnabled] = useState(emailNotifications);
  const [notifSaving, setNotifSaving] = useState(false);

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

  const handleSaveAssignee = async (value: string) => {
    setAssignee(value);
    setAssigneeSaving(true);
    setAssigneeSaved(false);
    await fetch("/api/support/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "support.defaultAssigneeId",
        value: value || null,
      }),
    });
    setAssigneeSaving(false);
    setAssigneeSaved(true);
    setTimeout(() => setAssigneeSaved(false), 3000);
  };

  const handleRematch = async () => {
    setRematching(true);
    setRematchResult(null);
    const res = await fetch("/api/support/rematch", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setRematchResult(
        data.matched > 0
          ? `Matched ${data.matched} thread${data.matched === 1 ? "" : "s"} to members.`
          : "No unmatched threads found."
      );
    } else {
      setRematchResult("Error re-matching threads.");
    }
    setRematching(false);
  };

  const handleToggleNotifications = async () => {
    const newValue = !notifEnabled;
    setNotifEnabled(newValue);
    setNotifSaving(true);
    await fetch("/api/support/settings/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: newValue }),
    });
    setNotifSaving(false);
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

      {/* Default Assignee — ADMIN only */}
      {isAdmin && (
        <section className="si-settings__section">
          <h2 className="si-settings__heading">Default Assignee</h2>
          <p className="si-settings__desc">
            New threads synced from Gmail will be automatically assigned to this
            person and marked as Claimed.
          </p>
          <div className="si-settings__actions">
            <select
              className="si-settings__input"
              value={assignee}
              onChange={(e) => handleSaveAssignee(e.target.value)}
              disabled={assigneeSaving}
            >
              <option value="">None — threads arrive as Open</option>
              {supportTeam.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {assigneeSaved && (
              <span className="si-settings__saved">Saved</span>
            )}
          </div>
        </section>
      )}

      {/* Re-match Members — ADMIN only */}
      {isAdmin && (
        <section className="si-settings__section">
          <h2 className="si-settings__heading">Re-match Member Threads</h2>
          <p className="si-settings__desc">
            Scan support threads that aren&rsquo;t linked to a member account
            and match them by email address. This runs automatically when new
            members register, but you can trigger it manually here.
          </p>
          <div className="si-settings__actions">
            <button
              className="si-btn si-btn--send"
              onClick={handleRematch}
              disabled={rematching}
            >
              {rematching ? "Matching…" : "Re-match Threads"}
            </button>
            {rematchResult && (
              <span className="si-settings__saved">{rematchResult}</span>
            )}
          </div>
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

      {/* Email Notifications */}
      <section className="si-settings__section">
        <h2 className="si-settings__heading">Email Notifications</h2>
        <p className="si-settings__desc">
          Receive an email when a thread is assigned to you or gets a new reply.
        </p>
        <label className="si-settings__toggle-label">
          <input
            type="checkbox"
            checked={notifEnabled}
            onChange={handleToggleNotifications}
            disabled={notifSaving}
          />
          <span>
            {notifEnabled
              ? "Email notifications are on"
              : "Email notifications are off"}
          </span>
        </label>
      </section>
    </div>
  );
}
