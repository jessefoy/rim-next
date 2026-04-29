"use client";

/**
 * RotationsClient — standing host rotation management.
 *
 * Coordinator/manager view: shows every active virtual/hybrid program with
 * its occurrence slots. Each slot has a team-member dropdown. Save writes the
 * rotation and immediately applies it to open sessions in the current month.
 *
 * Read-only for non-coordinators (future — Phase 1 is coordinator-only).
 */

import { useState, useEffect, useCallback } from "react";

const OCCURRENCES = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH"] as const;
type Occurrence = (typeof OCCURRENCES)[number];

const OCC_LABEL: Record<Occurrence, string> = {
  FIRST:  "1st occurrence",
  SECOND: "2nd occurrence",
  THIRD:  "3rd occurrence",
  FOURTH: "4th occurrence",
  FIFTH:  "5th occurrence",
};

interface Program {
  id: string | null;
  slug: string;
  name: string;
  programFormat: string | null;
}

interface TeamMember {
  id: string;
  displayName: string;
  isCoordinator: boolean;
}

interface SlotState {
  userId: string;   // "" = unassigned
  endsOn: string;   // "" = no end date
}

type ProgramSlots = Record<Occurrence, SlotState>;

interface StandingAssignment {
  programSlug: string;
  occurrence:  Occurrence;
  userId:      string;
  endsOn:      string | null;
}

interface Props {
  programs:    Program[];
  teamMembers: TeamMember[];
  year:        number;
  month:       number;
}

function emptySlots(): ProgramSlots {
  return {
    FIRST:  { userId: "", endsOn: "" },
    SECOND: { userId: "", endsOn: "" },
    THIRD:  { userId: "", endsOn: "" },
    FOURTH: { userId: "", endsOn: "" },
    FIFTH:  { userId: "", endsOn: "" },
  };
}

export default function RotationsClient({ programs, teamMembers, year, month }: Props) {
  // rotations[programSlug] = { FIRST: SlotState, ... }
  const [rotations, setRotations] = useState<Record<string, ProgramSlots>>({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState<Set<string>>(new Set());
  const [saved, setSaved]         = useState<Set<string>>(new Set());
  const [error, setError]         = useState<string | null>(null);

  // Load existing standing assignments on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/host/standing-assignments");
        if (!res.ok) throw new Error("Failed to load rotations");
        const data: StandingAssignment[] = await res.json();

        const map: Record<string, ProgramSlots> = {};
        for (const prog of programs) {
          map[prog.slug] = emptySlots();
        }
        for (const sa of data) {
          if (!map[sa.programSlug]) map[sa.programSlug] = emptySlots();
          map[sa.programSlug][sa.occurrence] = {
            userId: sa.userId,
            endsOn: sa.endsOn ? sa.endsOn.slice(0, 10) : "",
          };
        }
        setRotations(map);
      } catch (e) {
        setError("Could not load rotations. Please refresh.");
      } finally {
        setLoading(false);
      }
    })();
  }, [programs]);

  const updateSlot = useCallback(
    (programSlug: string, occ: Occurrence, field: keyof SlotState, value: string) => {
      setRotations((prev) => ({
        ...prev,
        [programSlug]: {
          ...(prev[programSlug] ?? emptySlots()),
          [occ]: {
            ...(prev[programSlug]?.[occ] ?? { userId: "", endsOn: "" }),
            [field]: value,
          },
        },
      }));
      // Clear the "saved" indicator when a change is made
      setSaved((prev) => {
        const next = new Set(prev);
        next.delete(programSlug);
        return next;
      });
    },
    []
  );

  const saveRotation = useCallback(
    async (programSlug: string) => {
      const slots = rotations[programSlug];
      if (!slots) return;

      setSaving((prev) => new Set([...prev, programSlug]));
      setError(null);

      try {
        // Build slot list — only include filled (assigned) slots
        const slotPayload = OCCURRENCES
          .filter((occ) => slots[occ].userId !== "")
          .map((occ) => ({
            occurrence: occ,
            userId:     slots[occ].userId,
            endsOn:     slots[occ].endsOn || null,
          }));

        // 1. Save the rotation pattern
        const saveRes = await fetch("/api/host/standing-assignments", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ programSlug, slots: slotPayload }),
        });
        if (!saveRes.ok) throw new Error("Failed to save rotation");

        // 2. Apply immediately — fills open sessions this month
        const applyRes = await fetch("/api/host/standing-assignments/apply", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ programSlug, year, month }),
        });
        if (!applyRes.ok) throw new Error("Failed to apply rotation");

        const { created } = await applyRes.json() as { created: number };

        setSaved((prev) => new Set([...prev, programSlug]));
        if (created > 0) {
          // Brief toast-like message — we show it via the saved indicator
          setSaved((prev) => new Set([...prev, `${programSlug}:${created}`]));
        }
      } catch (e) {
        setError("Something went wrong saving this rotation. Please try again.");
      } finally {
        setSaving((prev) => {
          const next = new Set(prev);
          next.delete(programSlug);
          return next;
        });
      }
    },
    [rotations, year, month]
  );

  if (loading) {
    return <p className="hs-loading">Loading rotations…</p>;
  }

  return (
    <div className="hs-rot">
      <p className="hs-rot__intro">
        Set the standing host for each occurrence of every program. Saving a
        rotation immediately fills any open sessions this month and emails the
        assigned hosts. Changes take effect next run for future months.
      </p>

      {error && <p className="hs-rot__error">{error}</p>}

      {programs.length === 0 && (
        <p className="hs-rot__empty">No virtual or hybrid programs found.</p>
      )}

      {programs.map((prog) => {
        const slots    = rotations[prog.slug] ?? emptySlots();
        const isSaving = saving.has(prog.slug);
        const isSaved  = saved.has(prog.slug);
        // Extract applied count if any
        const appliedEntry = [...saved].find((k) => k.startsWith(`${prog.slug}:`));
        const appliedCount = appliedEntry ? parseInt(appliedEntry.split(":")[1], 10) : 0;

        return (
          <div key={prog.slug} className="hs-rot__program">
            <div className="hs-rot__program-header">
              <span className="hs-rot__program-name">{prog.name}</span>
              <span className="hs-rot__program-format">
                {prog.programFormat === "virtual" ? "Virtual" : "In-person and virtual"}
              </span>
            </div>

            <div className="hs-rot__slots">
              {OCCURRENCES.map((occ) => {
                const slot = slots[occ];
                const isLast = occ === "FIFTH";
                return (
                  <div key={occ} className={`hs-rot__slot${isLast ? " hs-rot__slot--fifth" : ""}`}>
                    <span className="hs-rot__slot-label">{OCC_LABEL[occ]}</span>
                    <select
                      className="hs-rot__select"
                      value={slot.userId}
                      onChange={(e) => updateSlot(prog.slug, occ, "userId", e.target.value)}
                      aria-label={`Host for ${OCC_LABEL[occ]} of ${prog.name}`}
                    >
                      <option value="">— Unassigned —</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.displayName}{m.isCoordinator ? " ★" : ""}
                        </option>
                      ))}
                    </select>

                    {slot.userId !== "" && (
                      <div className="hs-rot__ends-on">
                        <label className="hs-rot__ends-label" htmlFor={`ends-${prog.slug}-${occ}`}>
                          End date
                        </label>
                        <input
                          id={`ends-${prog.slug}-${occ}`}
                          type="date"
                          className="hs-rot__date-input"
                          value={slot.endsOn}
                          onChange={(e) => updateSlot(prog.slug, occ, "endsOn", e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="hs-rot__footer">
              <button
                className="hs-rot__save"
                onClick={() => saveRotation(prog.slug)}
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : "Save rotation"}
              </button>
              {isSaved && (
                <span className="hs-rot__saved-msg">
                  ✓ Saved
                  {appliedCount > 0 && ` · ${appliedCount} session${appliedCount === 1 ? "" : "s"} filled this month`}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
