"use client";

import { useState } from "react";
import Link from "next/link";

export type ProgramRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  programFormat: string;
  registrationEnabled: boolean;
  registrationClosed: boolean;
  registrationCapacity: number | null;
  archivedAt: string | null;
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
  isRegistrar,
  isAdmin,
}: {
  programs: ProgramRow[];
  hubBase?: string;
  /** Base path for program links (e.g. "/tools/programs"). Falls back to hubBase/programs. */
  basePath?: string;
  isRegistrar: boolean;
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
      filtered = filtered.filter(
        (p) => p.registrationEnabled && !p.registrationClosed
      );
    } else if (filter === "waitlist") {
      filtered = filtered.filter((p) => p.waitlistedCount > 0);
    } else if (filter === "attention") {
      filtered = filtered.filter((p) => p.needsAttention);
    }
  }

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
    open: active.filter((p) => p.registrationEnabled && !p.registrationClosed)
      .length,
    waitlist: active.filter((p) => p.waitlistedCount > 0).length,
    attention: active.filter((p) => p.needsAttention).length,
    archived: archived.length,
  };

  async function handleAction(
    slug: string,
    action: "archive" | "restore" | "delete"
  ) {
    if (action === "delete") {
      const res = await fetch(`/api/programs-pg/${slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete program.");
        setConfirming(null);
        return;
      }
      setRows((prev) => prev.filter((p) => p.slug !== slug));
    } else {
      const res = await fetch(`/api/programs-pg/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || `Failed to ${action} program.`);
        setConfirming(null);
        return;
      }
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
    }
    setConfirming(null);
  }

  function formatBadge(format: string) {
    const map: Record<string, { label: string; cls: string }> = {
      "in-person": { label: "In-person", cls: "vol-badge--inperson" },
      virtual: { label: "Virtual", cls: "vol-badge--virtual" },
      hybrid: { label: "Hybrid", cls: "vol-badge--hybrid" },
    };
    const b = map[format] || { label: format, cls: "" };
    return <span className={`vol-badge ${b.cls}`}>{b.label}</span>;
  }

  function regBadge(p: ProgramRow) {
    if (!p.registrationEnabled)
      return <span className="vol-badge vol-badge--disabled">Disabled</span>;
    if (p.registrationClosed)
      return <span className="vol-badge vol-badge--closed">Closed</span>;
    return <span className="vol-badge vol-badge--open">Open</span>;
  }

  function capacityCell(p: ProgramRow) {
    if (p.registrationCapacity) {
      const pct = Math.min(
        100,
        Math.round((p.confirmedCount / p.registrationCapacity) * 100)
      );
      const fillClass =
        pct >= 100
          ? " vol-cap__fill--full"
          : pct >= 60
          ? " vol-cap__fill--warn"
          : "";
      return (
        <div className="vol-cap">
          <div className="vol-cap__bar">
            <div
              className={`vol-cap__fill${fillClass}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="vol-cap__text">
            {p.confirmedCount} / {p.registrationCapacity}
          </span>
        </div>
      );
    }
    return (
      <span className="vol-cap__text">
        {p.confirmedCount} / &infin;
      </span>
    );
  }

  function flagsCell(p: ProgramRow) {
    const flags = [];
    if (p.pendingDanaCount > 0)
      flags.push(
        <span key="dana" className="vol-flag vol-flag--amber">
          {p.pendingDanaCount} dana pending
        </span>
      );
    if (p.waitlistedCount > 0)
      flags.push(
        <span key="wait" className="vol-flag vol-flag--amber">
          {p.waitlistedCount} waitlisted
        </span>
      );
    if (p.spotOpened)
      flags.push(
        <span key="spot" className="vol-flag vol-flag--spot">
          Spot opened
        </span>
      );
    return flags.length > 0 ? <>{flags}</> : null;
  }

  // Confirmation dialog
  function confirmDialog() {
    if (!confirming) return null;
    const p = rows.find((r) => r.slug === confirming.slug);
    if (!p) return null;

    let title = "";
    let body = "";
    let btnLabel = "";
    let btnClass = "";

    if (confirming.action === "archive") {
      title = `Archive ${p.name}?`;
      body =
        "It will be hidden from all public views and scheduling. Members who registered keep their registration history. You can restore it at any time.";
      btnLabel = "Archive";
      btnClass = "vol-confirm-btn--warn";
    } else if (confirming.action === "restore") {
      title = `Restore ${p.name}?`;
      body = "It will become visible again immediately.";
      btnLabel = "Restore";
      btnClass = "vol-confirm-btn--primary";
    } else {
      title = `Permanently delete ${p.name}?`;
      body = "This cannot be undone.";
      btnLabel = "Delete permanently";
      btnClass = "vol-confirm-btn--danger";
    }

    return (
      <div className="vol-overlay" onClick={() => setConfirming(null)}>
        <div className="vol-dialog" onClick={(e) => e.stopPropagation()}>
          <h3 className="vol-dialog__title">{title}</h3>
          <p className="vol-dialog__body">{body}</p>
          <div className="vol-dialog__actions">
            <button
              className="vol-confirm-btn"
              onClick={() => setConfirming(null)}
            >
              Cancel
            </button>
            <button
              className={`vol-confirm-btn ${btnClass}`}
              onClick={() => handleAction(confirming.slug, confirming.action)}
            >
              {btnLabel}
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

      {/* ── Toolbar: filters + search + add button ── */}
      <div className="vol-table-toolbar">
        <div className="vol-table-pills">
          {(
            [
              ["all", `All (${counts.all})`],
              ["open", "Open"],
              ["waitlist", "Has waitlist"],
              ["attention", "Needs attention"],
              ["archived", `Archived${counts.archived > 0 ? ` (${counts.archived})` : ""}`],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className={`vol-pill${filter === key ? " vol-pill--active" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="vol-table-right">
          <input
            className="vol-table-search"
            type="text"
            placeholder="Search programs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isRegistrar && (
            <Link
              href={`${basePath}/new`}
              className="pe-btn pe-btn--primary vol-add-btn"
            >
              + Add Program
            </Link>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <p className="vol-empty">
          {search
            ? "No programs match your search."
            : filter === "archived"
            ? "No archived programs."
            : "No programs found."}
        </p>
      ) : (
        <div className="vol-table-wrap">
        <table className="vol-table">
          <thead>
            <tr>
              <th className="vol-table__th">Program</th>
              <th className="vol-table__th">Format</th>
              {isRegistrar && <th className="vol-table__th">Registration</th>}
              <th className="vol-table__th">Capacity</th>
              {isRegistrar && <th className="vol-table__th">Flags</th>}
              {isRegistrar && (
                <th className="vol-table__th vol-table__th--right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr
                key={p.id}
                className={`vol-table__row${
                  p.archivedAt ? " vol-table__row--archived" : ""
                }`}
              >
                {/* Program */}
                <td className="vol-table__td">
                  {isRegistrar && !p.archivedAt ? (
                    <Link
                      href={`${basePath}/${p.slug}`}
                      className="vol-table__name"
                    >
                      {p.name}
                    </Link>
                  ) : (
                    <span className="vol-table__name">{p.name}</span>
                  )}
                  {p.tagline && (
                    <span className="vol-table__tag">{p.tagline}</span>
                  )}
                </td>

                {/* Format */}
                <td className="vol-table__td">{formatBadge(p.programFormat)}</td>

                {/* Registration (registrar only) */}
                {isRegistrar && (
                  <td className="vol-table__td">{regBadge(p)}</td>
                )}

                {/* Capacity */}
                <td className="vol-table__td">{capacityCell(p)}</td>

                {/* Flags (registrar only) */}
                {isRegistrar && (
                  <td className="vol-table__td">{flagsCell(p)}</td>
                )}

                {/* Actions (registrar only) */}
                {isRegistrar && (
                  <td className="vol-table__td vol-table__td--right">
                    {p.archivedAt ? (
                      <div className="vol-table__actions">
                        <button
                          className="vol-table__action"
                          onClick={() =>
                            setConfirming({ slug: p.slug, action: "restore" })
                          }
                        >
                          Restore
                        </button>
                        {isAdmin ? (
                          hasActiveRegs(p) ? (
                            <span
                              className="vol-table__action vol-table__action--disabled"
                              title="Cannot delete — active registrations exist. Cancel all registrations first."
                            >
                              Delete
                            </span>
                          ) : (
                            <button
                              className="vol-table__action vol-table__action--danger"
                              onClick={() =>
                                setConfirming({
                                  slug: p.slug,
                                  action: "delete",
                                })
                              }
                            >
                              Delete
                            </button>
                          )
                        ) : null}
                      </div>
                    ) : (
                      <div className="vol-table__actions">
                        <Link
                          href={`${basePath}/${p.slug}/edit`}
                          className="vol-table__action"
                        >
                          Edit
                        </Link>
                        <button
                          className="vol-table__action vol-table__action--muted"
                          onClick={() =>
                            setConfirming({ slug: p.slug, action: "archive" })
                          }
                        >
                          Archive
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </>
  );
}
