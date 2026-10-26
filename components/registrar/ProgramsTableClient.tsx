"use client";

import { useState, type RefObject } from "react";
import Link from "next/link";
import { ActionNotice, useActionNotice } from "@/components/FormDone";
import { FilterPills } from "@/components/FilterBar";
import { useNavigationDrawer } from "@/components/hooks/useNavigationDrawer";
import { OFFERING_CATEGORIES, OFFERING_FORMATS, categorySectionTitle, formatLabel } from "@/lib/programOffering";

export type ProgramRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  programFormat: string;
  registrationEnabled: boolean;
  registrationClosed: boolean;
  /** Where registration stands now, by the one rule (lib/registrationWindow.ts). */
  regWindow: "off" | "notYet" | "open" | "closed";
  /** "Nov 1, 2026" when it isn't open yet. */
  opensOn: string | null;
  registrationCapacity: number | null;
  archivedAt: string | null;
  /** The offering's Category and Format codes (lib/programOffering.ts), or null. */
  offeringCategory: string | null;
  offeringFormat: string | null;
  confirmedCount: number;
  waitlistedCount: number;
  pendingDanaCount: number;
  spotOpened: boolean;
  needsAttention: boolean;
};

type Filter = "all" | "open" | "waitlist" | "attention" | "archived";

export default function ProgramsTableClient({
  programs,
  hubBase,
  basePath: basePathProp,
  canSeePeople,
  canArchive,
  isAdmin,
}: {
  programs: ProgramRow[];
  hubBase?: string;
  /** Base path for program links (e.g. "/tools/programs"). Falls back to hubBase/programs. */
  basePath?: string;
  /** May open Registration: counts of people, waitlists and dana, and the
   *  People link (2026-10-24). Everyone using Programs may edit. */
  canSeePeople: boolean;
  /** Archive and restore: the Registrar, Admin and Guiding Teacher roles. */
  canArchive: boolean;
  isAdmin: boolean;
}) {
  const basePath = basePathProp ?? `${hubBase}/programs`;
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [confirming, setConfirming] = useState<{
    slug: string;
    action: "archive" | "restore" | "delete";
  } | null>(null);
  const [rows, setRows] = useState(programs);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const { notice, say } = useActionNotice();
  function closeDialog() {
    if (busy) return;
    setConfirming(null);
    setProblem("");
  }
  // The dialog takes focus (Cancel, its first button), keeps Tab and
  // Shift-Tab inside it, closes on Escape unless it is working, and gives
  // focus back to the button that opened it.
  const dialogRef = useNavigationDrawer(confirming !== null, closeDialog);
  // Filters by the offering's Category and Format ("" = all).
  const [categoryFilter, setCategoryFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState("");

  const searchLower = search.toLowerCase();

  // Separate active vs archived. The archive reads by recency — most recently
  // archived first — which is how a registrar actually looks for a program
  // that just concluded (the auto-archive cron feeds this list daily).
  const active = rows.filter((p) => !p.archivedAt);
  const archived = rows
    .filter((p) => !!p.archivedAt)
    .sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""));

  // Apply filter
  let filtered: ProgramRow[];
  if (filter === "archived") {
    filtered = archived;
  } else {
    filtered = active;
    if (filter === "open") {
      filtered = filtered.filter((p) => p.regWindow === "open");
    } else if (filter === "waitlist") {
      filtered = filtered.filter((p) => p.waitlistedCount > 0);
    } else if (filter === "attention") {
      filtered = filtered.filter((p) => p.needsAttention);
    }
  }

  // Apply the Category and Format filters
  if (categoryFilter) filtered = filtered.filter((p) => p.offeringCategory === categoryFilter);
  if (formatFilter) filtered = filtered.filter((p) => p.offeringFormat === formatFilter);

  // Apply search
  if (searchLower) {
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(searchLower) ||
        (p.tagline && p.tagline.toLowerCase().includes(searchLower))
    );
  }

  // Filter counts (always from unfiltered list)
  const counts = {
    all: active.length,
    open: active.filter((p) => p.regWindow === "open").length,
    waitlist: active.filter((p) => p.waitlistedCount > 0).length,
    attention: active.filter((p) => p.needsAttention).length,
    archived: archived.length,
  };

  async function handleAction(
    slug: string,
    action: "archive" | "restore" | "delete"
  ) {
    if (busy) return;
    const name = rows.find((r) => r.slug === slug)?.name ?? "This program";
    const verb = action === "archive" ? "archived" : action === "restore" ? "restored" : "deleted";
    setBusy(true);
    setProblem("");
    try {
      const res =
        action === "delete"
          ? await fetch(`/api/programs-pg/${slug}`, { method: "DELETE" })
          : await fetch(`/api/programs-pg/${slug}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action }),
            });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setProblem(data.error || `${name} wasn't ${verb}. Please try again.`);
        return;
      }
      if (action === "delete") {
        setRows((prev) => prev.filter((p) => p.slug !== slug));
        say(`${name} is permanently deleted.`);
      } else {
        setRows((prev) =>
          prev.map((p) =>
            p.slug === slug
              ? {
                  ...p,
                  archivedAt:
                    action === "archive" ? new Date().toISOString() : null,
                }
              : p
          )
        );
        say(
          action === "archive"
            ? `${name} is archived. You can find it under Archived and restore it at any time.`
            : `${name} is restored and visible again.`
        );
      }
      setConfirming(null);
    } catch {
      setProblem(`${name} wasn't ${verb}. Please check your connection and try again.`);
    } finally {
      setBusy(false);
    }
  }

  // The list's words (2026-10-26, Jesse: the list should look professional;
  // the measured pass): registration in the editor's own words, places in
  // plain words, how it meets beside its kind.
  const DELIVERY: Record<string, string> = {
    "in-person": "In person",
    virtual: "Online",
    hybrid: "In person and online",
  };

  function regState(p: ProgramRow) {
    const [label, tone] =
      p.regWindow === "off" ? ["Off", "off"]
      : p.regWindow === "closed" ? ["Closed", "closed"]
      : p.regWindow === "notYet" ? [`Opens ${p.opensOn}`, "soon"]
      : ["Open", "open"];
    return <span className={`prl-state prl-state--${tone}`}>{label}</span>;
  }

  function placesText(p: ProgramRow) {
    if (!canSeePeople) return p.registrationCapacity ? `${p.registrationCapacity} places` : "No limit";
    return p.registrationCapacity
      ? `${p.confirmedCount} of ${p.registrationCapacity} places`
      : `${p.confirmedCount} registered`;
  }

  /** What needs a look, under the name: the people and dana counts. */
  function notes(p: ProgramRow) {
    if (!canSeePeople) return [];
    const out: string[] = [];
    if (p.spotOpened) out.push("A place is open");
    if (p.waitlistedCount > 0) out.push(`${p.waitlistedCount} waiting`);
    if (p.pendingDanaCount > 0) out.push(`${p.pendingDanaCount} dana not finished`);
    return out;
  }

  // Confirmation dialog
  function confirmDialog() {
    if (!confirming) return null;
    const p = rows.find((r) => r.slug === confirming.slug);
    if (!p) return null;

    let title = "";
    let body = "";
    let btnLabel = "";
    let busyLabel = "";
    let btnClass = "";

    if (confirming.action === "archive") {
      title = `Archive ${p.name}?`;
      body =
        "It will be hidden from all public views and scheduling. Members who registered keep their registration history. You can restore it at any time.";
      btnLabel = "Archive";
      busyLabel = "Archiving…";
      btnClass = "vol-confirm-btn--warn";
    } else if (confirming.action === "restore") {
      title = `Restore ${p.name}?`;
      body = "It will become visible again immediately.";
      btnLabel = "Restore";
      busyLabel = "Restoring…";
      btnClass = "vol-confirm-btn--primary";
    } else {
      title = `Permanently delete ${p.name}?`;
      body = "This cannot be undone.";
      btnLabel = "Delete permanently";
      busyLabel = "Deleting…";
      btnClass = "vol-confirm-btn--danger";
    }

    return (
      <div className="vol-overlay" onClick={closeDialog}>
        <div
          ref={dialogRef as RefObject<HTMLDivElement | null>}
          className="vol-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vol-confirm-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="vol-dialog__title" id="vol-confirm-title">{title}</h3>
          <p className="vol-dialog__body">{body}</p>
          {problem && (
            <p className="save-note save-note--error" role="alert">
              {problem}
            </p>
          )}
          <div className="vol-dialog__actions">
            <button
              type="button"
              className="app-act"
              disabled={busy}
              onClick={closeDialog}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`vol-confirm-btn ${btnClass}`}
              disabled={busy}
              onClick={() => handleAction(confirming.slug, confirming.action)}
            >
              {busy ? busyLabel : btnLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check for active registrations to disable delete
  function hasActiveRegs(p: ProgramRow) {
    return p.confirmedCount > 0 || p.waitlistedCount > 0;
  }

  return (
    <>
      {confirmDialog()}

      {/* ── Filters, then the program's own choices and Add ── */}
      <div className="prl-toolbar">
        <FilterPills<Filter>
          label="Show programs"
          value={filter}
          onChange={setFilter}
          options={[
            { key: "all", label: "All", count: counts.all },
            { key: "open", label: "Open", count: counts.open },
            ...(canSeePeople
              ? [
                  { key: "waitlist" as const, label: "Has waitlist", count: counts.waitlist },
                  { key: "attention" as const, label: "Needs attention", count: counts.attention, alert: counts.attention > 0 },
                ]
              : []),
            { key: "archived", label: "Archived", count: counts.archived },
          ]}
        />
        <div className="prl-controls">
          <label className="rim-sr-only" htmlFor="vol-filter-category">Filter by category</label>
          <select
            id="vol-filter-category"
            className="prl-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {OFFERING_CATEGORIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          <label className="rim-sr-only" htmlFor="vol-filter-format">Filter by format</label>
          <select
            id="vol-filter-format"
            className="prl-select"
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
          >
            <option value="">All formats</option>
            {OFFERING_FORMATS.map((f) => (
              <option key={f.code} value={f.code}>{f.label}</option>
            ))}
          </select>
          <input
            className="prl-search"
            type="search"
            placeholder="Search programs"
            aria-label="Search programs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Link href={`${basePath}/new`} className="pe-btn pe-btn--primary prl-add">
            + Add Program
          </Link>
        </div>
      </div>

      {/* ── The list: a table on wide screens, a card a program on narrow ones ── */}
      {filtered.length === 0 ? (
        <p className="vol-empty">
          {search
            ? "No programs match your search."
            : filter === "archived"
            ? "No archived programs."
            : "No programs found."}
        </p>
      ) : (
        <div className="prl">
          <table className="prl-table">
            <thead>
              <tr>
                <th scope="col">Program</th>
                <th scope="col">Kind</th>
                <th scope="col">Registration</th>
                <th scope="col">{canSeePeople ? "Registered" : "Places"}</th>
                <th scope="col"><span className="rim-sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const needs = notes(p);
                const kind = [formatLabel(p.offeringFormat), DELIVERY[p.programFormat] ?? p.programFormat].filter(Boolean).join(" · ");
                return (
                  <tr key={p.id} className="prl-row">
                    <td className="prl-cell prl-cell--name">
                      {!p.archivedAt ? (
                        <Link href={`${basePath}/${p.slug}/edit`} className="prl-name">{p.name}</Link>
                      ) : (
                        <span className="prl-name">{p.name}</span>
                      )}
                      {p.tagline && <span className="prl-tag">{p.tagline}</span>}
                      {/* Its kind, here when the list is too narrow for its own column. */}
                      <span className="prl-meta prl-kindline">
                        {[categorySectionTitle(p.offeringCategory) ?? "No category", kind].filter(Boolean).join(" · ")}
                      </span>
                      {needs.length > 0 && <span className="prl-needs">{needs.join(" · ")}</span>}
                    </td>
                    <td className="prl-cell prl-cell--kind">
                      <span>{categorySectionTitle(p.offeringCategory) ?? "No category"}</span>
                      {kind && <span className="prl-meta">{kind}</span>}
                    </td>
                    <td className="prl-cell prl-cell--reg">
                      {p.archivedAt ? <span className="prl-state prl-state--off">Archived</span> : regState(p)}
                    </td>
                    <td className="prl-cell prl-cell--places">{placesText(p)}</td>
                    <td className="prl-cell prl-cell--acts">
                      {p.archivedAt ? (
                        canArchive ? (
                          <div className="prl-acts">
                            <button type="button" className="app-act" onClick={() => setConfirming({ slug: p.slug, action: "restore" })}>
                              Restore
                            </button>
                            {isAdmin &&
                              (hasActiveRegs(p) ? (
                                <span className="prl-why">People are registered or waiting, so it can&rsquo;t be deleted.</span>
                              ) : (
                                <button type="button" className="app-act app-act--danger" onClick={() => setConfirming({ slug: p.slug, action: "delete" })}>
                                  Delete
                                </button>
                              ))}
                          </div>
                        ) : null
                      ) : (
                        <div className="prl-acts">
                          {/* Its people live in the Registration app (2026-10-23). */}
                          {canSeePeople && (
                            <Link href={`/tools/registration/${p.slug}`} className="app-act">People</Link>
                          )}
                          <Link href={`${basePath}/${p.slug}/edit`} className="app-act">Edit</Link>
                          {canArchive && (
                            <button type="button" className="app-act app-act--quiet" onClick={() => setConfirming({ slug: p.slug, action: "archive" })}>
                              Archive
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ActionNotice notice={notice} onClose={() => say(null)} />
    </>
  );
}
