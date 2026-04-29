"use client";

/**
 * RotationsClient — coordinator standing-rotation management.
 *
 * UI shape: a list of rotations as plain-English sentences. One add-form to
 * create new rotations, inline edit/end actions on each row.
 *
 *   Alex covers 1st Tuesdays of Sangha               · Edit · End
 *   Sam covers 3rd Tuesdays of Sangha                · Edit · End
 *   Maya covers every session of Daily Sit (until Jun 30) · Edit · End
 *   + Add a rotation
 *
 * On save: opens the conflict-resolution modal showing what would be filled
 * vs. what conflicts with existing assignments. Coordinator picks resolution
 * mode (leave / replace all / one by one). Apply commits the change.
 *
 * On end: opens a small confirm panel asking whether to also release future
 * already-applied assignments.
 */

import { useState, useEffect, useCallback } from "react";
import RotationConflictModal from "./RotationConflictModal";

const OCCURRENCES = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "LAST", "ALL"] as const;
type Occurrence = (typeof OCCURRENCES)[number];

const OCC_DESCRIPTOR: Record<Occurrence, string> = {
  FIRST:  "the 1st session each month",
  SECOND: "the 2nd session each month",
  THIRD:  "the 3rd session each month",
  FOURTH: "the 4th session each month",
  FIFTH:  "the 5th session (when it occurs)",
  LAST:   "the last session each month",
  ALL:    "every session",
};

const OCC_OPTIONS: Array<{ value: Occurrence; label: string }> = [
  { value: "ALL",    label: "Every session"             },
  { value: "FIRST",  label: "1st of the month"          },
  { value: "SECOND", label: "2nd of the month"          },
  { value: "THIRD",  label: "3rd of the month"          },
  { value: "FOURTH", label: "4th of the month"          },
  { value: "LAST",   label: "Last of the month"         },
  { value: "FIFTH",  label: "5th specifically (rare)"   },
];

interface Program {
  id:            string | null;
  slug:          string;
  name:          string;
  programFormat: string | null;
}

interface TeamMember {
  id:            string;
  displayName:   string;
  isCoordinator: boolean;
}

interface Rotation {
  id:          string;
  programSlug: string;
  occurrence:  Occurrence;
  userId:      string;
  hostName:    string | null;
  startsOn:    string;
  endsOn:      string | null;
}

interface Props {
  programs:    Program[];
  teamMembers: TeamMember[];
  year:        number;
  month:       number;
}

interface FormState {
  id?:         string;          // present on edit
  programSlug: string;
  occurrence:  Occurrence;
  userId:      string;
  endsOn:      string;          // "" = ongoing
}

const EMPTY_FORM: FormState = {
  programSlug: "",
  occurrence:  "ALL",
  userId:      "",
  endsOn:      "",
};

export default function RotationsClient({ programs, teamMembers, year, month }: Props) {
  const [rotations, setRotations] = useState<Rotation[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [adding, setAdding]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]       = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);

  // Confirm-end panel state per row
  const [endingId, setEndingId] = useState<string | null>(null);

  // Conflict modal state
  const [pendingApply, setPendingApply] = useState<{
    rotationId:  string;
    programSlug: string;
  } | null>(null);

  const programBySlug = new Map(programs.map((p) => [p.slug, p]));

  // ── Load existing rotations ────────────────────────────────────────────
  const loadRotations = useCallback(async () => {
    try {
      const res = await fetch("/api/host/standing-assignments");
      if (!res.ok) throw new Error("load failed");
      const data: Rotation[] = await res.json();
      setRotations(data);
    } catch {
      setError("Could not load rotations. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRotations();
  }, [loadRotations]);

  // ── Save rotation, then trigger conflict-resolution flow ──────────────
  const handleSave = useCallback(
    async () => {
      if (!form.programSlug || !form.userId) {
        setError("Please pick a person and a program.");
        return;
      }
      setSaving(true);
      setError(null);

      try {
        const res = await fetch("/api/host/standing-assignments", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            id:          form.id,
            programSlug: form.programSlug,
            occurrence:  form.occurrence,
            userId:      form.userId,
            endsOn:      form.endsOn || null,
          }),
        });
        if (!res.ok) throw new Error("save failed");
        const saved = await res.json();

        // Reload list, close form, open conflict modal for this rotation
        await loadRotations();
        setAdding(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        setPendingApply({ rotationId: saved.id, programSlug: saved.programSlug });
      } catch {
        setError("Something went wrong saving. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [form, loadRotations]
  );

  // ── End rotation (with optional release of future assignments) ────────
  const handleEnd = useCallback(
    async (rotationId: string, releaseFuture: boolean) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/host/standing-assignments/${rotationId}`, {
          method:  "DELETE",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ releaseFuture }),
        });
        if (!res.ok) throw new Error("end failed");
        await loadRotations();
        setEndingId(null);
      } catch {
        setError("Could not end this rotation. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [loadRotations]
  );

  const startAdd = () => {
    setForm(EMPTY_FORM);
    setAdding(true);
    setEditingId(null);
  };

  const startEdit = (r: Rotation) => {
    setForm({
      id:          r.id,
      programSlug: r.programSlug,
      occurrence:  r.occurrence,
      userId:      r.userId,
      endsOn:      r.endsOn ? r.endsOn.slice(0, 10) : "",
    });
    setEditingId(r.id);
    setAdding(false);
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return <p className="hs-loading">Loading rotations…</p>;
  }

  return (
    <div className="hs-rot">
      <p className="hs-rot__intro">
        Standing rotations automatically schedule a host for sessions matching
        a recurring pattern. Saving a rotation applies it immediately to future
        sessions. Past sessions are never changed.
      </p>

      {error && <p className="hs-rot__error">{error}</p>}

      <ul className="hs-rot__list">
        {rotations.length === 0 && !adding && (
          <li className="hs-rot__empty">
            No rotations yet. Add one below to start scheduling automatically.
          </li>
        )}

        {rotations.map((r) => {
          const program = programBySlug.get(r.programSlug);
          const isEditing = editingId === r.id;
          const isEnding  = endingId  === r.id;
          const endsLabel = r.endsOn
            ? new Date(r.endsOn).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              })
            : null;

          return (
            <li key={r.id} className="hs-rot__item">
              {!isEditing && (
                <>
                  <p className="hs-rot__sentence">
                    <strong className="hs-rot__host">{r.hostName ?? "(unknown host)"}</strong>{" "}
                    covers {OCC_DESCRIPTOR[r.occurrence]} of{" "}
                    <strong className="hs-rot__program">
                      {program?.name ?? r.programSlug}
                    </strong>
                    {endsLabel && (
                      <span className="hs-rot__until"> · until {endsLabel}</span>
                    )}
                  </p>
                  <div className="hs-rot__actions">
                    <button className="hs-rot__action" onClick={() => startEdit(r)}>
                      Edit
                    </button>
                    <button className="hs-rot__action hs-rot__action--end" onClick={() => setEndingId(r.id)}>
                      End rotation
                    </button>
                  </div>
                </>
              )}

              {isEditing && (
                <RotationForm
                  form={form}
                  setForm={setForm}
                  programs={programs}
                  teamMembers={teamMembers}
                  saving={saving}
                  onSave={handleSave}
                  onCancel={cancelForm}
                  isEdit
                />
              )}

              {isEnding && (
                <div className="hs-rot__end-confirm">
                  <p className="hs-rot__end-q">How should we end this rotation?</p>
                  <button
                    className="hs-rot__end-opt"
                    onClick={() => handleEnd(r.id, false)}
                    disabled={saving}
                  >
                    <strong>Just stop generating.</strong>{" "}
                    <span>{r.hostName ?? "The host"} keeps the dates already on their schedule. Future cron runs won't add new ones.</span>
                  </button>
                  <button
                    className="hs-rot__end-opt hs-rot__end-opt--release"
                    onClick={() => handleEnd(r.id, true)}
                    disabled={saving}
                  >
                    <strong>Stop and release future dates.</strong>{" "}
                    <span>Clears upcoming sessions from {r.hostName ?? "the host"}'s schedule so others can claim them. Past sessions stay. They'll be emailed.</span>
                  </button>
                  <button
                    className="hs-rot__end-cancel"
                    onClick={() => setEndingId(null)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!adding && !editingId && (
        <button className="hs-rot__add" onClick={startAdd}>
          + Add a rotation
        </button>
      )}

      {adding && (
        <div className="hs-rot__add-form">
          <RotationForm
            form={form}
            setForm={setForm}
            programs={programs}
            teamMembers={teamMembers}
            saving={saving}
            onSave={handleSave}
            onCancel={cancelForm}
          />
        </div>
      )}

      {pendingApply && (
        <RotationConflictModal
          standingId={pendingApply.rotationId}
          programSlug={pendingApply.programSlug}
          year={year}
          month={month}
          onClose={() => setPendingApply(null)}
        />
      )}
    </div>
  );
}

// ─── Reusable form (used both for Add and inline Edit) ──────────────────

interface FormProps {
  form:        FormState;
  setForm:     (f: FormState) => void;
  programs:    Program[];
  teamMembers: TeamMember[];
  saving:      boolean;
  onSave:      () => void;
  onCancel:    () => void;
  isEdit?:     boolean;
}

function RotationForm({ form, setForm, programs, teamMembers, saving, onSave, onCancel, isEdit }: FormProps) {
  const showEndDate = !!form.endsOn || /* keep visible if user already opened it */ false;
  const [endVisible, setEndVisible] = useState(showEndDate);

  return (
    <div className="hs-rot__form">
      <div className="hs-rot__form-row">
        <label className="hs-rot__form-label">Who hosts</label>
        <select
          className="hs-rot__form-input"
          value={form.userId}
          onChange={(e) => setForm({ ...form, userId: e.target.value })}
        >
          <option value="">— pick a person —</option>
          {teamMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}{m.isCoordinator ? " ★" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="hs-rot__form-row">
        <label className="hs-rot__form-label">Pattern</label>
        <select
          className="hs-rot__form-input"
          value={form.occurrence}
          onChange={(e) => setForm({ ...form, occurrence: e.target.value as Occurrence })}
        >
          {OCC_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="hs-rot__form-row">
        <label className="hs-rot__form-label">Program</label>
        <select
          className="hs-rot__form-input"
          value={form.programSlug}
          onChange={(e) => setForm({ ...form, programSlug: e.target.value })}
          disabled={isEdit}
        >
          <option value="">— pick a program —</option>
          {programs.map((p) => (
            <option key={p.slug} value={p.slug}>{p.name}</option>
          ))}
        </select>
      </div>

      {endVisible ? (
        <div className="hs-rot__form-row">
          <label className="hs-rot__form-label">Until</label>
          <input
            type="date"
            className="hs-rot__form-input"
            value={form.endsOn}
            onChange={(e) => setForm({ ...form, endsOn: e.target.value })}
          />
          <button
            type="button"
            className="hs-rot__form-link"
            onClick={() => { setForm({ ...form, endsOn: "" }); setEndVisible(false); }}
          >
            Remove end date
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="hs-rot__form-link"
          onClick={() => setEndVisible(true)}
        >
          + Add an end date (optional)
        </button>
      )}

      <div className="hs-rot__form-actions">
        <button
          className="hs-rot__form-save"
          onClick={onSave}
          disabled={saving || !form.userId || !form.programSlug}
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Save & apply"}
        </button>
        <button
          className="hs-rot__form-cancel"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
