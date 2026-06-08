"use client";

/**
 * CoverageGrid — the coordinator's "whole picture" for one hub's month.
 *
 * Phase 2, slice 2 of the coordinator view (RIM_Scheduler.md). Maria's core
 * complaint was that the Scheduler is shaped for an individual host and forces
 * a coordinator to stitch the picture together across disjoint pages. This is
 * the single surface that shows it all at once: rows are program · day,
 * columns are the weeks of the displayed month, each cell is who's covering
 * that week's session — or an amber gap. Gaps read straight down the columns.
 *
 * Two layouts, one data source (responsive, per RIM's mobile-first rule):
 *   wide  → the grid (programs × weeks)
 *   phone → a gap-first list ("Needs coverage" on top, "Covered" below)
 *
 * Scope (slice 2): see the whole + fill a gap in place — it reuses the parent's
 * assignMember handler (the coordinator assign-others path from slice 1), so a
 * fill updates the parent's `sessions` and the cell re-renders as covered.
 * Covered cells are read-only here; inline rotation editing + a "what changes"
 * preview are slice 3. Single-slot hubs only — greeter (multi-claim) is a
 * different model, and the parent hides this view for it.
 */

import { useState } from "react";
import type { Session } from "./HubScheduleClient";

const TZ = "America/Chicago";
const WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Props {
  sessions: Session[];
  teamMembers: { id: string; displayName: string; isCoordinator: boolean }[];
  currentUserId: string;
  /** Hub coverage noun ("Host" / "AV" / "Greeter" / "Facilitator"). */
  coverageNoun: string;
  monthLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** Fill a gap in place — the parent's assignMember (slice 1). */
  onAssign: (s: Session, userId: string) => void | Promise<void>;
}

// All CT, to stay aligned with the rest of the scheduler's date handling.
// NOTE: ctWeekStartMs mirrors HubScheduleClient.getWeekStart (Monday-anchored
// week start) exactly — keep them in sync. Worth consolidating into
// lib/scheduleUtils.ts (dependency-free / client-safe) in a follow-up.
function ctWeekStartMs(iso: string): number {
  const ct = new Date(new Date(iso).toLocaleString("en-US", { timeZone: TZ }));
  const dow = ct.getDay();
  ct.setDate(ct.getDate() + (dow === 0 ? -6 : 1 - dow));
  ct.setHours(0, 0, 0, 0);
  return ct.getTime();
}
function ctWeekday(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" });
}
function ctMonthDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" });
}
function ctTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}
function weekColLabel(ms: number): string {
  return "Wk " + new Date(ms).toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" });
}
function isGap(s: Session): boolean {
  return s.status === "unclaimed" || !s.hostUserId;
}

export default function CoverageGrid({
  sessions, teamMembers, currentUserId, coverageNoun, monthLabel, onPrevMonth, onNextMonth, onAssign,
}: Props) {
  // Which gap cell is currently showing its picker. One at a time.
  const [editingId, setEditingId] = useState<string | null>(null);

  // Single-slot occurrences only (defensive — the parent gates greeter out).
  const cells = sessions.filter((s) => s.sessionDate && !s.id.startsWith("multi::"));

  // Rows = program · weekday; columns = distinct week-starts (CT). A given
  // (program, weekday, week) has at most one occurrence, so each cell is unique.
  const rowMeta = new Map<string, { programName: string; weekday: string }>();
  const weekSet = new Set<number>();
  const cellMap = new Map<string, Session>();
  for (const s of cells) {
    const wd = ctWeekday(s.sessionDate!);
    const ws = ctWeekStartMs(s.sessionDate!);
    const rowKey = `${s.programSlug}::${wd}`;
    if (!rowMeta.has(rowKey)) rowMeta.set(rowKey, { programName: s.programName, weekday: wd });
    weekSet.add(ws);
    cellMap.set(`${rowKey}::${ws}`, s);
  }
  const weekCols = [...weekSet].sort((a, b) => a - b);
  const rows = [...rowMeta.entries()].sort((a, b) => {
    const byName = a[1].programName.localeCompare(b[1].programName);
    return byName !== 0 ? byName : WEEKDAY_ORDER.indexOf(a[1].weekday) - WEEKDAY_ORDER.indexOf(b[1].weekday);
  });

  const gaps = cells
    .filter(isGap)
    .sort((a, b) => new Date(a.sessionDate!).getTime() - new Date(b.sessionDate!).getTime());

  const nounLower = coverageNoun.toLowerCase() === "av" ? "AV" : coverageNoun.toLowerCase();

  function Picker({ s }: { s: Session }) {
    return (
      <select
        className="cov-cell__select"
        defaultValue=""
        autoFocus
        onChange={async (e) => {
          const uid = e.target.value;
          setEditingId(null);
          if (uid) await onAssign(s, uid);
        }}
      >
        <option value="">Choose a person…</option>
        {teamMembers.map((m) => (
          <option key={m.id} value={m.id}>{m.displayName}{m.isCoordinator ? " ★" : ""}</option>
        ))}
      </select>
    );
  }

  function gridCell(s: Session | undefined) {
    if (!s) return <span className="cov-cell__empty" aria-hidden="true">·</span>;
    if (isGap(s)) {
      return editingId === s.id
        ? <Picker s={s} />
        : <button className="cov-cell__gap" onClick={() => setEditingId(s.id)}>Fill</button>;
    }
    const name = s.hostUserId === currentUserId ? "You" : (s.hostName ?? "—");
    const sub = s.status === "sub_needed";
    return (
      <span className={`cov-cell__host${sub ? " cov-cell__host--sub" : ""}`} title={sub ? "Sub requested" : undefined}>
        {name}{sub ? " ⚠" : ""}
      </span>
    );
  }

  function coveredHosts(rowKey: string): string[] {
    const seen = new Set<string>();
    for (const ws of weekCols) {
      const s = cellMap.get(`${rowKey}::${ws}`);
      if (s && !isGap(s)) seen.add(s.hostUserId === currentUserId ? "You" : (s.hostName ?? "—"));
    }
    return [...seen];
  }
  // A row belongs in EITHER "Needs coverage" (its gap dates, listed above) OR
  // "Covered" (fully staffed) — never both. The mobile "Covered" list skips any
  // row that still has a gap this month.
  function rowHasGap(rowKey: string): boolean {
    return weekCols.some((ws) => {
      const s = cellMap.get(`${rowKey}::${ws}`);
      return s ? isGap(s) : false;
    });
  }

  return (
    <div className="cov">
      <div className="cov__head">
        <div className="cov__nav">
          <button className="cov__nav-btn" onClick={onPrevMonth} aria-label="Previous month">←</button>
          <span className="cov__month">{monthLabel}</span>
          <button className="cov__nav-btn" onClick={onNextMonth} aria-label="Next month">→</button>
        </div>
        <span className={`cov__gapcount${gaps.length > 0 ? " cov__gapcount--alert" : ""}`}>
          {gaps.length === 0 ? "Fully covered" : `${gaps.length} ${gaps.length === 1 ? "gap" : "gaps"}`}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="cov__empty">No sessions are scheduled with this team this month.</p>
      ) : (
        <>
          {/* Desktop: the grid */}
          <div className="cov__grid-wrap" role="region" aria-label="Coverage grid">
            <table className="cov__grid">
              <thead>
                <tr>
                  <th scope="col" className="cov__corner">Program</th>
                  {weekCols.map((ws) => <th key={ws} scope="col">{weekColLabel(ws)}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(([rowKey, r]) => (
                  <tr key={rowKey}>
                    <th scope="row" className="cov__rowhead">
                      <span className="cov__prog">{r.programName}</span>
                      <span className="cov__day">{r.weekday}</span>
                    </th>
                    {weekCols.map((ws) => (
                      <td key={ws} className="cov__cell">{gridCell(cellMap.get(`${rowKey}::${ws}`))}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone: gap-first list */}
          <div className="cov__list">
            <h3 className="cov__list-head cov__list-head--alert">
              {gaps.length === 0 ? `No ${nounLower} gaps this month` : `Needs coverage · ${gaps.length}`}
            </h3>
            {gaps.map((s) => (
              <div key={s.id} className="cov__list-row cov__list-row--gap">
                <div className="cov__list-meta">
                  <span className="cov__list-prog">{s.programName}</span>
                  <span className="cov__list-when">
                    {ctWeekday(s.sessionDate!)} {ctMonthDay(s.sessionDate!)} · {ctTime(s.sessionDate!)}
                  </span>
                </div>
                {editingId === s.id
                  ? <Picker s={s} />
                  : <button className="cov__list-fill" onClick={() => setEditingId(s.id)}>Fill →</button>}
              </div>
            ))}

            <h3 className="cov__list-head">Covered</h3>
            {rows.map(([rowKey, r]) => {
              const hosts = coveredHosts(rowKey);
              if (hosts.length === 0 || rowHasGap(rowKey)) return null;
              return (
                <div key={rowKey} className="cov__list-row">
                  <span className="cov__list-prog">{r.programName} · {r.weekday}</span>
                  <span className="cov__list-hosts">{hosts.join(", ")}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
