"use client";

/**
 * HubDocShareModal — set a document's visibility and share it across hubs.
 * CSS prefix: hub-doc-share- (reuses the notify-modal shell).
 *
 * Two controls (RIM_Documents.md §7):
 *  - Visibility: HUB / COORDINATORS / COMMUNITY (who can reach it).
 *  - Share with hubs: add/remove HubDocumentPlacement rows — you can only share
 *    into hubs you belong to (the picker is your own active hubs, minus the
 *    origin and any hub it's already in).
 *
 * Opened only on ORIGIN-hub rows (the home hub owns sharing). Each change
 * persists immediately via /api/documents/[id]/{visibility,placements} and
 * syncs the parent list through onUpdated.
 */

import { useState } from "react";

type Visibility = "HUB" | "COORDINATORS" | "COMMUNITY";

interface ShareDoc {
  id: string;
  label: string;
  visibility: Visibility;
  originHub: { id: string; slug: string; name: string } | null;
  sharedHubs: { id: string; slug: string; name: string }[];
}

interface Props {
  doc: ShareDoc;
  viewerHubs: { id: string; name: string }[];
  onUpdated: (docId: string, patch: { visibility?: Visibility; sharedHubs?: ShareDoc["sharedHubs"] }) => void;
  onClose: () => void;
}

const VIS_OPTIONS: { value: Visibility; label: string; desc: string }[] = [
  { value: "HUB",          label: "Hub members",     desc: "Anyone in the hubs this document is in." },
  { value: "COORDINATORS", label: "Coordinators only", desc: "Only coordinators of those hubs." },
  { value: "COMMUNITY",    label: "Whole community",  desc: "Any active member, in any hub." },
];

export default function HubDocShareModal({ doc, viewerHubs, onUpdated, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addHubId, setAddHubId] = useState("");

  // Hubs you could add: your active hubs, minus the origin and any already shared.
  const sharedIds = new Set(doc.sharedHubs.map((h) => h.id));
  const addableHubs = viewerHubs.filter(
    (h) => h.id !== doc.originHub?.id && !sharedIds.has(h.id),
  );

  async function changeVisibility(v: Visibility) {
    if (busy || v === doc.visibility) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: v }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not change visibility");
      onUpdated(doc.id, { visibility: v });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change visibility");
    } finally {
      setBusy(false);
    }
  }

  async function addHub() {
    if (!addHubId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/placements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hubId: addHubId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not share");
      onUpdated(doc.id, { sharedHubs: [...doc.sharedHubs, data.hub] });
      setAddHubId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not share");
    } finally {
      setBusy(false);
    }
  }

  async function removeHub(hub: ShareDoc["sharedHubs"][number]) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/placements?hubId=${encodeURIComponent(hub.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not remove");
      onUpdated(doc.id, { sharedHubs: doc.sharedHubs.filter((h) => h.id !== hub.id) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hub-doc-notify-overlay" onClick={onClose}>
      <div className="hub-doc-notify-modal hub-doc-share" onClick={(e) => e.stopPropagation()}>
        <div className="hub-doc-notify-modal__header">
          <strong>Share “{doc.label}”</strong>
          <button className="btn--ghost btn--xs" onClick={onClose}>Done</button>
        </div>

        {error && <p className="hub-doc-share__error">{error}</p>}

        {/* Visibility */}
        <div className="hub-doc-share__section">
          <div className="hub-doc-share__label">Who can see it</div>
          <select
            className="fs"
            value={doc.visibility}
            disabled={busy}
            onChange={(e) => changeVisibility(e.target.value as Visibility)}
          >
            {VIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p className="hub-doc-share__desc">
            {VIS_OPTIONS.find((o) => o.value === doc.visibility)?.desc}
          </p>
        </div>

        {/* Shared with hubs */}
        <div className="hub-doc-share__section">
          <div className="hub-doc-share__label">Shared with</div>
          {doc.sharedHubs.length === 0 ? (
            <p className="hub-doc-share__empty">Not shared with any other hubs yet.</p>
          ) : (
            <ul className="hub-doc-share__hubs">
              {doc.sharedHubs.map((h) => (
                <li key={h.id} className="hub-doc-share__hub-row">
                  <span className="hub-doc-share__hub-name">{h.name}</span>
                  <button className="hub-action-btn hub-action-btn--del" disabled={busy} onClick={() => removeHub(h)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {addableHubs.length > 0 ? (
            <div className="hub-doc-share__add">
              <select className="fs" value={addHubId} disabled={busy} onChange={(e) => setAddHubId(e.target.value)}>
                <option value="">Add a hub…</option>
                {addableHubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              <button className="btn btn--sm" disabled={busy || !addHubId} onClick={addHub}>Share</button>
            </div>
          ) : (
            <p className="hub-doc-share__empty">No other hubs you belong to are available to share into.</p>
          )}
        </div>
      </div>
    </div>
  );
}
