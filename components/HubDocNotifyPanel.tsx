"use client";

/**
 * HubDocNotifyPanel — member notification selector for hub documents.
 *
 * Appears at the bottom of the Add Resource form, the inline edit form,
 * and the HubDocumentEditor (native docs). Default: nobody checked.
 * "Not yet notified" pre-selection is handled by the caller.
 */

export interface NotifyMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
}

interface Props {
  members: NotifyMember[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
}

function memberDisplayName(m: NotifyMember) {
  return m.preferredName || [m.firstName, m.lastName].filter(Boolean).join(" ") || "Unknown";
}

export default function HubDocNotifyPanel({ members, selectedIds, onChange, loading }: Props) {
  if (members.length === 0) return null;

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  }

  return (
    <div className="hub-doc-notify-panel">
      <div className="hub-doc-notify-panel__header">
        <span className="hub-doc-notify-panel__label">Notify team members</span>
        <div className="hub-doc-notify-panel__actions">
          <button type="button" className="hub-doc-notify-link" onClick={() => onChange(members.map((m) => m.id))}>All</button>
          <span className="hub-doc-notify-sep">·</span>
          <button type="button" className="hub-doc-notify-link" onClick={() => onChange([])}>None</button>
        </div>
      </div>
      {loading ? (
        <p className="hub-doc-notify-loading">Loading…</p>
      ) : (
        <div className="hub-doc-notify-panel__list">
          {members.map((m) => (
            <label key={m.id} className="hub-doc-notify-member">
              <input
                type="checkbox"
                checked={selectedIds.includes(m.id)}
                onChange={() => toggle(m.id)}
              />
              <span>{memberDisplayName(m)}</span>
            </label>
          ))}
        </div>
      )}
      {selectedIds.length > 0 && (
        <p className="hub-doc-notify-panel__count">
          {selectedIds.length} {selectedIds.length === 1 ? "person" : "people"} will be notified
        </p>
      )}
    </div>
  );
}
