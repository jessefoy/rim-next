"use client";

/**
 * CreateMeetButton — volunteer programs page
 *
 * States:
 *   idle     — shows "Create Google Meet" button
 *   loading  — spinner while API call in flight
 *   done     — shows the generated Meet link + host account
 *   replace  — confirm dialog when a link already exists
 *
 * CSS prefix: vol-meet-
 */

import { useState } from "react";

interface Props {
  programSlug: string;
  existingLink?: string | null;
  existingHostAccount?: string | null;
  calendarEventId?: string | null;
  hasStartDatetime: boolean;
}

type UIState = "idle" | "loading" | "done" | "replace";

export default function CreateMeetButton({
  programSlug,
  existingLink,
  existingHostAccount,
  calendarEventId: initialCalendarEventId,
  hasStartDatetime,
}: Props) {
  const [state, setState] = useState<UIState>(existingLink ? "done" : "idle");
  const [meetLink, setMeetLink] = useState(existingLink ?? "");
  const [roomEmail, setRoomEmail] = useState(existingHostAccount ?? "");
  const [calendarEventId, setCalendarEventId] = useState(initialCalendarEventId ?? "");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

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
    setState("loading");

    try {
      const res = await fetch(`/api/programs/${programSlug}/google-meet`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setState(existingLink ? "done" : "idle");
        return;
      }

      setMeetLink(data.meetLink);
      setRoomEmail(data.roomEmail ?? "");
      setCalendarEventId(data.calendarEventId ?? "");
      if (data.warning) setWarning(data.warning);
      setState("done");
    } catch {
      setError("Network error. Please try again.");
      setState(existingLink ? "done" : "idle");
    }
  }

  // ── Existing link — show link + host account + Replace button ──────────────
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
        {roomEmail && (
          <p className="vol-meet__host-account">
            Host account: <strong>{roomEmail}</strong>
          </p>
        )}
        <p className="vol-meet__calendar-status">
          {calendarEventId
            ? "✓ Room booking tracked — time changes in Sanity will update automatically"
            : "⚠ No calendar event ID — replace this link to enable automatic time sync"}
        </p>
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
          This will create a new Meet link and overwrite the current one in Sanity. The old link will stop working immediately — if it has already been shared outside the website, you will need to follow up with the new link manually.
        </p>
        <div className="vol-meet__form-row">
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

  // ── Idle — single button ───────────────────────────────────────────────────
  return (
    <div className="vol-meet">
      <p className="vol-meet__label">Google Meet</p>
      <div className="vol-meet__form-row">
        <button className="vol-meet__create-btn" onClick={handleCreate}>
          Create Google Meet
        </button>
      </div>
      {error && <p className="vol-meet__error">{error}</p>}
    </div>
  );
}
