"use client";

/**
 * HubDocNotifyPanel — member notification selector for hub documents.
 *
 * Appears at the bottom of the Add Resource form, the inline edit form,
 * the standalone Notify modal, and the HubDocumentEditor (native docs).
 *
 * Already-notified members (for the relevant event type) appear with a
 * "✓ Notified <date>" line and a disabled checkbox — same hard guard
 * Basecamp uses. Server-side dedup is the belt; this is the suspenders.
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
  /**
   * userId → ISO timestamp of the prior notification (for the event type
   * relevant to this surface — "created" for the standalone modal,
   * "updated" for edit forms). Omit for new-doc forms.
   */
  notifiedMap?: Record<string, string>;
}

function memberDisplayName(m: NotifyMember) {
  return m.preferredName || [m.firstName, m.lastName].filter(Boolean).join(" ") || "Unknown";
}

function fmtNotifiedDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function HubDocNotifyPanel({
  members,
  selectedIds,
  onChange,
  loading,
  notifiedMap,
}: Props) {
  if (members.length === 0) return null;

  const notified = notifiedMap ?? {};

  function toggle(id: string) {
    if (notified[id]) return; // hard guard — disabled rows are unclickable
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  }

  function selectAllEligible() {
    onChange(members.filter((m) => !notified[m.id]).map((m) => m.id));
  }

  const eligibleCount = members.filter((m) => !notified[m.id]).length;

  return (
    <div className="hub-doc-notify-panel">
      <div className="hub-doc-notify-panel__header">
        <span className="hub-doc-notify-panel__label">Notify team members</span>
        {eligibleCount > 0 && (
          <div className="hub-doc-notify-panel__actions">
            <button type="button" className="hub-doc-notify-link" onClick={selectAllEligible}>All</button>
            <span className="hub-doc-notify-sep">·</span>
            <button type="button" className="hub-doc-notify-link" onClick={() => onChange([])}>None</button>
          </div>
        )}
      </div>
      {loading ? (
        <p className="hub-doc-notify-loading">Loading…</p>
      ) : (
        <div className="hub-doc-notify-panel__list">
          {members.map((m) => {
            const alreadyAt = notified[m.id];
            if (alreadyAt) {
              return (
                <div key={m.id} className="hub-doc-notify-member hub-doc-notify-member--done">
                  <span className="hub-doc-notify-check">✓</span>
                  <span className="hub-doc-notify-member__name">{memberDisplayName(m)}</span>
                  <span className="hub-doc-notify-member__meta">Notified {fmtNotifiedDate(alreadyAt)}</span>
                </div>
              );
            }
            return (
              <label key={m.id} className="hub-doc-notify-member">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(m.id)}
                  onChange={() => toggle(m.id)}
                />
                <span>{memberDisplayName(m)}</span>
              </label>
            );
          })}
        </div>
      )}
      {selectedIds.length > 0 && (
        <p className="hub-doc-notify-panel__count">
          {selectedIds.length} {selectedIds.length === 1 ? "person" : "people"} will be notified
        </p>
      )}
      {eligibleCount === 0 && !loading && (
        <p className="hub-doc-notify-panel__count">Everyone has already been notified.</p>
      )}
    </div>
  );
}
