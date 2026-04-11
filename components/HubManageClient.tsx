"use client";

import { useState } from "react";

interface Program {
  slug: string;
  name: string;
}

interface HostUser {
  id: string;
  displayName: string;
  email: string;
  roles: string[];
}

interface Assignment {
  id: string;
  programSlug: string;
  programName: string;
  sessionDate: string | null;
  notes: string | null;
  status: "unclaimed" | "claimed" | "sub_needed";
  hostUserId: string | null;
  hostName: string | null;
  createdAt: string;
}

interface Props {
  programs: Program[];
  hostUsers: HostUser[];
  initialAssignments: Assignment[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_LABELS: Record<Assignment["status"], string> = {
  unclaimed: "Unclaimed",
  claimed: "Claimed",
  sub_needed: "Sub Needed",
};
const STATUS_COLORS: Record<Assignment["status"], string> = {
  unclaimed: "#777",
  claimed: "#2d6a2d",
  sub_needed: "#7a4f00",
};

// ── Add Session Form ─────────────────────────────────────────────────

interface AddSessionFormProps {
  programs: Program[];
  hostUsers: HostUser[];
  onCreated: (assignment: Assignment) => void;
  onCancel: () => void;
}

function AddSessionForm({ programs, hostUsers, onCreated, onCancel }: AddSessionFormProps) {
  const [programSlug, setProgramSlug] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [userId, setUserId] = useState(""); // empty = unclaimed
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!programSlug) {
      setError("Choose a program.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/host/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programSlug,
          sessionDate: sessionDate || null,
          userId: userId || null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      const prog = programs.find((p) => p.slug === programSlug);
      const host = userId ? hostUsers.find((u) => u.id === userId) : null;
      const newAssignment: Assignment = {
        id: data.id,
        programSlug,
        programName: prog?.name ?? programSlug,
        sessionDate: data.sessionDate ?? null,
        notes: notes.trim() || null,
        status: userId ? "claimed" : "unclaimed",
        hostUserId: userId || null,
        hostName: host?.displayName ?? null,
        createdAt: data.createdAt ?? new Date().toISOString(),
      };
      onCreated(newAssignment);
      // Reset
      setProgramSlug("");
      setSessionDate("");
      setUserId("");
      setNotes("");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="hub-manage-add-form" onSubmit={handleSubmit}>
      <div className="hub-manage-add-form__header">
        <span className="hub-manage-add-form__title">Add Session</span>
        <button type="button" className="hub-conv-new-form__cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div className="hub-form-row">
        <div className="hub-form-field">
          <label className="hub-form-label" htmlFor="mgr-program">Program</label>
          <select
            id="mgr-program"
            className="hub-form-select"
            value={programSlug}
            onChange={(e) => setProgramSlug(e.target.value)}
            required
          >
            <option value="">— choose program —</option>
            {programs.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="hub-form-field">
          <label className="hub-form-label" htmlFor="mgr-date">Session Date</label>
          <input
            id="mgr-date"
            type="date"
            className="hub-form-input"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
          />
          <p className="hub-form-hint">Leave blank for a standing/recurring assignment.</p>
        </div>
      </div>

      <div className="hub-form-row">
        <div className="hub-form-field">
          <label className="hub-form-label" htmlFor="mgr-host">
            Assign Host <span style={{ fontWeight: 400, color: "var(--rim-text-muted)" }}>(optional)</span>
          </label>
          <select
            id="mgr-host"
            className="hub-form-select"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">— leave unclaimed (hosts can self-assign) —</option>
            {hostUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className="hub-form-field">
          <label className="hub-form-label" htmlFor="mgr-notes">Notes (optional)</label>
          <input
            id="mgr-notes"
            type="text"
            className="hub-form-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Backup host, covering Jan only, etc."
          />
        </div>
      </div>

      {error && <p className="hub-form-error">{error}</p>}

      <div className="hub-form-actions">
        <button type="submit" className="hub-btn" disabled={submitting || !programSlug}>
          {submitting ? "Saving…" : "Add Session"}
        </button>
        <button type="button" className="hub-btn hub-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Program Panel (oversight) ────────────────────────────────────────

interface ProgramPanelProps {
  program: Program;
  assignments: Assignment[];
  hostUsers: HostUser[];
  onRemove: (id: string) => void;
  removingId: string | null;
}

function ProgramPanel({ program, assignments, hostUsers, onRemove, removingId }: ProgramPanelProps) {
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [userId, setUserId] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const standingHost = assignments.find((a) => !a.sessionDate && a.hostUserId);
  const future = assignments.filter(
    (a) => a.sessionDate && new Date(a.sessionDate) >= new Date()
  );
  const past = assignments.filter(
    (a) => a.sessionDate && new Date(a.sessionDate) < new Date()
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch("/api/host/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programSlug: program.slug,
          sessionDate: sessionDate || null,
          userId: userId || null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Something went wrong.");
        return;
      }
      // Reload the page to get fresh data
      window.location.reload();
    } catch {
      setFormError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="hub-assign-program-panel">
      <div className="hub-assign-program-panel__header">
        <p className="hub-assign-program-panel__name">{program.name}</p>
        <button
          className="hub-btn hub-btn--sm hub-btn--outline"
          onClick={() => {
            setShowAssignForm(!showAssignForm);
            setFormError("");
          }}
        >
          {showAssignForm ? "Cancel" : "+ Add Session"}
        </button>
      </div>

      {standingHost && (
        <p className="hub-assign-conflict hub-assign-conflict--inline">
          ✓ {standingHost.hostName} — standing host
        </p>
      )}

      {assignments.length === 0 ? (
        <p className="hub-assign-mgr__empty">No sessions assigned yet.</p>
      ) : (
        <>
          {future.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p className="hub-assign-group__name" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--rim-text-muted)", marginBottom: 6 }}>
                Upcoming
              </p>
              <ul className="hub-assign-group__list">
                {future.map((a) => (
                  <AssignmentRow
                    key={a.id}
                    assignment={a}
                    onRemove={onRemove}
                    removingId={removingId}
                  />
                ))}
              </ul>
            </div>
          )}
          {assignments.filter((a) => !a.sessionDate).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p className="hub-assign-group__name" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--rim-text-muted)", marginBottom: 6 }}>
                Standing
              </p>
              <ul className="hub-assign-group__list">
                {assignments.filter((a) => !a.sessionDate).map((a) => (
                  <AssignmentRow
                    key={a.id}
                    assignment={a}
                    onRemove={onRemove}
                    removingId={removingId}
                  />
                ))}
              </ul>
            </div>
          )}
          {past.length > 0 && (
            <details style={{ marginBottom: 12 }}>
              <summary style={{ fontSize: 13, color: "var(--rim-text-muted)", cursor: "pointer", marginBottom: 6 }}>
                {past.length} past session{past.length !== 1 ? "s" : ""}
              </summary>
              <ul className="hub-assign-group__list" style={{ marginTop: 6 }}>
                {past.map((a) => (
                  <AssignmentRow
                    key={a.id}
                    assignment={a}
                    onRemove={onRemove}
                    removingId={removingId}
                  />
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {showAssignForm && (
        <div className="hub-assign-form" style={{ marginTop: 16 }}>
          <p className="hub-assign-form__title">Add Session</p>
          {standingHost && (
            <p className="hub-assign-conflict">
              ⚠ This program already has a standing host ({standingHost.hostName}).
              Set a specific session date to avoid overlap.
            </p>
          )}
          <form onSubmit={handleCreate}>
            <div className="hub-form-row">
              <div className="hub-form-field">
                <label className="hub-form-label" htmlFor={`panel-host-${program.slug}`}>
                  Host <span style={{ fontWeight: 400, color: "var(--rim-text-muted)" }}>(optional)</span>
                </label>
                <select
                  id={`panel-host-${program.slug}`}
                  className="hub-form-select"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                >
                  <option value="">— unclaimed —</option>
                  {hostUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.displayName}</option>
                  ))}
                </select>
              </div>
              <div className="hub-form-field">
                <label className="hub-form-label" htmlFor={`panel-date-${program.slug}`}>
                  Session Date
                </label>
                <input
                  id={`panel-date-${program.slug}`}
                  type="date"
                  className="hub-form-input"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                />
                <p className="hub-form-hint">Leave blank for standing.</p>
              </div>
            </div>
            <div className="hub-form-field">
              <label className="hub-form-label" htmlFor={`panel-notes-${program.slug}`}>Notes</label>
              <input
                id={`panel-notes-${program.slug}`}
                type="text"
                className="hub-form-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional note"
              />
            </div>
            {formError && <p className="hub-form-error">{formError}</p>}
            <div className="hub-form-actions">
              <button type="submit" className="hub-btn" disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Assignment Row ───────────────────────────────────────────────────

interface AssignmentRowProps {
  assignment: Assignment;
  onRemove: (id: string) => void;
  removingId: string | null;
}

function AssignmentRow({ assignment, onRemove, removingId }: AssignmentRowProps) {
  return (
    <li className="hub-assign-row">
      <div className="hub-assign-row__info">
        {assignment.hostName ? (
          <span className="hub-assign-row__host">{assignment.hostName}</span>
        ) : (
          <span className="hub-assign-row__host" style={{ color: "var(--rim-text-muted)", fontStyle: "italic" }}>
            Unclaimed
          </span>
        )}
        {assignment.sessionDate ? (
          <span className="hub-assign-row__date">{formatDate(assignment.sessionDate)}</span>
        ) : (
          <span className="hub-assign-row__standing">Standing</span>
        )}
        {assignment.status === "sub_needed" && (
          <span style={{ fontSize: 11, color: "#7a4f00", background: "#fff8ec", border: "1px solid #e8d9b8", padding: "2px 8px", borderRadius: 10 }}>
            Sub needed
          </span>
        )}
        {assignment.notes && (
          <span className="hub-assign-row__notes">{assignment.notes}</span>
        )}
      </div>
      <button
        className="hub-assign-row__remove"
        onClick={() => onRemove(assignment.id)}
        disabled={removingId === assignment.id}
        aria-label="Remove session"
      >
        {removingId === assignment.id ? "…" : "✕"}
      </button>
    </li>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export default function HubManageClient({ programs, hostUsers, initialAssignments }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const selectedProgram = programs.find((p) => p.slug === selectedSlug);
  const selectedAssignments = selectedSlug
    ? assignments.filter((a) => a.programSlug === selectedSlug)
    : [];

  function countForProgram(slug: string) {
    return assignments.filter((a) => a.programSlug === slug).length;
  }

  function toggleProgram(slug: string) {
    setSelectedSlug((prev) => (prev === slug ? null : slug));
  }

  async function handleRemove(id: string) {
    if (!confirm("Remove this session? Any open sub requests will be cancelled.")) return;
    setRemovingId(id);
    try {
      const res = await fetch(`/api/host/assignments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Something went wrong.");
        return;
      }
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    } catch {
      alert("Network error — please try again.");
    } finally {
      setRemovingId(null);
    }
  }

  function handleCreated(assignment: Assignment) {
    setAssignments((prev) => [...prev, assignment]);
    setShowAddForm(false);
  }

  return (
    <div className="hub-manage">
      {/* Top action: Add session */}
      <div className="hub-manage__toolbar">
        <button
          className="hub-btn hub-btn--sm"
          onClick={() => setShowAddForm((o) => !o)}
        >
          {showAddForm ? "Cancel" : "+ Add Session"}
        </button>
      </div>

      {showAddForm && (
        <AddSessionForm
          programs={programs}
          hostUsers={hostUsers}
          onCreated={handleCreated}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <div style={{ height: 24 }} />

      {/* Program list */}
      <div className="hub-assign-program-list">
        {programs.map((p) => {
          const count = countForProgram(p.slug);
          const isSelected = selectedSlug === p.slug;
          const unclaimedCount = assignments.filter(
            (a) => a.programSlug === p.slug && a.status === "unclaimed"
          ).length;
          const subCount = assignments.filter(
            (a) => a.programSlug === p.slug && a.status === "sub_needed"
          ).length;

          return (
            <div
              key={p.slug}
              className={`hub-assign-program-row${isSelected ? " hub-assign-program-row--active" : ""}`}
              onClick={() => toggleProgram(p.slug)}
            >
              <span className="hub-assign-program-row__name">{p.name}</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {unclaimedCount > 0 && (
                  <span style={{ fontSize: 11, color: "#777", background: "var(--rim-bg-accent)", padding: "2px 8px", borderRadius: 10 }}>
                    {unclaimedCount} unclaimed
                  </span>
                )}
                {subCount > 0 && (
                  <span style={{ fontSize: 11, color: "#7a4f00", background: "#fff8ec", border: "1px solid #e8d9b8", padding: "2px 8px", borderRadius: 10 }}>
                    {subCount} sub needed
                  </span>
                )}
                <span className="hub-assign-program-row__count">
                  {count === 0 ? "No sessions" : `${count} session${count !== 1 ? "s" : ""}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Program detail panel */}
      {selectedSlug && selectedProgram && (
        <ProgramPanel
          program={selectedProgram}
          assignments={selectedAssignments}
          hostUsers={hostUsers}
          onRemove={handleRemove}
          removingId={removingId}
        />
      )}
    </div>
  );
}
