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
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw; // return as-is if format is unrecognised
}

export default function VolunteerTable({
  initialRegistrations,
  programSlug,
  programTitle,
}: Props) {
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<string | null>(null);
  const [savedNotes, setSavedNotes] = useState<string | null>(null);
  // Two-step status update: user selects → pending → must click Confirm to save
  const [pendingStatus, setPendingStatus] = useState<{ id: string; status: string } | null>(null);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);

  // ── Counts ──────────────────────────────────────────────────────────────────
  const counts: Record<string, number> = { ALL: registrations.length };
  for (const r of registrations) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  }

  // ── Filtered list ───────────────────────────────────────────────────────────
  const visible =
    filter === "ALL" ? registrations : registrations.filter((r) => r.status === filter);

  // ── Status update (two-step) ─────────────────────────────────────────────────
  // Step 1: dropdown onChange → sets pendingStatus (no API call yet)
  // Step 2: Confirm button → confirmStatus() → saves to API

  function selectStatus(id: string, newStatus: string, currentStatus: string) {
    if (newStatus === currentStatus) {
      setPendingStatus(null); // user reverted — nothing pending
    } else {
      setPendingStatus({ id, status: newStatus });
    }
  }

  async function confirmStatus() {
    if (!pendingStatus) return;
    const { id, status } = pendingStatus;
    const prev = registrations.find((r) => r.id === id)?.status;

    setSavingStatus(id);
    setPendingStatus(null);

    // Optimistic update
    setRegistrations((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));

    try {
      const res = await fetch(`/api/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on error
      setRegistrations((rs) => rs.map((r) => (r.id === id ? { ...r, status: prev! } : r)));
      alert("Failed to update status. Please try again.");
    } finally {
      setSavingStatus(null);
    }
  }

  function cancelStatus() {
    setPendingStatus(null);
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
    } else {
      setExpandedId(id);
      // Pre-populate notes editor with current value
      if (!(id in editingNotes)) {
        setEditingNotes((prev) => ({ ...prev, [id]: currentNotes ?? "" }));
      }
    }
  }

  return (
    <div className="vol-table-wrap">

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
        <p className="vol-empty">No registrations{filter !== "ALL" ? ` with status ${STATUS_LABELS[filter]}` : ""} yet.</p>
      ) : (
        <table className="vol-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Donation</th>
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
                    className={`vol-row ${isExpanded ? "vol-row--expanded" : ""}`}
                    onClick={() => toggleExpand(r.id, r.notes)}
                  >
                    <td className="vol-row__toggle">
                      <span className="vol-expand-btn">{isExpanded ? "▼" : "▶"}</span>
                    </td>
                    <td className="vol-row__name">
                      {r.firstName} {r.lastName}
                      {r.waitlistPosition && (
                        <span className="vol-waitlist-pos"> #{r.waitlistPosition}</span>
                      )}
                    </td>
                    <td className="vol-row__email">{r.email}</td>
                    <td className="vol-row__phone">{formatPhone(r.phone)}</td>
                    <td className="vol-row__status" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const isPending = pendingStatus?.id === r.id;
                        const displayStatus = isPending ? pendingStatus!.status : r.status;
                        return (
                          <>
                            <select
                              className={`vol-status-select vol-status-select--${displayStatus.toLowerCase()}${isPending ? " vol-status-select--pending" : ""}`}
                              value={displayStatus}
                              onChange={(e) => selectStatus(r.id, e.target.value, r.status)}
                              disabled={savingStatus === r.id}
                            >
                              <option value="REGISTERED">Registered</option>
                              <option value="WAITLISTED">Waitlisted</option>
                              <option value="APPROVED">Approved</option>
                              <option value="CANCELLED">Cancelled</option>
                            </select>
                            {isPending && (
                              <div className="vol-status-confirm">
                                <button
                                  className="vol-status-confirm__btn"
                                  onClick={confirmStatus}
                                >
                                  Confirm
                                </button>
                                <button
                                  className="vol-status-confirm__cancel"
                                  onClick={cancelStatus}
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                            {savingStatus === r.id && (
                              <span className="vol-status-saving">Saving…</span>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td className="vol-row__donation">
                      <span className={`vol-badge vol-badge--donation-${r.donationStatus.toLowerCase()}`}>
                        {DONATION_LABELS[r.donationStatus]}
                      </span>
                    </td>
                    <td className="vol-row__date">{formatDate(r.createdAt)}</td>
                  </tr>

                  {isExpanded && (
                    <tr key={`${r.id}-expanded`} className="vol-row-detail">
                      <td colSpan={7}>
                        <div className="vol-detail">

                          {/* Contact info — hidden on desktop, visible on mobile where phone/date cols are hidden */}
                          <div className="vol-detail__contact">
                            {r.phone && <span>{formatPhone(r.phone)}</span>}
                            <span>Registered {formatDate(r.createdAt)}</span>
                          </div>

                          {/* Custom fields */}
                          {hasCustom && (
                            <div className="vol-detail__section">
                              <p className="vol-detail__heading">Responses</p>
                              <dl className="vol-detail__fields">
                                {Object.entries(r.customFields!).map(([q, a]) => (
                                  <>
                                    <dt key={`q-${q}`}>{q}</dt>
                                    <dd key={`a-${q}`}>{a}</dd>
                                  </>
                                ))}
                              </dl>
                            </div>
                          )}

                          {/* Comments */}
                          {hasComments && (
                            <div className="vol-detail__section">
                              <p className="vol-detail__heading">Comments</p>
                              <p className="vol-detail__comments">{r.comments}</p>
                            </div>
                          )}

                          {/* Notes (volunteer-only) */}
                          <div className="vol-detail__section">
                            <p className="vol-detail__heading">Volunteer Notes</p>
                            <textarea
                              className="vol-notes"
                              placeholder="Add internal notes…"
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
