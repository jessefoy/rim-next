"use client";

/**
 * RotationsClient — coordinator standing-rotation management (v3).
 *
 * Layout: one card per program. Inside each card, a grid showing each day the
 * program runs on (rows) × occurrence positions 1st–5th (columns). Cells show
 * the assigned host name. Click a row to edit its rotation via the inline
 * pattern form.
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ Awakening The Heart                                        │
 *   │              1st       2nd       3rd       4th     5th     │
 *   │ Monday       Stacy     Silvia    Stacy     Silvia  Nancy   │ [Edit]
 *   │ Tuesday      Maria     Maria     Silvia    Silvia  Nancy   │ [Edit]
 *   │ Thursday     Nancy     Nancy     Nancy     Nancy   Nancy   │ [Edit]
 *   │ Saturday     Daniela   Anne      Daniela   Wendy   Wendy   │ [Edit]
 *   │                                                             │
 *   │ + Add rotation for this program                             │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Edit/Add opens an inline form with a pattern picker (Same/Alternate/Pair/
 * Custom), conditional fields per pattern, and an optional 5th-week host.
 * Save runs the conflict-resolution modal scoped to (program, day).
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import RotationConflictModal from "./RotationConflictModal";

type Occurrence = "FIRST" | "SECOND" | "THIRD" | "FOURTH" | "FIFTH" | "LAST" | "ALL";
type DayOfWeek = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
type Pattern = "same" | "alternate" | "custom";

const DAY_LABEL: Record<DayOfWeek, string> = {
  SU: "Sunday", MO: "Monday", TU: "Tuesday", WE: "Wednesday",
  TH: "Thursday", FR: "Friday", SA: "Saturday",
};
const DAY_ORDER: DayOfWeek[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const DAY_TO_JS: Record<DayOfWeek, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

/** Return the next N dates (YYYY-MM-DD) that fall on the given day of week. */
function upcomingDates(dayOfWeek: DayOfWeek, count: number): string[] {
  const target = DAY_TO_JS[dayOfWeek];
  const today = new Date();
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Advance to next matching weekday (inclusive of today)
  while (cursor.getDay() !== target) cursor.setDate(cursor.getDate() + 1);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 7);
  }
  return out;
}

/** Return the 1-based occurrence count of a date within its month (e.g. 3rd Monday = 3). */
function occurrenceInMonth(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const jsDay = new Date(`${dateStr}T12:00:00`).getDay();
  let n = 0;
  for (let day = 1; day <= d; day++) {
    if (new Date(y, m - 1, day).getDay() === jsDay) n++;
  }
  return n;
}

/** Resolve the assigned host userId for one session given the current form state. */
function resolvePreviewHost(occN: number, form: FormState): string | undefined {
  // FIFTH override: if expanded + set, always wins for 5th occurrence
  if (occN === 5 && form.fifthExpanded && form.fifthHost) return form.fifthHost;

  switch (form.pattern) {
    case "same":
      // For "same" pattern without a 5th override, the ALL record covers 5th weeks too
      return form.hosts.every;
    case "alternate":
      return occN % 2 === 1 ? form.hosts.oddWk : form.hosts.evenWk;
    case "custom": {
      const keys: Array<keyof FormState["hosts"]> = ["first", "second", "third", "fourth"];
      return keys[occN - 1] !== undefined ? form.hosts[keys[occN - 1]] : undefined;
    }
  }
}

interface Program {
  id:             string | null;
  slug:           string;
  name:           string;
  programFormat:  string | null;
  recurrenceDays: string[];
}

interface TeamMember {
  id:            string;
  displayName:   string;
  isCoordinator: boolean;
}

interface Rotation {
  id:          string;
  programSlug: string;
  dayOfWeek:   DayOfWeek | null;
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
  /** HOST_MANAGER / ADMIN / hub coordinator — shows per-program and global reset controls. */
  isManager?: boolean;
  /** Called after any rotation change that may have created/modified HostAssignment
   *  rows so the parent (Schedule view) can refresh its display. */
  onScheduleStale?: () => void;
}

interface FormState {
  programSlug: string;
  dayOfWeek:   DayOfWeek;
  pattern:     Pattern;
  hosts: {
    every?:  string;        // same: every week
    oddWk?:  string;        // alternate: 1st & 3rd
    evenWk?: string;        // alternate: 2nd & 4th
    first?:  string;        // custom: 1st
    second?: string;        // custom: 2nd
    third?:  string;        // custom: 3rd
    fourth?: string;        // custom: 4th
  };
  fifthHost:      string;
  fifthExpanded:  boolean;  // whether the 5th-week reveal is open
  endsOn:         string;
}

// ─── Pattern detection ──────────────────────────────────────────────────────

interface ResolvedCells {
  FIRST?:  string;
  SECOND?: string;
  THIRD?:  string;
  FOURTH?: string;
  FIFTH?:  string;
}

/** Resolve the visible host for each numeric occurrence, applying specificity. */
function resolveCells(rows: Rotation[]): ResolvedCells {
  const allHost = rows.find((r) => r.occurrence === "ALL")?.userId;
  const cells: ResolvedCells = {};
  for (const occ of ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH"] as const) {
    const specific = rows.find((r) => r.occurrence === occ)?.userId;
    cells[occ] = specific ?? allHost;
  }
  return cells;
}

/** Detect the pattern from a (program, day) bundle's rows. */
function detectPattern(rows: Rotation[]): { pattern: Pattern; hosts: FormState["hosts"]; fifthHost: string } {
  const cells = resolveCells(rows);
  const fifthRow = rows.find((r) => r.occurrence === "FIFTH");
  const fifthHost = fifthRow?.userId ?? "";

  // "Same every week" — all four numeric cells point to the same person
  if (
    cells.FIRST && cells.FIRST === cells.SECOND
                && cells.FIRST === cells.THIRD
                && cells.FIRST === cells.FOURTH
  ) {
    return { pattern: "same", hosts: { every: cells.FIRST }, fifthHost };
  }

  // "Alternate" — 1st === 3rd, 2nd === 4th, 1st !== 2nd
  if (
    cells.FIRST && cells.SECOND
    && cells.FIRST === cells.THIRD
    && cells.SECOND === cells.FOURTH
    && cells.FIRST !== cells.SECOND
  ) {
    return {
      pattern: "alternate",
      hosts: { oddWk: cells.FIRST, evenWk: cells.SECOND },
      fifthHost,
    };
  }

  // Otherwise custom — emit each filled cell (handles "pair" rotations saved
  // before this pattern was removed; they fall through correctly)
  return {
    pattern: "custom",
    hosts: {
      first:  cells.FIRST  ?? "",
      second: cells.SECOND ?? "",
      third:  cells.THIRD  ?? "",
      fourth: cells.FOURTH ?? "",
    },
    fifthHost,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function RotationsClient({ programs, teamMembers, year, month, isManager = false, onScheduleStale }: Props) {
  const [rotations, setRotations] = useState<Rotation[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [toast, setToast]         = useState<string | null>(null);

  // Editing state — only one bundle (programSlug, dayOfWeek) edits at a time
  const [editing, setEditing] = useState<{ programSlug: string; dayOfWeek: DayOfWeek } | null>(null);
  const [form, setForm]       = useState<FormState | null>(null);
  const [saving, setSaving]   = useState(false);

  // End/manage panel — tracks which bundle is open + which view is showing
  const [endingBundle, setEndingBundle]   = useState<{ programSlug: string; dayOfWeek: DayOfWeek } | null>(null);
  // "options" = main three choices; "release-picker" = per-person release sub-view
  const [endPanelView, setEndPanelView]   = useState<"options" | "release-picker">("options");
  const [releasing, setReleasing]         = useState(false);

  // Per-program Reset confirm
  const [progResetConfirm, setProgResetConfirm] = useState<string | null>(null);
  const [progClearing, setProgClearing]          = useState(false);

  // Conflict modal — shown ONLY when there are real conflicts to decide.
  // Empty previews and conflict-free fills get a toast instead.
  const [pendingApply, setPendingApply] = useState<{ programSlug: string; dayOfWeek: DayOfWeek } | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // ── Release-host (called from inside the manage panel) ───────────────────
  const handleReleaseHost = async (programSlug: string, dayOfWeek: DayOfWeek, userId: string) => {
    setReleasing(true);
    setError(null);
    try {
      const res = await fetch("/api/host/standing-assignments/release-host", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ programSlug, dayOfWeek, userId }),
      });
      if (!res.ok) throw new Error("release failed");
      const data = await res.json().catch(() => ({ released: 0 }));
      setEndingBundle(null);
      setEndPanelView("options");
      if (data.released > 0) {
        showToast(`Released · ${data.released} upcoming session${data.released === 1 ? "" : "s"} freed`);
        onScheduleStale?.();
      } else {
        showToast("No upcoming sessions found for this host");
      }
    } catch {
      setError("Could not release sessions. Please try again.");
    } finally {
      setReleasing(false);
    }
  };

  // ── Per-program Reset ──────────────────────────────────────────────────────
  const handleProgReset = async (slug: string) => {
    setProgClearing(true);
    setError(null);
    try {
      const res = await fetch(`/api/host/programs/${slug}/clear-rotations`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mode: "reset" }),
      });
      if (!res.ok) throw new Error("reset failed");
      const data = await res.json();
      const aCount = data.deletedAssignments ?? 0;
      const rCount = data.deletedRotations   ?? 0;
      showToast(`Reset · ${aCount} session${aCount === 1 ? "" : "s"} and ${rCount} rotation${rCount === 1 ? "" : "s"} removed`);
      setProgResetConfirm(null);
      await loadRotations();
      onScheduleStale?.();
    } catch {
      setError("Could not reset rotations. Please try again.");
    } finally {
      setProgClearing(false);
    }
  };

  // Danger-zone state — two-step confirm before clearing
  // "soft"     → scope: future, rotations stay
  // "nuclear"  → scope: all + endRotations, true fresh start
  const [clearConfirm, setClearConfirm] = useState<"soft" | "nuclear" | null>(null);
  const [clearing, setClearing]         = useState(false);

  const handleClear = async (mode: "soft" | "nuclear") => {
    setClearing(true);
    setError(null);
    try {
      const payload = mode === "soft"
        ? { scope: "future", endRotations: false }
        : { scope: "all",    endRotations: true  };
      const res = await fetch("/api/host/assignments/clear", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "clear failed");
      }
      const data = await res.json();
      const aCount = data.deletedAssignments ?? 0;
      const rCount = data.deletedRotations   ?? 0;
      const summary = mode === "soft"
        ? `Cleared · ${aCount} upcoming host assignment${aCount === 1 ? "" : "s"} removed`
        : `Reset · ${aCount} assignment${aCount === 1 ? "" : "s"} and ${rCount} rotation${rCount === 1 ? "" : "s"} removed`;
      showToast(summary);
      setClearConfirm(null);
      // Refresh both: rotations grid (in case rotations were ended) and
      // schedule view (host assignments changed).
      await loadRotations();
      onScheduleStale?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear assignments.");
    } finally {
      setClearing(false);
    }
  };

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

  // ── Group rotations by (programSlug, dayOfWeek) ───────────────────────
  const rotationsByBundle = useMemo(() => {
    const map = new Map<string, Rotation[]>();
    for (const r of rotations) {
      // For legacy rows with null dayOfWeek, group them under their program's
      // primary day if single-day, otherwise treat as "any" (display under all days).
      const key = `${r.programSlug}::${r.dayOfWeek ?? ""}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [rotations]);

  // ── Form open / close ─────────────────────────────────────────────────
  // For empty rows the form starts in "create" mode (Same pattern, no hosts).
  // For filled rows the form pre-fills from detected pattern + existing hosts.
  const startEdit = (programSlug: string, dayOfWeek: DayOfWeek) => {
    const rows = rotationsByBundle.get(`${programSlug}::${dayOfWeek}`) ?? [];
    if (rows.length === 0) {
      // Fresh setup
      setForm({
        programSlug,
        dayOfWeek,
        pattern:       "same",
        hosts:         {},
        fifthHost:     "",
        fifthExpanded: false,
        endsOn:        "",
      });
    } else {
      const detected = detectPattern(rows);
      // Only pre-fill endsOn if it's a real future date. Ended rotations have
      // endsOn = today (or earlier), and pre-filling that would cause re-saves
      // to silently re-end the rotation.
      const todayStr = new Date().toISOString().slice(0, 10);
      const rawEndsOn = rows[0]?.endsOn?.slice(0, 10) ?? "";
      const endsOn = rawEndsOn && rawEndsOn > todayStr ? rawEndsOn : "";
      setForm({
        programSlug,
        dayOfWeek,
        pattern:       detected.pattern,
        hosts:         detected.hosts,
        fifthHost:     detected.fifthHost,
        fifthExpanded: !!detected.fifthHost,  // expand if already set
        endsOn,
      });
    }
    setEditing({ programSlug, dayOfWeek });
    setEndingBundle(null);
    setError(null);
  };

  const cancelForm = () => {
    setForm(null);
    setEditing(null);
    setError(null);
  };

  // ── Save ──────────────────────────────────────────────────────────────
  // Three-branch flow after the records are saved:
  //   1. Preview empty (no opens, no conflicts) → toast "Saved" only
  //   2. Open slots only (no conflicts) → silent auto-apply with `leave` mode,
  //      toast "Saved · N filled this month"
  //   3. Has conflicts → open the conflict modal so coordinator decides
  // The modal is reserved for the actual decision moment.
  const handleSave = async () => {
    if (!form) return;

    const filled = Object.values(form.hosts).some((v) => v && v.length > 0);
    if (!filled) {
      setError("Pick at least one person before saving.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // ATOMIC save+apply. The POST handler now upserts rotation records AND
      // runs apply with 'leave' mode for current+next month inside one
      // request. Returns { saved, filled, conflictCount }. Eliminates the
      // previous 3-fetch chain (save → preview → apply) which had multiple
      // failure points and a misleading "already covered" toast that fired
      // both for genuine no-ops AND for silent preview fetch errors.
      const saveRes = await fetch("/api/host/standing-assignments", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          programSlug: form.programSlug,
          dayOfWeek:   form.dayOfWeek,
          pattern:     form.pattern,
          hosts:       form.hosts,
          fifthHost:   form.fifthHost || null,
          endsOn:      form.endsOn || null,
        }),
      });
      if (!saveRes.ok) {
        const errBody = await saveRes.json().catch(() => null);
        throw new Error(errBody?.error || "save failed");
      }
      const data = await saveRes.json();
      const filled        = data.filled        ?? 0;
      const conflictCount = data.conflictCount ?? 0;
      const bundle = { programSlug: form.programSlug, dayOfWeek: form.dayOfWeek };

      await loadRotations();
      cancelForm();

      if (conflictCount > 0) {
        // Conflicts remain — open modal for coordinator decision. Opens
        // already filled by the leave-apply that just ran.
        setPendingApply(bundle);
        if (filled > 0) onScheduleStale?.();  // refresh anyway since opens were filled
      } else if (filled > 0) {
        const monthsSpanned = data.monthsSpanned ?? 1;
        const horizonText = monthsSpanned === 1
          ? "this month"
          : monthsSpanned === 2
            ? "this month and next"
            : `the next ${monthsSpanned} months`;
        showToast(`Rotation saved · ${filled} session${filled === 1 ? "" : "s"} filled across ${horizonText}`);
        onScheduleStale?.();
      } else {
        showToast("Rotation saved · all matching sessions already covered");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong saving. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── End bundle ────────────────────────────────────────────────────────
  const handleEnd = async (programSlug: string, dayOfWeek: DayOfWeek, releaseFuture: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/host/standing-assignments/end-bundle", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ programSlug, dayOfWeek, releaseFuture }),
      });
      if (!res.ok) throw new Error("end failed");
      const data = await res.json().catch(() => ({ ended: 0, released: 0 }));
      await loadRotations();
      setEndingBundle(null);
      if (releaseFuture && data.released > 0) {
        showToast(`Rotation ended · ${data.released} future session${data.released === 1 ? "" : "s"} released`);
        onScheduleStale?.();
      } else {
        showToast("Rotation ended");
        // Even when not releasing, the rotation's endsOn changed — schedule's
        // "via rotation" pill / future cron behavior is affected. Refresh to be safe.
        onScheduleStale?.();
      }
    } catch {
      setError("Could not end this rotation. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
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

      {toast && <div className="hs-rot__toast">{toast}</div>}

      {programs.length === 0 && (
        <p className="hs-rot__empty">No programs available.</p>
      )}

      {programs.map((program) => {
        // Determine which days this program runs on (rows in the grid).
        // If recurrenceDays is empty (e.g. one-time program), there's nothing
        // to rotate — skip.
        if (!program.recurrenceDays || program.recurrenceDays.length === 0) {
          return null;
        }
        const days = DAY_ORDER.filter((d) => program.recurrenceDays.includes(d));
        const editingHere = editing?.programSlug === program.slug ? editing.dayOfWeek : null;

        return (
          <div key={program.slug} className="hs-rot__prog pe-card">
            <div className="hs-rot__prog-head">
              <h3 className="hs-rot__prog-name">{program.name}</h3>
              {program.programFormat && (
                <span className="hs-rot__prog-format">
                  {program.programFormat === "virtual" ? "Virtual" : "In-person and virtual"}
                </span>
              )}
            </div>

            <div className={`hs-rot__grid${editingHere ? " hs-rot__grid--editing" : ""}`}>
              <div className="hs-rot__grid-head">
                <div></div>
                <div>1st</div>
                <div>2nd</div>
                <div>3rd</div>
                <div>4th</div>
                <div>5th</div>
                <div></div>
              </div>

              {days.map((d) => {
                const rows = rotationsByBundle.get(`${program.slug}::${d}`) ?? [];
                const cells = resolveCells(rows);
                const fifthHost = rows.find((r) => r.occurrence === "FIFTH")?.userId ?? cells.FIFTH;
                const isEditingThis = editingHere === d;

                const hostName = (uid?: string) => {
                  if (!uid) return null;
                  const m = teamMembers.find((tm) => tm.id === uid);
                  return m?.displayName ?? "—";
                };

                return (
                  <div key={d} className={`hs-rot__grid-row-wrap${isEditingThis ? " hs-rot__grid-row-wrap--active" : ""}`}>
                    <div className="hs-rot__grid-row">
                      <div className="hs-rot__grid-day">{DAY_LABEL[d]}</div>
                      <div className="hs-rot__grid-cell" data-label="1st">{hostName(cells.FIRST)  ?? <span className="hs-rot__cell-empty">—</span>}</div>
                      <div className="hs-rot__grid-cell" data-label="2nd">{hostName(cells.SECOND) ?? <span className="hs-rot__cell-empty">—</span>}</div>
                      <div className="hs-rot__grid-cell" data-label="3rd">{hostName(cells.THIRD)  ?? <span className="hs-rot__cell-empty">—</span>}</div>
                      <div className="hs-rot__grid-cell" data-label="4th">{hostName(cells.FOURTH) ?? <span className="hs-rot__cell-empty">—</span>}</div>
                      <div className="hs-rot__grid-cell hs-rot__grid-cell--fifth" data-label="5th">
                        {hostName(fifthHost) ?? <span className="hs-rot__cell-empty">—</span>}
                      </div>
                      <div className="hs-rot__grid-actions">
                        {rows.length > 0 ? (
                          <>
                            <button className="hs-rot__action" onClick={() => { setEndingBundle(null); setEndPanelView("options"); startEdit(program.slug, d); }}>Edit</button>
                            <button className="hs-rot__action hs-rot__action--end" onClick={() => { cancelForm(); setEndPanelView("options"); setEndingBundle({ programSlug: program.slug, dayOfWeek: d }); }}>End</button>
                          </>
                        ) : (
                          <button className="hs-rot__action" onClick={() => startEdit(program.slug, d)}>Set up</button>
                        )}
                      </div>
                    </div>

                    {/* Manage-rotation panel — End button opens this */}
                    {endingBundle?.programSlug === program.slug && endingBundle?.dayOfWeek === d && (() => {
                      const distinctHosts = [...new Set(
                        [cells.FIRST, cells.SECOND, cells.THIRD, cells.FOURTH, fifthHost]
                          .filter((uid): uid is string => !!uid)
                      )];
                      return (
                        <div className="hs-rot__end-confirm">
                          {endPanelView === "options" ? (
                            <>
                              <p className="hs-rot__end-q">Manage this rotation</p>
                              {isManager && (
                                <button className="hs-rot__end-opt" onClick={() => setEndPanelView("release-picker")} disabled={saving || releasing}>
                                  <strong>Release one person&rsquo;s upcoming dates.</strong>
                                  <span>Frees their sessions so others can claim them. The rotation stays active and can be edited.</span>
                                </button>
                              )}
                              <button className="hs-rot__end-opt hs-rot__end-opt--release" onClick={() => handleEnd(program.slug, d, true)} disabled={saving || releasing}>
                                <strong>End this rotation.</strong>
                                <span>Stops generating new sessions and clears all upcoming dates from hosts&rsquo; schedules. Each affected host is emailed.</span>
                              </button>
                              <button className="hs-rot__end-cancel" onClick={() => setEndingBundle(null)} disabled={saving || releasing}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <p className="hs-rot__end-q">
                                Release upcoming sessions for a host in this rotation.
                                <span className="hs-rot__end-q-sub"> The rotation stays active.</span>
                              </p>
                              <div className="hs-rot__release-hosts">
                                {distinctHosts.map((uid) => (
                                  <div key={uid} className="hs-rot__release-row">
                                    <span className="hs-rot__release-name">{hostName(uid)}</span>
                                    <button
                                      className="hs-rot__release-btn"
                                      onClick={() => handleReleaseHost(program.slug, d, uid)}
                                      disabled={releasing}
                                    >
                                      {releasing ? "Releasing…" : "Release their dates"}
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <button className="hs-rot__end-cancel" onClick={() => setEndPanelView("options")} disabled={releasing}>← Back</button>
                            </>
                          )}
                        </div>
                      );
                    })()}

                    {/* Inline edit form */}
                    {isEditingThis && form && (
                      <RotationForm
                        form={form}
                        setForm={setForm}
                        teamMembers={teamMembers}
                        saving={saving}
                        onSave={handleSave}
                        onCancel={cancelForm}
                        showDayPicker={false}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Per-program Reset — manager/coordinator only; shown only when rotations exist */}
            {isManager && (() => {
              const hasRotations = days.some((d) =>
                (rotationsByBundle.get(`${program.slug}::${d}`) ?? []).length > 0
              );
              if (!hasRotations) return null;
              const confirming = progResetConfirm === program.slug;
              return (
                <div className="hs-rot__prog-danger">
                  {!confirming ? (
                    <button
                      className="hs-rot__prog-danger-btn hs-rot__prog-danger-btn--reset"
                      onClick={() => setProgResetConfirm(program.slug)}
                    >
                      Reset rotations
                    </button>
                  ) : (
                    <div className="hs-rot__prog-danger-confirm">
                      <p className="hs-rot__prog-danger-q">
                        <strong>Reset rotations for {program.name}?</strong><br />
                        Deletes all rotation rules <em>and</em> removes all upcoming assignments
                        for this program. The rotation grid becomes empty.
                      </p>
                      <div className="hs-rot__prog-danger-confirm-actions">
                        <button
                          className="hs-rot__prog-danger-btn hs-rot__prog-danger-btn--reset"
                          onClick={() => handleProgReset(program.slug)}
                          disabled={progClearing}
                        >
                          {progClearing ? "Working…" : "Yes, reset rotations"}
                        </button>
                        <button
                          className="hs-rot__danger-cancel"
                          onClick={() => setProgResetConfirm(null)}
                          disabled={progClearing}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

          </div>
        );
      })}

      {pendingApply && (
        <RotationConflictModal
          programSlug={pendingApply.programSlug}
          dayOfWeek={pendingApply.dayOfWeek}
          year={year}
          month={month}
          onClose={() => setPendingApply(null)}
          onApplied={() => onScheduleStale?.()}
        />
      )}

      {/* Danger zone — manager/coordinator access.
          Two intents:
            soft     → wipe upcoming schedule, rotations stay
            nuclear  → delete EVERYTHING (assignments + rotation rules) */}
      {isManager && (
        <div className="hs-rot__danger">
          <h3 className="hs-rot__danger-h">Reset</h3>
          <p className="hs-rot__danger-hint">
            For redoing the schedule or starting fresh during testing.
          </p>

          {clearConfirm === null ? (
            <div className="hs-rot__danger-actions">
              <button
                className="hs-rot__danger-btn"
                onClick={() => setClearConfirm("soft")}
              >
                Clear upcoming schedule
              </button>
              <button
                className="hs-rot__danger-btn hs-rot__danger-btn--all"
                onClick={() => setClearConfirm("nuclear")}
              >
                Reset everything
              </button>
            </div>
          ) : (
            <div className="hs-rot__danger-confirm">
              <p className="hs-rot__danger-q">
                {clearConfirm === "soft" ? (
                  <>
                    <strong>Clear upcoming schedule?</strong><br />
                    Deletes every host assignment from today forward. Past
                    assignments stay intact. Standing rotation rules are kept —
                    they'll re-fill on the next save or cron run.
                  </>
                ) : (
                  <>
                    <strong>Reset everything?</strong><br />
                    Deletes <em>every</em> host assignment (past and future) AND
                    deletes <em>every</em> standing rotation rule. The schedule
                    becomes blank and the Rotations grid becomes empty. Use only
                    when redoing the entire host system from scratch. Cannot be
                    undone.
                  </>
                )}
              </p>
              <div className="hs-rot__danger-confirm-actions">
                <button
                  className={`hs-rot__danger-btn${clearConfirm === "nuclear" ? " hs-rot__danger-btn--all" : ""}`}
                  onClick={() => handleClear(clearConfirm)}
                  disabled={clearing}
                >
                  {clearing
                    ? "Working…"
                    : clearConfirm === "soft"
                      ? "Yes, clear upcoming"
                      : "Yes, reset everything"}
                </button>
                <button
                  className="hs-rot__danger-cancel"
                  onClick={() => setClearConfirm(null)}
                  disabled={clearing}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pattern form (inline) ─────────────────────────────────────────────────

interface FormProps {
  form:          FormState;
  setForm:       (f: FormState) => void;
  teamMembers:   TeamMember[];
  saving:        boolean;
  onSave:        () => void;
  onCancel:      () => void;
  showDayPicker: boolean;
  allowedDays?:  DayOfWeek[];
}

function RotationForm({ form, setForm, teamMembers, saving, onSave, onCancel, showDayPicker, allowedDays }: FormProps) {
  const personOptions = (
    <>
      <option value="">— pick a person —</option>
      {teamMembers.map((m) => (
        <option key={m.id} value={m.id}>
          {m.displayName}{m.isCoordinator ? " ★" : ""}
        </option>
      ))}
    </>
  );

  const setHosts = (next: Partial<FormState["hosts"]>) =>
    setForm({ ...form, hosts: { ...form.hosts, ...next } });

  const PATTERN_OPTIONS: Array<{ value: Pattern; label: string; hint: string }> = [
    { value: "same",      label: "Same every week", hint: "One person hosts every session" },
    { value: "alternate", label: "Alternate",       hint: "Two people, 1st & 3rd / 2nd & 4th" },
    { value: "custom",    label: "Custom",          hint: "Set each week independently" },
  ];

  return (
    <div className="hs-rot__form pe-form">
      {showDayPicker && allowedDays && allowedDays.length > 1 && (
        <div className="pe-field">
          <span className="pe-field__label">Day of week</span>
          <div className="pe-day-grid">
            {allowedDays.map((d) => (
              <label key={d} className="pe-day-toggle">
                <input
                  type="radio"
                  name="dayOfWeek"
                  checked={form.dayOfWeek === d}
                  onChange={() => setForm({ ...form, dayOfWeek: d })}
                />
                {DAY_LABEL[d].slice(0, 3)}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="pe-field">
        <span className="pe-field__label">Pattern</span>
        <span className="pe-field__help">How the rotation repeats each month.</span>
        <div className="pe-option-cards">
          {PATTERN_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`pe-option-card${form.pattern === opt.value ? " pe-option-card--active" : ""}`}
            >
              <input
                type="radio"
                name="pattern"
                checked={form.pattern === opt.value}
                onChange={() => setForm({ ...form, pattern: opt.value, hosts: {} })}
              />
              <span className="pe-option-card__mark" />
              <span className="hs-rot__pattern-label">
                <strong>{opt.label}</strong>
                <small>{opt.hint}</small>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Pattern-specific fields */}
      {form.pattern === "same" && (
        <div className="pe-field">
          <span className="pe-field__label">Host every week</span>
          <select
            className="pe-select"
            value={form.hosts.every ?? ""}
            onChange={(e) => setHosts({ every: e.target.value })}
          >
            {personOptions}
          </select>
        </div>
      )}

      {form.pattern === "alternate" && (
        <>
          <div className="pe-field">
            <span className="pe-field__label">1st &amp; 3rd weeks</span>
            <select
              className="pe-select"
              value={form.hosts.oddWk ?? ""}
              onChange={(e) => setHosts({ oddWk: e.target.value })}
            >
              {personOptions}
            </select>
          </div>
          <div className="pe-field">
            <span className="pe-field__label">2nd &amp; 4th weeks</span>
            <select
              className="pe-select"
              value={form.hosts.evenWk ?? ""}
              onChange={(e) => setHosts({ evenWk: e.target.value })}
            >
              {personOptions}
            </select>
          </div>
        </>
      )}

      {form.pattern === "custom" && (
        <>
          {(["first", "second", "third", "fourth"] as const).map((k, i) => (
            <div key={k} className="pe-field">
              <span className="pe-field__label">{["1st", "2nd", "3rd", "4th"][i]} of month</span>
              <select
                className="pe-select"
                value={form.hosts[k] ?? ""}
                onChange={(e) => setHosts({ [k]: e.target.value })}
              >
                {personOptions}
              </select>
            </div>
          ))}
        </>
      )}

      {/* 5th-week host — collapsed by default; expand via link.
          Same pattern: blank = main host covers 5ths automatically (ALL record).
          Other patterns: blank = skip 5th-week occurrences (no FIFTH record).
          Most months don't have a 5th occurrence so this stays out of the way. */}
      {form.fifthExpanded ? (
        <div className="pe-field">
          <span className="pe-field__label">
            {form.pattern === "same" ? "5th-week override (optional)" : "5th-week host"}
          </span>
          <span className="pe-field__help">
            {form.pattern === "same"
              ? "Leave blank and the main host covers 5th weeks automatically."
              : "For months with a 5th occurrence (rare). Leave blank to skip those weeks."}
          </span>
          <div className="pe-inline-row">
            <select
              className="pe-select"
              value={form.fifthHost}
              onChange={(e) => setForm({ ...form, fifthHost: e.target.value })}
            >
              <option value="">{form.pattern === "same" ? "— Same as main host —" : "— Skip 5th weeks —"}</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}{m.isCoordinator ? " ★" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="hs-rot__form-link"
              onClick={() => setForm({ ...form, fifthHost: "", fifthExpanded: false })}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="hs-rot__form-link"
          onClick={() => setForm({ ...form, fifthExpanded: true })}
        >
          {form.pattern === "same" ? "+ Override 5th week (optional)" : "+ Assign 5th-week host (optional)"}
        </button>
      )}

      {/* End date — collapsed under affordance */}
      {form.endsOn ? (
        <div className="pe-field">
          <span className="pe-field__label">Until</span>
          <div className="pe-inline-row">
            <input
              type="date"
              className="pe-input"
              value={form.endsOn}
              onChange={(e) => setForm({ ...form, endsOn: e.target.value })}
            />
            <button
              type="button"
              className="hs-rot__form-link"
              onClick={() => setForm({ ...form, endsOn: "" })}
            >
              Remove end date
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="hs-rot__form-link"
          onClick={() => setForm({
            ...form,
            // Default end date = last day of the current year. Most rotations
            // are reviewed annually; this matches the natural cadence and
            // saves the coordinator from typing the date manually. They can
            // change it before saving or remove it entirely.
            endsOn: `${new Date().getFullYear()}-12-31`,
          })}
        >
          + Add an end date (optional)
        </button>
      )}

      {/* Pattern preview — shows next 6 occurrences with projected hosts.
          Only renders when at least one host field is filled so the preview
          isn't confusing while the form is still being set up. */}
      {(() => {
        const hasAnyHost = Object.values(form.hosts).some((v) => v);
        if (!hasAnyHost) return null;
        const dates = upcomingDates(form.dayOfWeek, 6);
        const rows = dates.map((dateStr) => {
          const occN = occurrenceInMonth(dateStr);
          const userId = resolvePreviewHost(occN, form);
          const hostName = userId ? (teamMembers.find((m) => m.id === userId)?.displayName ?? null) : null;
          const label = new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
            month: "short", day: "numeric",
          });
          return { dateStr, label, occN, hostName };
        });
        return (
          <div className="hs-rot__preview">
            <span className="hs-rot__preview-label">Preview</span>
            <div className="hs-rot__preview-rows">
              {rows.map((r) => (
                <div key={r.dateStr} className="hs-rot__preview-row">
                  <span className="hs-rot__preview-date">{r.label}</span>
                  <span className={`hs-rot__preview-host${!r.hostName ? " hs-rot__preview-host--empty" : ""}`}>
                    {r.hostName ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="hs-rot__form-actions">
        <button className="hs-rot__form-save" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save & apply"}
        </button>
        <button className="hs-rot__form-cancel" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}
