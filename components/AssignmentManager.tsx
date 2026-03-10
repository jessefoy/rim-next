"use client";

import { useState } from "react";

interface Program {
  slug: string;
  name: string;
}

interface HostUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  email: string;
  roles: string[];
}

interface Assignment {
  id: string;
  programSlug: string;
  programName: string;
  sessionDate: string | null;
  notes: string | null;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    preferredName: string | null;
    email: string;
  };
  createdAt: string;
}

interface Props {
  programs: Program[];
  hostUsers: HostUser[];
  initialAssignments: Assignment[];
}

function displayName(u: { firstName: string | null; lastName: string | null; preferredName: string | null; email: string }): string {
  return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AssignmentManager({ programs, hostUsers, initialAssignments }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [userId, setUserId] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedProgram = programs.find((p) => p.slug === selectedSlug);
  const selectedAssignments = selectedSlug
    ? assignments.filter((a) => a.programSlug === selectedSlug)
    : [];
  const standingHost = selectedAssignments.find((a) => !a.sessionDate);

  function countForProgram(slug: string) {
    return assignments.filter((a) => a.programSlug === slug).length;
  }

  function selectProgram(slug: string) {
    if (selectedSlug === slug) {
      setSelectedSlug(null);
    } else {
      setSelectedSlug(slug);
    }
    setShowAssignForm(false);
    setFormError(null);
    setUserId("");
    setSessionDate("");
    setNotes("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlug || !userId) {
      setFormError("Please select a host.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/host/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programSlug: selectedSlug,
          userId,
          sessionDate: sessionDate || null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Something went wrong.");
        return;
      }
      // Reload all assignments
      const listRes = await fetch("/api/host/assignments");
      if (listRes.ok) {
        const list = await listRes.json();
        const enriched = list.map((a: Assignment) => ({
          ...a,
          programName: programs.find((p) => p.slug === a.programSlug)?.name || a.programSlug,
        }));
        setAssignments(enriched);
      }
      setShowAssignForm(false);
      setUserId("");
      setSessionDate("");
      setNotes("");
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this assignment? Any open sub requests will be cancelled.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/host/assignments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Something went wrong.");
        return;
      }
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="hub-assign-mgr">
      {/* Stage 1: Program list */}
      <div className="hub-assign-program-list">
        {programs.map((p) => {
          const count = countForProgram(p.slug);
          const isSelected = selectedSlug === p.slug;
          return (
            <div
              key={p.slug}
              className={`hub-assign-program-row${isSelected ? " hub-assign-program-row--active" : ""}`}
              onClick={() => selectProgram(p.slug)}
            >
              <span className="hub-assign-program-row__name">{p.name}</span>
              <span className="hub-assign-program-row__count">
                {count === 0 ? "No hosts" : `${count} host${count !== 1 ? "s" : ""}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stage 2: Selected program panel */}
      {selectedSlug && selectedProgram && (
        <div className="hub-assign-program-panel">
          <div className="hub-assign-program-panel__header">
            <p className="hub-assign-program-panel__name">{selectedProgram.name}</p>
            <button
              className="hub-btn hub-btn--sm hub-btn--outline"
              onClick={() => {
                setShowAssignForm(!showAssignForm);
                setFormError(null);
              }}
            >
              {showAssignForm ? "Cancel" : "+ Assign Host"}
            </button>
          </div>

          {/* Conflict badge */}
          {standingHost && (
            <p className="hub-assign-conflict">
              ✓ {displayName(standingHost.user)} — standing host
            </p>
          )}

          {/* Current assignments */}
          {selectedAssignments.length === 0 ? (
            <p className="hub-assign-mgr__empty">No hosts assigned to this program yet.</p>
          ) : (
            <ul className="hub-assign-group__list">
              {selectedAssignments.map((a) => (
                <li key={a.id} className="hub-assign-row">
                  <div className="hub-assign-row__info">
                    <span className="hub-assign-row__host">{displayName(a.user)}</span>
                    {a.sessionDate ? (
                      <span className="hub-assign-row__date">{formatDate(a.sessionDate)}</span>
                    ) : (
                      <span className="hub-assign-row__standing">Standing</span>
                    )}
                    {a.notes && (
                      <span className="hub-assign-row__notes">{a.notes}</span>
                    )}
                  </div>
                  <button
                    className="hub-assign-row__remove"
                    onClick={() => handleDelete(a.id)}
                    disabled={deletingId === a.id}
                    aria-label="Remove assignment"
                  >
                    {deletingId === a.id ? "…" : "✕"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Assign form */}
          {showAssignForm && (
            <div className="hub-assign-form">
              <p className="hub-assign-form__title">Assign a Host</p>
              {standingHost && (
                <p className="hub-assign-conflict">
                  ⚠ This program already has a standing host ({displayName(standingHost.user)}).
                  Add a specific session date below to avoid overlap.
                </p>
              )}
              <form onSubmit={handleCreate}>
                <div className="hub-form-field">
                  <label className="hub-form-label" htmlFor="assign-host">Host</label>
                  <select
                    id="assign-host"
                    className="hub-form-select"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    required
                  >
                    <option value="">— choose host —</option>
                    {hostUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {displayName(u)} ({u.roles.filter((r) => ["HOST", "HOST_MANAGER"].includes(r)).join(", ")})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="hub-form-field">
                  <label className="hub-form-label" htmlFor="assign-date">
                    Specific session date (optional)
                  </label>
                  <input
                    id="assign-date"
                    type="date"
                    className="hub-form-input"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                  />
                  <p className="hub-form-hint">
                    Leave blank to assign as standing host for all sessions.
                  </p>
                </div>

                <div className="hub-form-field">
                  <label className="hub-form-label" htmlFor="assign-notes">Notes (optional)</label>
                  <input
                    id="assign-notes"
                    type="text"
                    className="hub-form-input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Backup host, covering Jan only, etc."
                  />
                </div>

                {formError && <p className="hub-form-error">{formError}</p>}

                <div className="hub-form-actions">
                  <button type="submit" className="hub-btn" disabled={submitting}>
                    {submitting ? "Saving…" : "Save Assignment"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
