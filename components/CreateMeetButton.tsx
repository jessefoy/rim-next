"use client";

/**
 * CreateMeetButton — volunteer programs page
 *
 * States:
 *   idle       — shows volunteer email input + "Create Google Meet" button
 *   loading    — spinner while API call in flight
 *   done       — shows the generated Meet link
 *   replace    — confirm dialog when a link already exists
 *
 * CSS prefix: vol-meet-
 */

import { useState } from "react";

interface Props {
  programSlug: string;
  existingLink?: string | null;
  hasStartDatetime: boolean;
}

type UIState = "idle" | "loading" | "done" | "replace";

export default function CreateMeetButton({
  programSlug,
  existingLink,
  hasStartDatetime,
}: Props) {
  const [state, setState] = useState<UIState>(existingLink ? "done" : "idle");
  const [volunteerEmail, setVolunteerEmail] = useState("");
  const [meetLink, setMeetLink] = useState(existingLink ?? "");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [moderationEnabled, setModerationEnabled] = useState<boolean | null>(null);

  if (!hasStartDatetime) {
    return (
      <p className="vol-meet__notice">
        Add a <strong>Start Date &amp; Time</strong> in Sanity Studio to enable Google Meet creation.
      </p>
    );
  }

  async function handleCreate() {
    setError("");
    setWarning("");

    const email = volunteerEmail.trim();
    if (!email) {
      setError("Enter the volunteer's email address.");
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    setState("loading");

    try {
      const res = await fetch(`/api/programs/${programSlug}/google-meet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volunteerEmail: email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setState(existingLink ? "done" : "idle");
        return;
      }

      setMeetLink(data.meetLink);
      setModerationEnabled(data.moderationEnabled ?? null);
      if (data.warning) setWarning(data.warning);
      setState("done");
    } catch {
      setError("Network error. Please try again.");
      setState(existingLink ? "done" : "idle");
    }
  }

  // ── Existing link — show link + Replace button ─────────────────────────────
  if (state === "done") {
    return (
      <div className="vol-meet">
        <p className="vol-meet__label">Google Meet</p>
        <div className="vol-meet__link-row">
          <a
            href={meetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="vol-meet__link"
          >
            {meetLink}
          </a>
          <button
            className="vol-meet__replace-btn"
            onClick={() => setState("replace")}
          >
            Replace
          </button>
        </div>
        {moderationEnabled === false && (
          <p className="vol-meet__tier-notice">
            ℹ️ Co-host controls are not available on the free tier. The volunteer will join as a trusted participant with access to the meeting.
          </p>
        )}
        {warning && <p className="vol-meet__warning">{warning}</p>}
      </div>
    );
  }

  // ── Replace confirm dialog ─────────────────────────────────────────────────
  if (state === "replace") {
    return (
      <div className="vol-meet">
        <p className="vol-meet__label">Google Meet</p>
        <p className="vol-meet__confirm-text">
          This will create a new Meet link and overwrite the current one in Sanity. The old link will stop working.
        </p>
        <div className="vol-meet__form-row">
          <input
            type="email"
            className="vol-meet__input"
            placeholder="Volunteer email"
            value={volunteerEmail}
            onChange={(e) => setVolunteerEmail(e.target.value)}
            autoFocus
          />
          <button className="vol-meet__create-btn" onClick={handleCreate}>
            Create New Link
          </button>
          <button
            className="vol-meet__cancel-btn"
            onClick={() => { setState("done"); setError(""); }}
          >
            Cancel
          </button>
        </div>
        {error && <p className="vol-meet__error">{error}</p>}
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (state === "loading") {
    return (
      <div className="vol-meet">
        <p className="vol-meet__label">Google Meet</p>
        <p className="vol-meet__loading">Creating Google Meet…</p>
      </div>
    );
  }

  // ── Idle — main form ───────────────────────────────────────────────────────
  return (
    <div className="vol-meet">
      <p className="vol-meet__label">Google Meet</p>
      <div className="vol-meet__form-row">
        <input
          type="email"
          className="vol-meet__input"
          placeholder="Volunteer host email (e.g. name@rootedinmindfulness.org)"
          value={volunteerEmail}
          onChange={(e) => setVolunteerEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <button className="vol-meet__create-btn" onClick={handleCreate}>
          Create Google Meet
        </button>
      </div>
      {error && <p className="vol-meet__error">{error}</p>}
    </div>
  );
}
