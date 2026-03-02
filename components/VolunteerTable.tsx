"use client";

import { useState, Fragment } from "react";
import type { RegistrationField } from "@/components/RegistrationForm";

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
  customFields: Record<string, string> | null;
  status: string;
  waitlistPosition: number | null;
  notes: string | null;
  donationStatus: string;
  donationAmount: number | null;
  createdAt: string;
}

type Filter = "ALL" | "REGISTERED" | "WAITLISTED" | "CANCELLED";

interface Props {
  initialRegistrations: SerializedRegistration[];
  programSlug: string;
  programTitle: string;
  danaMode?: string | null;
  registrationCapacity?: number | null;
  registrationFields?: RegistrationField[];
}

const STATUS_LABELS: Record<string, string> = {
  REGISTERED: "Registered",
  WAITLISTED: "Waitlisted",
  APPROVED: "Registered",   // treated same as REGISTERED; kept in DB enum for compat
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
  registrationFields = [],
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
  const [editRequestSent, setEditRequestSent] = useState<string | null>(null);
  const [editingFields, setEditingFields] = useState<Record<string, Record<string, string>>>({});
  const [editFieldsOpen, setEditFieldsOpen] = useState<string | null>(null);
  const [savingFields, setSavingFields] = useState<string | null>(null);
  const [savedFields, setSavedFields] = useState<string | null>(null);

  // ── Counts — APPROVED is bucketed under REGISTERED ──────────────────────────
  const counts: Record<string, number> = { ALL: registrations.length };
  for (const r of registrations) {
    const key = r.status === "APPROVED" ? "REGISTERED" : r.status;
    counts[key] = (counts[key] ?? 0) + 1;
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
    .filter((r) => {
      if (filter === "ALL") return true;
      if (filter === "REGISTERED") return r.status === "REGISTERED" || r.status === "APPROVED";
      return r.status === filter;
    })
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
        r.id === id ? { ...r, status: "REGISTERED", donationStatus: optimisticDonation } : r
      )
    );

    try {
      const res = await fetch(`/api/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REGISTERED", danaMode: danaMode ?? "none" }),
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

  // ── Action: send self-service edit request email ──────────────────────────────
  async function sendEditRequest(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendEditRequest" }),
      });
      if (!res.ok) throw new Error();
      setEditRequestSent(id);
      setTimeout(() => setEditRequestSent(null), 4000);
    } catch {
      alert("Failed to send edit request. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Action: save inline-edited custom fields ──────────────────────────────────
  async function saveCustomFields(id: string) {
    const fields = editingFields[id];
    if (!fields) return;
    setSavingFields(id);
    try {
      const res = await fetch(`/api/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customFields: fields }),
      });
      if (!res.ok) throw new Error();
      setRegistrations((rs) =>
        rs.map((r) => (r.id === id ? { ...r, customFields: fields } : r))
      );
      setSavedFields(id);
      setEditFieldsOpen(null);
      setTimeout(() => setSavedFields(null), 2500);
    } catch {
      alert("Failed to save responses. Please try again.");
    } finally {
      setSavingFields(null);
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
          {(["ALL", "REGISTERED", "WAITLISTED", "CANCELLED"] as Filter[]).map((f) => (
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

              return (
                <Fragment key={r.id}>
                  <tr
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

                    {/* Status — text label; Promote inline for waitlisted only */}
                    <td className="vol-row__status-cell">
                      <span className={`vol-row__status-text vol-row__status-text--${r.status.toLowerCase()}`}>
                        {STATUS_LABELS[r.status]}
                        {r.status === "WAITLISTED" && r.waitlistPosition && (
                          <> #{r.waitlistPosition}</>
                        )}
                      </span>

                      {/* WAITLISTED → Promote (safe, no confirm needed) */}
                      {r.status === "WAITLISTED" && (
                        <button
                          className="vol-promote-inline"
                          disabled={actionLoading === r.id}
                          onClick={(e) => { e.stopPropagation(); promoteRegistration(r.id); }}
                        >
                          {actionLoading === r.id ? "…" : "Promote"}
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
                    <tr className="vol-row-detail">
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
                            <p className="vol-detail__meta-text">
                              Registered {formatDate(r.createdAt)}
                            </p>
                          </div>

                          {/* ── Col 2: Submission ── */}
                          <div className="vol-detail__submission-col">
                            {hasCustom ? (
                              <>
                                {/* Label + Edit button inline */}
                                <div className="vol-detail__col-header">
                                  <p className="vol-detail__col-label">Responses</p>
                                  {editFieldsOpen !== r.id && (
                                    <button
                                      className="vol-edit-fields-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditFieldsOpen(r.id);
                                        setEditingFields((prev) => ({
                                          ...prev,
                                          [r.id]: { ...(r.customFields as Record<string, string>) },
                                        }));
                                      }}
                                    >
                                      {savedFields === r.id ? "Saved ✓" : "Edit"}
                                    </button>
                                  )}
                                </div>

                                {/* Display mode */}
                                {editFieldsOpen !== r.id ? (
                                  <dl className="vol-detail__fields">
                                    {Object.entries(r.customFields!).map(([q, a]) => (
                                      <div className="vol-detail__field-row" key={q}>
                                        <dt>{q}</dt>
                                        <dd>{a as string}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                ) : (
                                  /* Edit mode */
                                  <div className="vol-fields-edit" onClick={(e) => e.stopPropagation()}>
                                    {Object.entries(editingFields[r.id] ?? {}).map(([q, a]) => {
                                      const fieldDef = registrationFields.find((f) => f.label === q);
                                      const onChange = (val: string) =>
                                        setEditingFields((prev) => ({
                                          ...prev,
                                          [r.id]: { ...prev[r.id], [q]: val },
                                        }));
                                      return (
                                        <div key={q}>
                                          <label className="vol-field-edit__label">{q}</label>
                                          {fieldDef?.fieldType === "longText" ? (
                                            <textarea
                                              className="vol-field-edit__input vol-field-edit__textarea"
                                              value={a}
                                              onChange={(e) => onChange(e.target.value)}
                                            />
                                          ) : fieldDef?.fieldType === "yesNo" ? (
                                            <select
                                              className="vol-field-edit__select"
                                              value={a}
                                              onChange={(e) => onChange(e.target.value)}
                                            >
                                              <option value="">— select —</option>
                                              <option value="Yes">Yes</option>
                                              <option value="No">No</option>
                                            </select>
                                          ) : fieldDef?.fieldType === "select" && fieldDef.options?.length ? (
                                            <select
                                              className="vol-field-edit__select"
                                              value={a}
                                              onChange={(e) => onChange(e.target.value)}
                                            >
                                              <option value="">— select —</option>
                                              {fieldDef.options.map((opt) => (
                                                <option key={opt} value={opt}>{opt}</option>
                                              ))}
                                            </select>
                                          ) : (
                                            <input
                                              className="vol-field-edit__input"
                                              value={a}
                                              onChange={(e) => onChange(e.target.value)}
                                            />
                                          )}
                                        </div>
                                      );
                                    })}
                                    <div className="vol-field-edit__actions">
                                      <button
                                        className="vol-save-btn"
                                        disabled={savingFields === r.id}
                                        onClick={() => saveCustomFields(r.id)}
                                      >
                                        {savingFields === r.id ? "Saving…" : "Save Changes"}
                                      </button>
                                      <button
                                        className="vol-action-btn vol-action-btn--ghost"
                                        onClick={() => setEditFieldsOpen(null)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="vol-detail__empty">No additional responses.</p>
                            )}
                          </div>

                          {/* ── Col 3: Actions + Notes ── */}
                          <div className="vol-detail__staff-col">

                            {/* Actions — top of column so they're seen immediately */}
                            <div
                              className="vol-detail__actions-wrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <p className="vol-detail__col-label">Actions</p>
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

                              {/* Send Edit Request — only for active registrations with custom fields */}
                              {(r.status === "REGISTERED" || r.status === "APPROVED" || r.status === "WAITLISTED") &&
                                r.customFields && Object.keys(r.customFields).length > 0 && (
                                <button
                                  className="vol-action-btn vol-action-btn--edit-request"
                                  disabled={actionLoading === r.id}
                                  onClick={() => sendEditRequest(r.id)}
                                >
                                  {editRequestSent === r.id ? "Edit Link Sent ✓" : "Send Edit Request"}
                                </button>
                              )}

                              {/* Promote */}
                              {r.status === "WAITLISTED" && (
                                <button
                                  className="vol-action-btn vol-action-btn--promote"
                                  disabled={actionLoading === r.id}
                                  onClick={() => promoteRegistration(r.id)}
                                >
                                  {actionLoading === r.id ? "Promoting…" : "Promote to Registered"}
                                </button>
                              )}

                              {/* Cancel with inline confirm — all active statuses */}
                              {(r.status === "REGISTERED" || r.status === "APPROVED" || r.status === "WAITLISTED") && (
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

                            {/* Notes — below actions */}
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
                                rows={3}
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

                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
