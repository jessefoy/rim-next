"use client";

import { useState } from "react";

export interface SerializedRegistration {
  id: string;
  programId: string;
  programSlug: string;
  programTitle: string;
  userId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  comments: string | null;
  customFields: Record<string, string> | null;
  status: string;
  waitlistPosition: number | null;
  notes: string | null;
  donationStatus: string;
  donationAmount: number | null;
  createdAt: string;
}

type Filter = "ALL" | "REGISTERED" | "WAITLISTED" | "APPROVED" | "CANCELLED";

interface Props {
  initialRegistrations: SerializedRegistration[];
  programSlug: string;
  programTitle: string;
  danaMode?: string | null;
  registrationCapacity?: number | null;
}

const STATUS_LABELS: Record<string, string> = {
  REGISTERED: "Registered",
  WAITLISTED: "Waitlisted",
  APPROVED: "Approved",
  CANCELLED: "Cancelled",
};

const DONATION_LABELS: Record<string, string> = {
  NOT_REQUIRED: "—",
  PENDING: "Pending",
  COMPLETED: "Received",
  WAIVED: "Waived",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPhone(raw: string | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

export default function VolunteerTable({
  initialRegistrations,
  programSlug,
  programTitle,
  danaMode,
  registrationCapacity,
}: Props) {
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<string | null>(null);
  const [savedNotes, setSavedNotes] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [reminderSent, setReminderSent] = useState<string | null>(null);

  // ── Counts ──────────────────────────────────────────────────────────────────
  const counts: Record<string, number> = { ALL: registrations.length };
  for (const r of registrations) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  }

  // ── Stat bar derived values ──────────────────────────────────────────────────
  const confirmedCount = registrations.filter(
    (r) => r.status === "REGISTERED" || r.status === "APPROVED"
  ).length;
  const pendingDanaCount = registrations.filter(
    (r) => r.donationStatus === "PENDING"
  ).length;

  const capacityPct =
    registrationCapacity && confirmedCount >= 0
      ? Math.min(100, Math.round((confirmedCount / registrationCapacity) * 100))
      : null;

  // ── Filtered list ───────────────────────────────────────────────────────────
  const visible = registrations
    .filter((r) => filter === "ALL" || r.status === filter)
    .filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
      );
    });

  // ── Action: promote from waitlist ────────────────────────────────────────────
  async function promoteRegistration(id: string) {
    const prevStatus = registrations.find((r) => r.id === id)?.status;
    const optimisticDonation = danaMode && danaMode !== "none" ? "PENDING" : "WAIVED";

    setActionLoading(id);
    setRegistrations((rs) =>
      rs.map((r) =>
        r.id === id ? { ...r, status: "APPROVED", donationStatus: optimisticDonation } : r
      )
    );

    try {
      const res = await fetch(`/api/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED", danaMode: danaMode ?? "none" }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setRegistrations((rs) =>
        rs.map((r) => (r.id === id ? { ...r, status: prevStatus! } : r))
      );
      alert("Failed to promote. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Action: cancel a registration ────────────────────────────────────────────
  async function cancelRegistration(id: string) {
    const prevStatus = registrations.find((r) => r.id === id)?.status;

    setActionLoading(id);
    setRegistrations((rs) => rs.map((r) => (r.id === id ? { ...r, status: "CANCELLED" } : r)));

    try {
      const res = await fetch(`/api/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setRegistrations((rs) =>
        rs.map((r) => (r.id === id ? { ...r, status: prevStatus! } : r))
      );
      alert("Failed to cancel. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Action: restore a cancelled registration ─────────────────────────────────
  async function restoreRegistration(id: string) {
    const prevStatus = registrations.find((r) => r.id === id)?.status;

    setActionLoading(id);
    setRegistrations((rs) => rs.map((r) => (r.id === id ? { ...r, status: "REGISTERED" } : r)));

    try {
      const res = await fetch(`/api/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REGISTERED" }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setRegistrations((rs) =>
        rs.map((r) => (r.id === id ? { ...r, status: prevStatus! } : r))
      );
      alert("Failed to restore. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Action: permanently delete a CANCELLED registration ───────────────────────
  async function deleteRegistration(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/registrations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRegistrations((rs) => rs.filter((r) => r.id !== id));
      setExpandedId(null);
      setConfirmDeleteId(null);
    } catch {
      alert("Failed to delete. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Action: send dana reminder email ──────────────────────────────────────────
  async function sendDanaReminder(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendDanaReminder" }),
      });
      if (!res.ok) throw new Error();
      setReminderSent(id);
      setTimeout(() => setReminderSent(null), 3000);
    } catch {
      alert("Failed to send reminder. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Notes save ──────────────────────────────────────────────────────────────
  async function saveNotes(id: string) {
    const notes = editingNotes[id] ?? "";
    setSavingNotes(id);

    try {
      const res = await fetch(`/api/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error();

      setRegistrations((rs) => rs.map((r) => (r.id === id ? { ...r, notes } : r)));
      setSavedNotes(id);
      setTimeout(() => setSavedNotes(null), 2000);
    } catch {
      alert("Failed to save notes. Please try again.");
    } finally {
      setSavingNotes(null);
    }
  }

  // ── Expand/collapse ─────────────────────────────────────────────────────────
  function toggleExpand(id: string, currentNotes: string | null) {
    if (expandedId === id) {
      setExpandedId(null);
      setConfirmCancelId(null);
      setConfirmDeleteId(null);
    } else {
      setExpandedId(id);
      setConfirmCancelId(null);
      setConfirmDeleteId(null);
      if (!(id in editingNotes)) {
        setEditingNotes((prev) => ({ ...prev, [id]: currentNotes ?? "" }));
      }
    }
  }

  // ── Helper: open row and pre-trigger cancel confirm ──────────────────────────
  function openWithCancelConfirm(id: string, currentNotes: string | null) {
    setExpandedId(id);
    setConfirmCancelId(id);
    setConfirmDeleteId(null);
    if (!(id in editingNotes)) {
      setEditingNotes((prev) => ({ ...prev, [id]: currentNotes ?? "" }));
    }
  }

  return (
    <div className="vol-table-wrap">

      {/* ── Stat bar ── */}
      <div className="vol-stat-bar">
        <div className="vol-stat-bar__item">
          <span className="vol-stat-bar__num">{confirmedCount}</span>
          <span className="vol-stat-bar__label">Confirmed</span>
        </div>
        {(counts.WAITLISTED ?? 0) > 0 && (
          <div className="vol-stat-bar__item vol-stat-bar__item--amber">
            <span className="vol-stat-bar__num">{counts.WAITLISTED}</span>
            <span className="vol-stat-bar__label">Waitlisted</span>
          </div>
        )}
        {(counts.CANCELLED ?? 0) > 0 && (
          <div className="vol-stat-bar__item">
            <span className="vol-stat-bar__num vol-stat-bar__num--muted">{counts.CANCELLED}</span>
            <span className="vol-stat-bar__label">Cancelled</span>
          </div>
        )}
        {pendingDanaCount > 0 && (
          <div className="vol-stat-bar__item vol-stat-bar__item--amber">
            <span className="vol-stat-bar__num">{pendingDanaCount}</span>
            <span className="vol-stat-bar__label">Dana Pending</span>
          </div>
        )}
        {registrationCapacity && capacityPct !== null && (
          <div className="vol-stat-bar__capacity">
            <div className="vol-capacity__bar">
              <div
                className={`vol-capacity__fill${
                  confirmedCount >= registrationCapacity
                    ? " vol-capacity__fill--full"
                    : capacityPct >= 80
                    ? " vol-capacity__fill--near"
                    : ""
                }`}
                style={{ width: `${capacityPct}%` }}
              />
            </div>
            <span className="vol-capacity__label">
              Capacity: {confirmedCount} / {registrationCapacity}
            </span>
          </div>
        )}
      </div>

      {/* ── Toolbar ── */}
      <div className="vol-toolbar">
        <div className="vol-filters">
          {(["ALL", "REGISTERED", "WAITLISTED", "APPROVED", "CANCELLED"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`vol-filter ${filter === f ? "vol-filter--active" : ""}`}
            >
              {f === "ALL" ? "All" : STATUS_LABELS[f]}
              {(counts[f] ?? 0) > 0 && (
                <span className="vol-filter__count">{counts[f] ?? 0}</span>
              )}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="vol-search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <a
          href={`/api/programs/${programSlug}/registrations?format=csv`}
          className="vol-csv-btn"
          download={`${programSlug}-registrations.csv`}
        >
          ↓ Export CSV
        </a>
      </div>

      {/* ── Table ── */}
      {visible.length === 0 ? (
        <p className="vol-empty">
          {search.trim()
            ? `No results for "${search}".`
            : `No registrations${filter !== "ALL" ? ` with status ${STATUS_LABELS[filter]}` : ""} yet.`}
        </p>
      ) : (
        <table className="vol-table">
          <thead>
            <tr>
              <th className="vol-th-toggle"></th>
              <th>Name</th>
              <th>Status</th>
              <th>Dana</th>
              <th>Registered</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const isExpanded = expandedId === r.id;
              const hasCustom = r.customFields && Object.keys(r.customFields).length > 0;
              const hasComments = !!r.comments;

              return (
                <>
                  <tr
                    key={r.id}
                    className={`vol-row vol-row--${r.status.toLowerCase()}${isExpanded ? " vol-row--expanded" : ""}`}
                    onClick={() => toggleExpand(r.id, r.notes)}
                  >
                    {/* Toggle */}
                    <td className="vol-row__toggle">
                      <span className={`vol-chevron${isExpanded ? " vol-chevron--open" : ""}`} />
                    </td>

                    {/* Person — name + email stacked */}
                    <td className="vol-row__person">
                      <span className="vol-row__name">
                        {r.firstName} {r.lastName}
                      </span>
                      <span className="vol-row__email">{r.email}</span>
                    </td>

                    {/* Status — text label + inline quick-actions */}
                    <td className="vol-row__status-cell" onClick={(e) => e.stopPropagation()}>
                      <span className={`vol-row__status-text vol-row__status-text--${r.status.toLowerCase()}`}>
                        {STATUS_LABELS[r.status]}
                        {r.status === "WAITLISTED" && r.waitlistPosition && (
                          <> #{r.waitlistPosition}</>
                        )}
                      </span>

                      {/* WAITLISTED → promote */}
                      {r.status === "WAITLISTED" && (
                        <button
                          className="vol-promote-inline"
                          disabled={actionLoading === r.id}
                          onClick={() => promoteRegistration(r.id)}
                        >
                          {actionLoading === r.id ? "…" : "Promote"}
                        </button>
                      )}

                      {/* REGISTERED / APPROVED → cancel (opens row + shows confirm) */}
                      {(r.status === "REGISTERED" || r.status === "APPROVED") && (
                        <button
                          className="vol-cancel-inline"
                          onClick={() => openWithCancelConfirm(r.id, r.notes)}
                        >
                          Cancel
                        </button>
                      )}

                      {/* CANCELLED → restore */}
                      {r.status === "CANCELLED" && (
                        <button
                          className="vol-restore-inline"
                          disabled={actionLoading === r.id}
                          onClick={() => restoreRegistration(r.id)}
                        >
                          {actionLoading === r.id ? "…" : "Restore"}
                        </button>
                      )}
                    </td>

                    {/* Dana */}
                    <td className="vol-row__dana">
                      <span className={`vol-badge vol-badge--donation-${r.donationStatus.toLowerCase()}`}>
                        {DONATION_LABELS[r.donationStatus]}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="vol-row__date">{formatDate(r.createdAt)}</td>
                  </tr>

                  {/* ── Expanded detail panel ── */}
                  {isExpanded && (
                    <tr className="vol-row-detail" key={`${r.id}-detail`}>
                      <td colSpan={5}>
                        <div className="vol-detail">

                          {/* ── Col 1: Contact ── */}
                          <div className="vol-detail__contact-col">
                            <p className="vol-detail__col-label">Contact</p>
                            <p className="vol-detail__full-name">
                              {r.firstName} {r.lastName}
                            </p>
                            <a href={`mailto:${r.email}`} className="vol-detail__link">
                              {r.email}
                            </a>
                            {r.phone && (
                              <a href={`tel:${r.phone}`} className="vol-detail__link">
                                {formatPhone(r.phone)}
                              </a>
                            )}
                            <div className="vol-detail__meta">
                              <span className={`vol-badge vol-badge--${r.status.toLowerCase()}`}>
                                {STATUS_LABELS[r.status]}
                              </span>
                              {r.status === "WAITLISTED" && r.waitlistPosition && (
                                <span className="vol-detail__meta-text">
                                  Waitlist #{r.waitlistPosition}
                                </span>
                              )}
                              <span className="vol-detail__meta-text">
                                Registered {formatDate(r.createdAt)}
                              </span>
                            </div>
                            {r.donationStatus !== "NOT_REQUIRED" && (
                              <div className="vol-detail__dana-row">
                                <span className="vol-detail__dana-label">Dana</span>
                                <span className={`vol-badge vol-badge--donation-${r.donationStatus.toLowerCase()}`}>
                                  {DONATION_LABELS[r.donationStatus]}
                                </span>
                                {r.donationAmount && (
                                  <span className="vol-detail__meta-text">
                                    ${(r.donationAmount / 100).toFixed(2)} received
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* ── Col 2: Submission ── */}
                          <div className="vol-detail__submission-col">
                            {hasCustom && (
                              <>
                                <p className="vol-detail__col-label">Responses</p>
                                <dl className="vol-detail__fields">
                                  {Object.entries(r.customFields!).map(([q, a]) => (
                                    <div className="vol-detail__field-row" key={q}>
                                      <dt>{q}</dt>
                                      <dd>{a}</dd>
                                    </div>
                                  ))}
                                </dl>
                              </>
                            )}
                            {hasComments && (
                              <div className={hasCustom ? "vol-detail__comments-section" : ""}>
                                <p className="vol-detail__col-label">Comments</p>
                                <p className="vol-detail__comments">{r.comments}</p>
                              </div>
                            )}
                            {!hasCustom && !hasComments && (
                              <p className="vol-detail__empty">No additional responses.</p>
                            )}
                          </div>

                          {/* ── Col 3: Staff (notes + actions) ── */}
                          <div className="vol-detail__staff-col">
                            <div className="vol-detail__notes-wrap">
                              <p className="vol-detail__col-label">Internal Notes</p>
                              <textarea
                                className="vol-notes"
                                placeholder="Notes visible only to staff…"
                                value={editingNotes[r.id] ?? r.notes ?? ""}
                                onChange={(e) =>
                                  setEditingNotes((prev) => ({
                                    ...prev,
                                    [r.id]: e.target.value,
                                  }))
                                }
                                onClick={(e) => e.stopPropagation()}
                                rows={4}
                              />
                              <button
                                className="vol-save-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  saveNotes(r.id);
                                }}
                                disabled={savingNotes === r.id}
                              >
                                {savingNotes === r.id
                                  ? "Saving…"
                                  : savedNotes === r.id
                                  ? "Saved ✓"
                                  : "Save Notes"}
                              </button>
                            </div>

                            {/* Actions */}
                            <div
                              className="vol-detail__actions-wrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Dana reminder — shown whenever donation is pending */}
                              {r.donationStatus === "PENDING" && (
                                <button
                                  className="vol-action-btn vol-action-btn--reminder"
                                  disabled={actionLoading === r.id}
                                  onClick={() => sendDanaReminder(r.id)}
                                >
                                  {reminderSent === r.id
                                    ? "Reminder Sent ✓"
                                    : "Send Dana Reminder"}
                                </button>
                              )}

                              {/* Promote */}
                              {r.status === "WAITLISTED" && (
                                <button
                                  className="vol-action-btn vol-action-btn--promote"
                                  disabled={actionLoading === r.id}
                                  onClick={() => promoteRegistration(r.id)}
                                >
                                  {actionLoading === r.id ? "Promoting…" : "Promote to Approved"}
                                </button>
                              )}

                              {/* Cancel with inline confirm */}
                              {(r.status === "REGISTERED" || r.status === "APPROVED") && (
                                confirmCancelId === r.id ? (
                                  <div className="vol-confirm-wrap">
                                    <span className="vol-confirm-label">
                                      Cancel this registration?
                                    </span>
                                    <div className="vol-confirm-btns">
                                      <button
                                        className="vol-action-btn vol-action-btn--danger"
                                        disabled={actionLoading === r.id}
                                        onClick={() => {
                                          cancelRegistration(r.id);
                                          setConfirmCancelId(null);
                                        }}
                                      >
                                        {actionLoading === r.id ? "Cancelling…" : "Yes, cancel"}
                                      </button>
                                      <button
                                        className="vol-action-btn vol-action-btn--ghost"
                                        onClick={() => setConfirmCancelId(null)}
                                      >
                                        Never mind
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    className="vol-action-btn vol-action-btn--ghost"
                                    onClick={() => setConfirmCancelId(r.id)}
                                  >
                                    Cancel Registration
                                  </button>
                                )
                              )}

                              {/* Restore + Delete (CANCELLED rows) */}
                              {r.status === "CANCELLED" && (
                                <>
                                  <button
                                    className="vol-action-btn vol-action-btn--restore"
                                    disabled={actionLoading === r.id}
                                    onClick={() => restoreRegistration(r.id)}
                                  >
                                    {actionLoading === r.id ? "Restoring…" : "Restore Registration"}
                                  </button>

                                  {confirmDeleteId === r.id ? (
                                    <div className="vol-confirm-wrap">
                                      <span className="vol-confirm-label">
                                        Permanently delete this record?
                                      </span>
                                      <div className="vol-confirm-btns">
                                        <button
                                          className="vol-action-btn vol-action-btn--delete"
                                          disabled={actionLoading === r.id}
                                          onClick={() => deleteRegistration(r.id)}
                                        >
                                          {actionLoading === r.id
                                            ? "Deleting…"
                                            : "Yes, delete permanently"}
                                        </button>
                                        <button
                                          className="vol-action-btn vol-action-btn--ghost"
                                          onClick={() => setConfirmDeleteId(null)}
                                        >
                                          Never mind
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      className="vol-action-btn vol-action-btn--delete-ghost"
                                      onClick={() => setConfirmDeleteId(r.id)}
                                    >
                                      Delete Record
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
