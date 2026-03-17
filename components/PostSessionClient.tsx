"use client";

/**
 * PostSessionClient — post-session form for the Host Team hub.
 *
 * Primary host sees:
 *   1. Flagged people (if any) — note + routing choice per person
 *   2. Session reflection — plain textarea
 *   3. Resource to share (optional)
 *
 * Co-host sees reflection only.
 *
 * Autosave: form state is persisted to localStorage on every change,
 * keyed by programSlug + sessionDate. Draft is restored on load and
 * cleared on successful submission.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import FormattedEditor from "./FormattedEditor";

const ACTION_OPTIONS = [
  { value: "NONE",             label: "No action needed" },
  { value: "GENTLE_FOLLOWUP", label: "Gentle follow-up" },
  { value: "JESSE_ONLY",      label: "Jesse only — sensitive" },
  { value: "TECHNICAL_ISSUE", label: "Technical issue" },
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

export interface AssignedHost {
  id: string;
  name: string;
}

interface Props {
  programSlug: string;
  programName: string;           // display name — not the slug
  sessionDate: string;           // ISO string — midnight CT
  sessionDateDisplay: string;    // e.g. "Monday, March 16"
  flaggedAttendees: FlaggedAttendee[];
  allAttendees: AllAttendee[];
  existingReflection: object | null;
  existingResourceUrl: string | null;
  existingResourceNote: string | null;
  alreadySubmitted: boolean;
  assignedHost: AssignedHost | null;
  backPath?: string;
  apiPath: string;
  onSuccess?: () => void;
}

interface DraftState {
  flagNotes: Record<string, string>;
  flagActions: Record<string, ActionValue>;
  reflection: object | null;
  resourceUrl: string;
  resourceNote: string;
}

export default function PostSessionClient({
  programSlug,
  programName,
  sessionDate,
  sessionDateDisplay,
  flaggedAttendees: initialFlagged,
  allAttendees,
  existingReflection,
  existingResourceUrl,
  existingResourceNote,
  alreadySubmitted,
  assignedHost,
  backPath = "",
  apiPath,
  onSuccess,
}: Props) {
  const router = useRouter();

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

  const [reflection, setReflection] = useState<object | null>(existingReflection ?? null);
  const [resourceUrl, setResourceUrl] = useState(existingResourceUrl ?? "");
  const [resourceNote, setResourceNote] = useState(existingResourceNote ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // ── Draft autosave ────────────────────────────────────────────────────────
  const draftKey = `psr-draft:${programSlug}:${sessionDate}`;

  function saveDraft(update: Partial<DraftState>) {
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        flagNotes, flagActions, reflection, resourceUrl, resourceNote,
        ...update,
      }));
    } catch { /* ignore — storage full or private browsing */ }
  }

  function clearDraft() {
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
  }

  useEffect(() => {
    if (alreadySubmitted) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<DraftState>;
      if (draft.flagNotes)   setFlagNotes(draft.flagNotes);
      if (draft.flagActions) setFlagActions(draft.flagActions);
      if (typeof draft.reflection   === "string") setReflection(draft.reflection);
      if (typeof draft.resourceUrl  === "string") setResourceUrl(draft.resourceUrl);
      if (typeof draft.resourceNote === "string") setResourceNote(draft.resourceNote);
      setDraftRestored(true);
    } catch { /* ignore corrupt data */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ── End draft autosave ────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        sessionDate,
        flags: initialFlagged.map((f) => ({
          attendanceId: f.attendanceId,
          note:   flagNotes[f.attendanceId]?.trim() || null,
          action: flagActions[f.attendanceId] ?? "NONE",
        })),
        reflection: reflection ?? null,
        resourceUrl: resourceUrl.trim() || null,
        resourceNote: resourceNote.trim() || null,
        assignedHostId: assignedHost?.id ?? null,
      };

      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
      clearDraft();
      onSuccess?.();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Submitted state ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="ps-done">
        <h2 className="ps-done__title">Thank you.</h2>
        <p className="ps-done__body">
          Your post-session notes have been saved. The right people have been notified.
        </p>
        {backPath && (
          <a href={backPath} className="ps-done__back">← Back to today&rsquo;s sessions</a>
        )}
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <form className="ps-form" onSubmit={handleSubmit}>

      {/* ── Page heading ── */}
      <div className="ps-form__header">
        <h2 className="ps-form__title">
          Session ended. Take a few minutes for your report.
        </h2>
        <p className="ps-form__framing">
          This is part of the role — it only takes a few minutes and it helps the whole team.
        </p>
        <p className="ps-form__meta">{programName} · {sessionDateDisplay}</p>
      </div>

      {/* ── Draft restored notice ── */}
      {draftRestored && (
        <div className="ps-draft-notice">
          Draft restored.{" "}
          <button
            type="button"
            className="ps-draft-notice__clear"
            onClick={() => { clearDraft(); setDraftRestored(false); }}
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Section 1: Flagged people — shown to all hosts when flags exist ── */}
      {initialFlagged.length > 0 && (
        <div className="ps-section">
          <p className="ps-section-label">People you noted during the session</p>
          <p className="ps-section__desc">Add a note if helpful, then choose what happens next.</p>
          <div className="ps-flagged-list">
            {initialFlagged.map((f) => (
              <div key={f.attendanceId} className="ps-flag-item">
                <p className="ps-flag-item__name">{f.displayName}</p>
                <textarea
                  className="ps-flag-item__note"
                  rows={3}
                  placeholder="What did you notice? (optional)"
                  value={flagNotes[f.attendanceId] ?? ""}
                  onChange={(e) => {
                    const updated = { ...flagNotes, [f.attendanceId]: e.target.value };
                    setFlagNotes(updated);
                    saveDraft({ flagNotes: updated });
                  }}
                />
                <div className="ps-radio-group">
                  {ACTION_OPTIONS.map((o) => (
                    <label key={o.value} className="ps-radio">
                      <input
                        type="radio"
                        name={`action-${f.attendanceId}`}
                        value={o.value}
                        checked={(flagActions[f.attendanceId] ?? "NONE") === o.value}
                        onChange={() => {
                          const updated = { ...flagActions, [f.attendanceId]: o.value };
                          setFlagActions(updated);
                          saveDraft({ flagActions: updated });
                        }}
                      />
                      <span className="ps-radio__label">{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 2: Session reflection ── */}
      <div className="ps-section">
        <p className="ps-section-label">Session reflection</p>
        <p className="ps-section__desc">Optional — but encouraged.</p>
        <div className="ps-reflection-wrap">
          <FormattedEditor
            placeholder="How did the session feel? Anything worth the team knowing?"
            value={reflection}
            minHeight={120}
            onChange={(v) => {
              setReflection(v);
              saveDraft({ reflection: v });
            }}
          />
        </div>
      </div>

      {/* ── Section 3: Resource to share ── */}
      {(
        <div className="ps-section">
          <p className="ps-section-label">Something to share with attendees?</p>
          <p className="ps-section__desc">
            A book, a link, something from the session worth passing on. Optional — it goes to
            Jesse and the coordinator for review.
          </p>
          <input
            type="text"
            className="ps-resource-url"
            placeholder="URL or text"
            value={resourceUrl}
            onChange={(e) => {
              setResourceUrl(e.target.value);
              saveDraft({ resourceUrl: e.target.value });
            }}
          />
          {resourceUrl && (
            <input
              type="text"
              className="ps-resource-note"
              placeholder="Brief description (optional)"
              value={resourceNote}
              onChange={(e) => {
                setResourceNote(e.target.value);
                saveDraft({ resourceNote: e.target.value });
              }}
            />
          )}
        </div>
      )}

      {error && <p className="ps-error">{error}</p>}

      <div className="ps-form__footer">
        <button type="submit" className="ps-submit" disabled={submitting}>
          {submitting ? "Saving…" : "Submit Report"}
        </button>
      </div>
    </form>
  );
}
