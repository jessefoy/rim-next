"use client";

import { useState } from "react";

interface Assignment {
  id: string;
  programSlug: string;
  programName: string;
  sessionDate: string | null; // ISO
}

interface Props {
  assignments: Assignment[]; // the current user's assignments
  onCreated?: () => void;
}

export default function SubRequestForm({ assignments, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [assignmentId, setAssignmentId] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (assignments.length === 0) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assignmentId) {
      setError("Please select a program.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/host/sub-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          sessionDate: sessionDate || null,
          message: message.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setSuccess(true);
      setOpen(false);
      setAssignmentId("");
      setSessionDate("");
      setMessage("");
      onCreated?.();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="hub-sub-req-trigger">
        {success && (
          <p className="hub-sub-req__success">
            ✓ Sub request posted — all hub members have been notified.
          </p>
        )}
        <button className="hub-btn hub-btn--outline" onClick={() => { setSuccess(false); setOpen(true); }}>
          + Request a Sub
        </button>
      </div>
    );
  }

  return (
    <div className="hub-sub-req-form">
      <p className="hub-sub-req-form__title">Request a Sub</p>
      <form onSubmit={handleSubmit}>
        <div className="hub-form-field">
          <label className="hub-form-label" htmlFor="sub-program">Program</label>
          <select
            id="sub-program"
            className="hub-form-select"
            value={assignmentId}
            onChange={(e) => setAssignmentId(e.target.value)}
            required
          >
            <option value="">— choose a program —</option>
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>{a.programName || a.programSlug}</option>
            ))}
          </select>
        </div>

        <div className="hub-form-field">
          <label className="hub-form-label" htmlFor="sub-date">Session date (optional)</label>
          <input
            id="sub-date"
            type="date"
            className="hub-form-input"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
          />
          <p className="hub-form-hint">Leave blank if covering all upcoming sessions.</p>
        </div>

        <div className="hub-form-field">
          <label className="hub-form-label" htmlFor="sub-message">Context (optional)</label>
          <textarea
            id="sub-message"
            className="hub-form-textarea"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Travel, illness, etc."
          />
        </div>

        {error && <p className="hub-form-error">{error}</p>}

        <div className="hub-form-actions">
          <button type="submit" className="hub-btn" disabled={submitting}>
            {submitting ? "Posting…" : "Post Request"}
          </button>
          <button
            type="button"
            className="hub-btn hub-btn--ghost"
            onClick={() => { setOpen(false); setError(null); }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
