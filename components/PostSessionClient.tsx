"use client";

/**
 * PostSessionClient — post-session form for the Host Team hub.
 *
 * Section 1: Flagged people — notes + routing
 * Section 2: Session reflection (open textarea, warm framing)
 * Section 3: Resource for the group (optional URL + note)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

const ACTION_OPTIONS = [
  { value: "NONE",             label: "No action needed" },
  { value: "GENTLE_FOLLOWUP", label: "Gentle follow-up (Jesse + coordinator)" },
  { value: "JESSE_ONLY",      label: "Jesse only — sensitive" },
  { value: "TECHNICAL_ISSUE", label: "Technical issue (coordinator)" },
] as const;

type ActionValue = typeof ACTION_OPTIONS[number]["value"];

interface FlaggedAttendee {
  attendanceId: string;
  displayName: string;
  note: string | null;
  action: string;
}

interface AllAttendee {
  attendanceId: string;
  displayName: string;
  flaggedByHost: boolean;
}

interface Props {
  programSlug: string;
  sessionDate: string;           // ISO string — midnight CT
  sessionDateDisplay: string;    // human-readable date
  flaggedAttendees: FlaggedAttendee[];
  allAttendees: AllAttendee[];
  existingReflection: string | null;
  existingResourceUrl: string | null;
  existingResourceNote: string | null;
  alreadySubmitted: boolean;
  backPath: string;
  apiPath: string;
}

export default function PostSessionClient({
  programSlug,
  sessionDate,
  sessionDateDisplay,
  flaggedAttendees: initialFlagged,
  allAttendees,
  existingReflection,
  existingResourceUrl,
  existingResourceNote,
  alreadySubmitted,
  backPath,
  apiPath,
}: Props) {
  const router = useRouter();

  // Flag states — keyed by attendanceId
  const [flagNotes, setFlagNotes] = useState<Record<string, string>>(
    Object.fromEntries(initialFlagged.map((f) => [f.attendanceId, f.note ?? ""]))
  );
  const [flagActions, setFlagActions] = useState<Record<string, ActionValue>>(
    Object.fromEntries(
      initialFlagged.map((f) => [
        f.attendanceId,
        (ACTION_OPTIONS.find((o) => o.value === f.action)?.value ?? "NONE") as ActionValue,
      ])
    )
  );

  const [reflection, setReflection] = useState(existingReflection ?? "");
  const [resourceUrl, setResourceUrl] = useState(existingResourceUrl ?? "");
  const [resourceNote, setResourceNote] = useState(existingResourceNote ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const flags = initialFlagged.map((f) => ({
      attendanceId: f.attendanceId,
      note:   flagNotes[f.attendanceId]?.trim() || null,
      action: flagActions[f.attendanceId] ?? "NONE",
    }));

    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionDate,
          flags,
          reflection: reflection.trim() || null,
          resourceUrl: resourceUrl.trim() || null,
          resourceNote: resourceNote.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="ps-done">
        <h2 className="ps-done__title">Thank you.</h2>
        <p className="ps-done__body">
          Your post-session notes have been saved. The right people have been notified.
        </p>
        <a href={backPath} className="ps-done__back">← Back to today&rsquo;s sessions</a>
      </div>
    );
  }

  return (
    <form className="ps-form" onSubmit={handleSubmit}>
      <div className="ps-form__header">
        <h2 className="ps-form__title">
          Post-session — {programSlug.replace(/-/g, " ")}
        </h2>
        <p className="ps-form__date">{sessionDateDisplay}</p>
      </div>

      {/* ── Section 1: Flagged people ── */}
      {initialFlagged.length > 0 && (
        <div className="ps-section">
          <h3 className="ps-section__title">People you flagged</h3>
          <p className="ps-section__desc">
            For each person you tapped during the session, add a brief note and choose how to route it.
          </p>
          <div className="ps-flagged-list">
            {initialFlagged.map((f) => (
              <div key={f.attendanceId} className="ps-flag-item">
                <div className="ps-flag-item__name">{f.displayName}</div>
                <textarea
                  className="ps-flag-item__note"
                  rows={2}
                  placeholder="Brief note — 2 or 3 sentences at most"
                  value={flagNotes[f.attendanceId] ?? ""}
                  onChange={(e) =>
                    setFlagNotes((prev) => ({ ...prev, [f.attendanceId]: e.target.value }))
                  }
                />
                <select
                  className="ps-flag-item__action"
                  value={flagActions[f.attendanceId] ?? "NONE"}
                  onChange={(e) =>
                    setFlagActions((prev) => ({
                      ...prev,
                      [f.attendanceId]: e.target.value as ActionValue,
                    }))
                  }
                >
                  {ACTION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show a note if no one was flagged */}
      {initialFlagged.length === 0 && allAttendees.length > 0 && (
        <div className="ps-section ps-section--quiet">
          <p className="ps-section__desc">
            You didn&rsquo;t flag anyone during this session. If something comes to mind now,
            note it in the reflection below.
          </p>
        </div>
      )}

      {/* ── Section 2: Session reflection ── */}
      <div className="ps-section">
        <h3 className="ps-section__title">How was the session?</h3>
        <p className="ps-section__desc">
          The spirit of the session, anything that came up, anything worth the team knowing.
          Optional, but this is how the team learns together over time.
        </p>
        <textarea
          className="ps-reflection"
          rows={5}
          placeholder="Notes for the team — whatever feels worth saying…"
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
        />
      </div>

      {/* ── Section 3: Resource for the group ── */}
      <div className="ps-section">
        <h3 className="ps-section__title">Something to share with everyone who attended?</h3>
        <p className="ps-section__desc">
          A book reference, a link, something from the session worth passing on.
          If filled in, it&rsquo;ll go to Jesse and the coordinator for review — they&rsquo;ll send it.
        </p>
        <input
          type="text"
          className="ps-resource-url"
          placeholder="URL or text"
          value={resourceUrl}
          onChange={(e) => setResourceUrl(e.target.value)}
        />
        {resourceUrl && (
          <input
            type="text"
            className="ps-resource-note"
            placeholder="Brief description (optional)"
            value={resourceNote}
            onChange={(e) => setResourceNote(e.target.value)}
          />
        )}
      </div>

      {error && <p className="ps-error">{error}</p>}

      <div className="ps-form__footer">
        <button type="submit" className="ps-submit" disabled={submitting}>
          {submitting ? "Saving…" : "Submit"}
        </button>
        <a href={backPath} className="ps-cancel">Back</a>
      </div>
    </form>
  );
}
