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
  programName: string; // resolved from Sanity
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
  const [showForm, setShowForm] = useState(false);
  const [programSlug, setProgramSlug] = useState("");
  const [userId, setUserId] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterSlug, setFilterSlug] = useState<string>("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!programSlug || !userId) {
      setFormError("Program and host are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/host/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programSlug,
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
      // Reload assignments
      const listRes = await fetch("/api/host/assignments");
      if (listRes.ok) {
        const list = await listRes.json();
        // Enrich with program names
        const enriched = list.map((a: Assignment) => ({
          ...a,
          programName: programs.find((p) => p.slug === a.programSlug)?.name || a.programSlug,
        }));
        setAssignments(enriched);
      }
      setShowForm(false);
      setProgramSlug("");
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

  const filtered = filterSlug ? assignments.filter((a) => a.programSlug === filterSlug) : assignments;

  // Group by program for display
  const slugsSeen = new Set<string>();
  const programSlugs = filtered
    .map((a) => a.programSlug)
    .filter((s) => { if (slugsSeen.has(s)) return false; slugsSeen.add(s); return true; });

  return (
    <div className="hub-assign-mgr">
      {/* Controls */}
      <div className="hub-assign-mgr__controls">
        <div className="hub-assign-mgr__filters">
          <select
            className="hub-form-select hub-form-select--sm"
            value={filterSlug}
            onChange={(e) => setFilterSlug(e.target.value)}
          >
            <option value="">All programs</option>
            {programs.map((p) => (
              <option key={p.slug} value={p.slug}>{p.name}</option>
            ))}
          </select>
        </div>
        <button
          className="hub-btn hub-btn--outline"
          onClick={() => { setShowForm(!showForm); setFormError(null); }}
        >
          {showForm ? "Cancel" : "+ Assign Host"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="hub-assign-form">
          <p className="hub-assign-form__title">Assign a Host</p>
          <form onSubmit={handleCreate}>
            <div className="hub-form-row">
              <div className="hub-form-field">
                <label className="hub-form-label" htmlFor="assign-program">Program</label>
                <select
                  id="assign-program"
                  className="hub-form-select"
                  value={programSlug}
                  onChange={(e) => setProgramSlug(e.target.value)}
                  required
                >
                  <option value="">— choose program —</option>
                  {programs.map((p) => (
                    <option key={p.slug} value={p.slug}>{p.name}</option>
                  ))}
                </select>
              </div>
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
                      {displayName(u)} ({u.roles.filter(r => ["HOST","HOST_MANAGER"].includes(r)).join(", ")})
                    </option>
                  ))}
                </select>
              </div>
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

      {/* Assignment list grouped by program */}
      {filtered.length === 0 ? (
        <p className="hub-assign-mgr__empty">No assignments yet. Use "+ Assign Host" to get started.</p>
      ) : (
        programSlugs.map((slug) => {
          const programAssignments = filtered.filter((a) => a.programSlug === slug);
          const programName = programs.find((p) => p.slug === slug)?.name || slug;
          return (
            <div key={slug} className="hub-assign-group">
              <p className="hub-assign-group__name">{programName}</p>
              <ul className="hub-assign-group__list">
                {programAssignments.map((a) => (
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
            </div>
          );
        })
      )}
    </div>
  );
}
