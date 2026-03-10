"use client";

/**
 * HostProgramActions — inline actions on the program detail page.
 *
 * HOST view: each of their assignments shows "Request Sub" + "Remove me"
 * MANAGER view: all assignments shown with remove, + Assign Host form
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Assignment {
  id: string;
  sessionDate: string | null;
  notes: string | null;
  userId: string;
  userName: string;
  isOwn: boolean;
}

interface HostUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  email: string;
  roles: string[];
}

interface Props {
  assignments: Assignment[];
  hostUsers: HostUser[]; // only populated for manager
  programSlug: string;
  isManager: boolean;
}

function displayName(u: HostUser): string {
  return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ── HOST view ─────────────────────────────────────────────────────────────────

function HostActions({
  assignments: initial,
  programSlug,
}: {
  assignments: Assignment[];
  programSlug: string;
}) {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>(initial);

  // Per-assignment action state
  const [subFormId, setSubFormId] = useState<string | null>(null);
  const [subMessage, setSubMessage] = useState("");
  const [subSubmitting, setSubSubmitting] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSubRequest(assignmentId: string) {
    setSubSubmitting(true);
    setSubError(null);
    try {
      const res = await fetch("/api/host/sub-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, message: subMessage.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubError(data.error ?? "Something went wrong.");
        return;
      }
      setSubFormId(null);
      setSubMessage("");
      setSuccessMsg("Sub request posted — the team will see it on the Sub Board.");
    } catch {
      setSubError("Network error. Please try again.");
    } finally {
      setSubSubmitting(false);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      const res = await fetch(`/api/host/assignments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Something went wrong.");
        return;
      }
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      setRemoveConfirmId(null);
      if (assignments.length === 1) {
        // Last assignment removed — refresh to go back to a clean state
        router.refresh();
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setRemovingId(null);
    }
  }

  if (assignments.length === 0) {
    return (
      <p className="hub-assign-mgr__empty">
        You have no assignments for this program.
      </p>
    );
  }

  return (
    <div className="hub-program-actions">
      <h2 className="hub-program-detail__section-title">My Assignments</h2>

      {successMsg && (
        <p className="hub-program-actions__success">{successMsg}</p>
      )}

      <div className="hub-program-sessions">
        {assignments.map((a) => {
          const isStanding = !a.sessionDate;
          const isSubOpen = subFormId === a.id;
          const isRemoveOpen = removeConfirmId === a.id;

          return (
            <div key={a.id} className="hub-program-session">
              <div className="hub-program-session__info">
                {a.sessionDate ? (
                  <span className="hub-program-session__date">
                    {formatDate(a.sessionDate)}
                  </span>
                ) : (
                  <span className="hub-program-session__standing">
                    Standing host
                  </span>
                )}
                {a.notes && (
                  <span className="hub-program-session__notes">{a.notes}</span>
                )}
              </div>

              {/* Default: show action buttons */}
              {!isSubOpen && !isRemoveOpen && (
                <div className="hub-program-session__actions">
                  <button
                    className="hub-btn hub-btn--sm hub-btn--outline"
                    onClick={() => {
                      setSubFormId(a.id);
                      setSubMessage("");
                      setSubError(null);
                      setSuccessMsg(null);
                    }}
                  >
                    Request Sub
                  </button>
                  <button
                    className="hub-btn hub-btn--sm hub-btn--ghost"
                    onClick={() => setRemoveConfirmId(a.id)}
                  >
                    Remove me
                  </button>
                </div>
              )}

              {/* Sub request form */}
              {isSubOpen && (
                <div className="hub-program-inline-form">
                  <p className="hub-program-inline-form__label">Post a sub request</p>
                  <textarea
                    className="hub-form-textarea"
                    rows={2}
                    value={subMessage}
                    onChange={(e) => setSubMessage(e.target.value)}
                    placeholder="Optional note to the team (e.g., 'family obligation, any coverage appreciated')"
                  />
                  {subError && <p className="hub-form-error">{subError}</p>}
                  <div className="hub-form-actions">
                    <button
                      className="hub-btn hub-btn--sm"
                      onClick={() => handleSubRequest(a.id)}
                      disabled={subSubmitting}
                    >
                      {subSubmitting ? "Posting…" : "Post Request"}
                    </button>
                    <button
                      className="hub-btn hub-btn--sm hub-btn--ghost"
                      onClick={() => {
                        setSubFormId(null);
                        setSubMessage("");
                        setSubError(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Remove confirmation */}
              {isRemoveOpen && (
                <div className="hub-program-inline-form hub-program-inline-form--warn">
                  <p className="hub-program-inline-form__warn-text">
                    {isStanding
                      ? "This removes you from this program entirely. Are you sure?"
                      : "Remove this assignment?"}
                  </p>
                  <div className="hub-form-actions">
                    <button
                      className="hub-btn hub-btn--sm hub-btn--danger"
                      onClick={() => handleRemove(a.id)}
                      disabled={removingId === a.id}
                    >
                      {removingId === a.id ? "Removing…" : "Yes, remove me"}
                    </button>
                    <button
                      className="hub-btn hub-btn--sm hub-btn--ghost"
                      onClick={() => setRemoveConfirmId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MANAGER view ──────────────────────────────────────────────────────────────

function ManagerPanel({
  assignments: initial,
  hostUsers,
  programSlug,
}: {
  assignments: Assignment[];
  hostUsers: HostUser[];
  programSlug: string;
}) {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>(initial);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [userId, setUserId] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const standingHost = assignments.find((a) => !a.sessionDate);

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

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
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
          programSlug,
          userId,
          sessionDate: sessionDate || null,
          notes: assignNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Something went wrong.");
        return;
      }
      // Refresh server data
      router.refresh();
      setShowAssignForm(false);
      setUserId("");
      setSessionDate("");
      setAssignNotes("");
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="hub-program-actions">
      <div className="hub-program-detail__section-header">
        <h2 className="hub-program-detail__section-title">Hosts</h2>
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

      {standingHost && (
        <p className="hub-assign-conflict hub-assign-conflict--inline">
          ✓ {standingHost.userName} — standing host
        </p>
      )}

      {assignments.length === 0 ? (
        <p className="hub-assign-mgr__empty">No hosts assigned yet.</p>
      ) : (
        <ul className="hub-assign-group__list">
          {assignments.map((a) => (
            <li key={a.id} className="hub-assign-row">
              <div className="hub-assign-row__info">
                <span className="hub-assign-row__host">{a.userName}</span>
                {a.sessionDate ? (
                  <span className="hub-assign-row__date">
                    {new Date(a.sessionDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
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

      {showAssignForm && (
        <div className="hub-assign-form">
          <p className="hub-assign-form__title">Assign a Host</p>
          {standingHost && (
            <p className="hub-assign-conflict">
              ⚠ This program already has a standing host ({standingHost.userName}).
              Add a specific session date below to avoid overlap.
            </p>
          )}
          <form onSubmit={handleAssign}>
            <div className="hub-form-field">
              <label className="hub-form-label" htmlFor="detail-assign-host">
                Host
              </label>
              <select
                id="detail-assign-host"
                className="hub-form-select"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
              >
                <option value="">— choose host —</option>
                {hostUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {displayName(u)} (
                    {u.roles.filter((r) => ["HOST", "HOST_MANAGER"].includes(r)).join(", ")}
                    )
                  </option>
                ))}
              </select>
            </div>

            <div className="hub-form-field">
              <label className="hub-form-label" htmlFor="detail-assign-date">
                Specific session date (optional)
              </label>
              <input
                id="detail-assign-date"
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
              <label className="hub-form-label" htmlFor="detail-assign-notes">
                Notes (optional)
              </label>
              <input
                id="detail-assign-notes"
                type="text"
                className="hub-form-input"
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
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
  );
}

// ── Exported component ────────────────────────────────────────────────────────

export default function HostProgramActions({ assignments, hostUsers, programSlug, isManager }: Props) {
  if (isManager) {
    return (
      <ManagerPanel
        assignments={assignments}
        hostUsers={hostUsers}
        programSlug={programSlug}
      />
    );
  }
  return <HostActions assignments={assignments} programSlug={programSlug} />;
}
