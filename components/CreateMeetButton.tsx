"use client";

/**
 * CreateMeetButton — registrar programs page
 *
 * States:
 *   idle     — shows "Create Google Meet" button
 *   loading  — spinner while create API call in flight
 *   done     — shows the Meet link + host account + Remove button
 *   remove   — confirm dialog before deleting the room booking
 *   removing — spinner while delete API call in flight
 *
 * CSS prefix: vol-meet-
 */

import { useState } from "react";

interface Props {
  programSlug: string;
  existingLink?: string | null;
  existingHostAccount?: string | null;
  hasStartDatetime: boolean;
}

type UIState = "idle" | "loading" | "done" | "remove" | "removing";

export default function CreateMeetButton({
  programSlug,
  existingLink,
  existingHostAccount,
  hasStartDatetime,
}: Props) {
  const [state, setState] = useState<UIState>(existingLink ? "done" : "idle");
  const [meetLink, setMeetLink] = useState(existingLink ?? "");
  const [roomEmail, setRoomEmail] = useState(existingHostAccount ?? "");
  const [error, setError] = useState("");

  if (!hasStartDatetime) {
    return (
      <p className="vol-meet__notice">
        Add a <strong>Start Date &amp; Time</strong> in Sanity Studio to enable Google Meet creation.
      </p>
    );
  }

  async function handleCreate() {
    setError("");
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
      setState("done");
    } catch {
      setError("Network error. Please try again.");
      setState(existingLink ? "done" : "idle");
    }
  }

  async function handleRemove() {
    setError("");
    setState("removing");

    try {
      const res = await fetch(`/api/programs/${programSlug}/google-meet`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setState("remove");
        return;
      }

      setMeetLink("");
      setRoomEmail("");
      setState("idle");
    } catch {
      setError("Network error. Please try again.");
      setState("remove");
    }
  }

  // ── Has a link ─────────────────────────────────────────────────────────────
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
            className="vol-meet__remove-btn"
            onClick={() => { setState("remove"); setError(""); }}
          >
            Remove Meet
          </button>
        </div>
        {roomEmail && (
          <p className="vol-meet__host-account">
            Host account: <strong>{roomEmail}</strong>
          </p>
        )}
      </div>
    );
  }

  // ── Remove confirm ─────────────────────────────────────────────────────────
  if (state === "remove") {
    return (
      <div className="vol-meet">
        <p className="vol-meet__label">Google Meet</p>
        <p className="vol-meet__confirm-text">
          This will delete the Google Calendar room booking and clear the Meet link.
          Only do this if the program is being rescheduled, cancelled, or switching to in-person.
          Anyone who already has the link will not be able to join.
        </p>
        <div className="vol-meet__form-row">
          <button className="vol-meet__remove-confirm-btn" onClick={handleRemove}>
            Yes, Remove Meet
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

  // ── Removing ───────────────────────────────────────────────────────────────
  if (state === "removing") {
    return (
      <div className="vol-meet">
        <p className="vol-meet__label">Google Meet</p>
        <p className="vol-meet__loading">Removing Meet…</p>
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

  // ── Idle ───────────────────────────────────────────────────────────────────
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
