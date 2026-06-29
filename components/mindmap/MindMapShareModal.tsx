"use client";

/**
 * MindMapShareModal — sharing settings for a map (clone of HubDocShareModal,
 * plus the per-map edit option Jesse chose). Sets visibility, the edit policy,
 * and which hubs the map is placed in. Origin owns the lifecycle.
 */

import { useState } from "react";

type Visibility = "HUB" | "COORDINATORS" | "COMMUNITY";
type EditPolicy = "OPEN" | "RESTRICTED";

const VIS_OPTIONS: { value: Visibility; label: string; desc: string }[] = [
  { value: "HUB",          label: "Hub members",      desc: "Anyone in the hubs this map is in." },
  { value: "COORDINATORS", label: "Coordinators only", desc: "Only coordinators of those hubs." },
  { value: "COMMUNITY",    label: "Whole community",   desc: "Any active member, in any hub." },
];

const EDIT_OPTIONS: { value: EditPolicy; label: string; desc: string }[] = [
  { value: "OPEN",       label: "Everyone who can see it", desc: "A collaborative canvas — anyone who can open the map can add and move topics." },
  { value: "RESTRICTED", label: "Coordinators only",        desc: "Only you and the hubs' coordinators can edit; everyone else views." },
];

export interface ShareMap {
  id: string;
  title: string;
  visibility: Visibility;
  editPolicy: EditPolicy;
  originHub: { id: string; slug: string; name: string } | null;
  sharedHubs: { id: string; slug: string; name: string }[];
}

interface Props {
  map: ShareMap;
  viewerHubs: { id: string; name: string }[];
  onUpdated: (mapId: string, patch: Partial<Pick<ShareMap, "visibility" | "editPolicy" | "sharedHubs">>) => void;
  onClose: () => void;
}

export default function MindMapShareModal({ map, viewerHubs, onUpdated, onClose }: Props) {
  const [visibility, setVisibility] = useState<Visibility>(map.visibility);
  const [editPolicy, setEditPolicy] = useState<EditPolicy>(map.editPolicy);
  const [sharedHubs, setSharedHubs] = useState(map.sharedHubs);
  const [addHubId, setAddHubId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placedIds = new Set([map.originHub?.id, ...sharedHubs.map((h) => h.id)].filter(Boolean));
  const addable = viewerHubs.filter((h) => !placedIds.has(h.id));

  async function patchSharing(patch: { visibility?: Visibility; editPolicy?: EditPolicy }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/mindmaps/${map.id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      if (patch.visibility) setVisibility(patch.visibility);
      if (patch.editPolicy) setEditPolicy(patch.editPolicy);
      onUpdated(map.id, patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function addPlacement() {
    if (!addHubId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/mindmaps/${map.id}/placements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hubId: addHubId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Share failed");
      const { hub } = await res.json();
      const next = [...sharedHubs, hub];
      setSharedHubs(next);
      setAddHubId("");
      onUpdated(map.id, { sharedHubs: next });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Share failed");
    } finally {
      setBusy(false);
    }
  }

  async function removePlacement(hubId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/mindmaps/${map.id}/placements?hubId=${encodeURIComponent(hubId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Remove failed");
      const next = sharedHubs.filter((h) => h.id !== hubId);
      setSharedHubs(next);
      onUpdated(map.id, { sharedHubs: next });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hub-doc-notify-overlay" onClick={onClose}>
      <div className="hub-doc-notify-modal mm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Share ${map.title}`}>
        <header className="mm-modal__head">
          <h2 className="mm-modal__title">Share “{map.title}”</h2>
          <button className="mm-panel__close mm-modal__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="mm-modal__body">
          {error && <p className="mm-modal__error">{error}</p>}

          <label className="mm-field">
            <span className="mm-field__label">Who can see it</span>
            <select
              className="mm-modal__select"
              value={visibility}
              disabled={busy}
              onChange={(e) => patchSharing({ visibility: e.target.value as Visibility })}
            >
              {VIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span className="mm-field__hint">{VIS_OPTIONS.find((o) => o.value === visibility)?.desc}</span>
          </label>

          <label className="mm-field">
            <span className="mm-field__label">Who can edit it</span>
            <select
              className="mm-modal__select"
              value={editPolicy}
              disabled={busy}
              onChange={(e) => patchSharing({ editPolicy: e.target.value as EditPolicy })}
            >
              {EDIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span className="mm-field__hint">{EDIT_OPTIONS.find((o) => o.value === editPolicy)?.desc}</span>
          </label>

          <div className="mm-field">
            <span className="mm-field__label">Shared into</span>
            {sharedHubs.length === 0 ? (
              <p className="mm-field__hint">Not shared into any other hubs yet.</p>
            ) : (
              <ul className="mm-modal__hublist">
                {sharedHubs.map((h) => (
                  <li key={h.id} className="mm-modal__hubrow">
                    <span>{h.name}</span>
                    <button className="mm-dir__card-del" disabled={busy} onClick={() => removePlacement(h.id)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
            {addable.length > 0 && (
              <div className="mm-modal__add">
                <select className="mm-modal__select" value={addHubId} disabled={busy} onChange={(e) => setAddHubId(e.target.value)}>
                  <option value="">Add a hub you belong to…</option>
                  {addable.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
                <button className="mm-btn" disabled={busy || !addHubId} onClick={addPlacement}>Share</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
