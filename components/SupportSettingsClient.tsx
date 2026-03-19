"use client";

/**
 * SupportSettingsClient — Settings for the Support Hub.
 * CSS prefix: si-
 *
 * Sections:
 * 1. Gmail Connection (ADMIN only)
 * 2. Default Assignee (ADMIN only)
 * 3. Email Templates (ADMIN only)
 * 4. Re-match Members (ADMIN only)
 * 5. My Signature (all support members)
 * 6. Email Notifications (all support members)
 */

import { useState } from "react";
import RimProseEditor from "./RimProseEditor";
import { renderBlockNoteHtml } from "@/lib/renderRichContent";

interface TemplateData {
  id: string;
  name: string;
  subject: string;
  body: any;
  createdBy: string;
  updatedAt: string;
}

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
  initialTemplates?: TemplateData[];
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
  initialTemplates = [],
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

  // Templates
  const [templates, setTemplates] = useState<TemplateData[]>(initialTemplates);
  const [tplEditing, setTplEditing] = useState<string | null>(null); // template id or "new"
  const [tplName, setTplName] = useState("");
  const [tplSubject, setTplSubject] = useState("");
  const [tplBody, setTplBody] = useState<any>(null);
  const [tplSaving, setTplSaving] = useState(false);
  const [tplDeleting, setTplDeleting] = useState<string | null>(null);

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

  // Template CRUD
  const startNewTemplate = () => {
    setTplEditing("new");
    setTplName("");
    setTplSubject("");
    setTplBody(null);
  };

  const startEditTemplate = (t: TemplateData) => {
    setTplEditing(t.id);
    setTplName(t.name);
    setTplSubject(t.subject);
    setTplBody(t.body);
  };

  const cancelTemplateEdit = () => {
    setTplEditing(null);
    setTplName("");
    setTplSubject("");
    setTplBody(null);
  };

  const handleSaveTemplate = async () => {
    if (!tplName.trim()) return;
    setTplSaving(true);

    if (tplEditing === "new") {
      const res = await fetch("/api/support/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tplName, subject: tplSubject, body: tplBody }),
      });
      if (res.ok) {
        // Refresh template list
        const listRes = await fetch("/api/support/templates");
        if (listRes.ok) {
          const data = await listRes.json();
          setTemplates(data.templates);
        }
        cancelTemplateEdit();
      }
    } else {
      const res = await fetch(`/api/support/templates/${tplEditing}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tplName, subject: tplSubject, body: tplBody }),
      });
      if (res.ok) {
        const listRes = await fetch("/api/support/templates");
        if (listRes.ok) {
          const data = await listRes.json();
          setTemplates(data.templates);
        }
        cancelTemplateEdit();
      }
    }

    setTplSaving(false);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm("Delete this template?")) return;
    setTplDeleting(id);
    const res = await fetch(`/api/support/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      if (tplEditing === id) cancelTemplateEdit();
    }
    setTplDeleting(null);
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

      {/* Email Templates — ADMIN only */}
      {isAdmin && (
        <section className="si-settings__section">
          <h2 className="si-settings__heading">Email Templates</h2>
          <p className="si-settings__desc">
            Reusable templates for common replies and outbound emails. Templates
            can pre-fill both the subject line and body when composing a new
            email or replying to a thread.
          </p>

          {/* Template list */}
          {templates.length > 0 && !tplEditing && (
            <div className="si-tpl-list">
              {templates.map((t) => (
                <div key={t.id} className="si-tpl-item">
                  <div className="si-tpl-item__info">
                    <span className="si-tpl-item__name">{t.name}</span>
                    {t.subject && (
                      <span className="si-tpl-item__subject">{t.subject}</span>
                    )}
                  </div>
                  <div className="si-tpl-item__actions">
                    <button
                      className="si-btn si-btn--small"
                      onClick={() => startEditTemplate(t)}
                    >
                      Edit
                    </button>
                    <button
                      className="si-btn si-btn--small si-btn--danger"
                      onClick={() => handleDeleteTemplate(t.id)}
                      disabled={tplDeleting === t.id}
                    >
                      {tplDeleting === t.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {templates.length === 0 && !tplEditing && (
            <p className="si-settings__meta" style={{ marginBottom: 12 }}>
              No templates yet.
            </p>
          )}

          {/* Edit / Create form */}
          {tplEditing && (
            <div className="si-tpl-editor">
              <div className="si-tpl-editor__header">
                {tplEditing === "new" ? "New Template" : "Edit Template"}
              </div>
              <div className="si-settings__form">
                <label className="si-settings__label">
                  Template Name
                  <input
                    type="text"
                    className="si-settings__input"
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    placeholder="e.g. Welcome Reply"
                  />
                </label>

                <label className="si-settings__label">
                  Subject Line{" "}
                  <span className="si-settings__optional">
                    (optional — used in Compose)
                  </span>
                  <input
                    type="text"
                    className="si-settings__input"
                    value={tplSubject}
                    onChange={(e) => setTplSubject(e.target.value)}
                    placeholder="e.g. Welcome to Rooted in Mindfulness"
                  />
                </label>

                <label className="si-settings__label">Body</label>
                <RimProseEditor
                  key={`tpl-${tplEditing}`}
                  value={tplBody}
                  onChange={setTplBody}
                  placeholder="Write the template body…"
                  minHeight={160}
                />

                {/* Preview */}
                {tplBody && (
                  <div className="si-settings__preview">
                    <div className="si-settings__preview-label">Preview</div>
                    <div
                      className="si-settings__preview-body"
                      dangerouslySetInnerHTML={{
                        __html: renderBlockNoteHtml(tplBody),
                      }}
                    />
                  </div>
                )}

                <div className="si-settings__actions">
                  <button
                    className="si-btn"
                    onClick={cancelTemplateEdit}
                  >
                    Cancel
                  </button>
                  <button
                    className="si-btn si-btn--send"
                    onClick={handleSaveTemplate}
                    disabled={tplSaving || !tplName.trim()}
                  >
                    {tplSaving
                      ? "Saving…"
                      : tplEditing === "new"
                        ? "Create Template"
                        : "Save Template"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!tplEditing && (
            <div className="si-settings__actions" style={{ marginTop: 12 }}>
              <button
                className="si-btn si-btn--send"
                onClick={startNewTemplate}
              >
                + New Template
              </button>
            </div>
          )}
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
