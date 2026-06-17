"use client";

import { useCallback, useEffect, useState } from "react";

interface Hub {
  id: string;
  slug: string;
  name: string;
  type: string;
}
interface Membership {
  hubId: string;
  isCoordinator: boolean;
  status: string;
}

interface Props {
  memberId: string;
}

/**
 * Hub memberships, managed from the admin member profile (ADMIN / REGISTRAR).
 * Assign the person to any active hub — including pre-staging a legacy/staged
 * account before they've logged in — with an optional coordinator flag. Adds are
 * silent (no email). Removal clears the person's upcoming coverage in that hub
 * (the s146 FK-safe cleanup), so it's behind a confirm.
 */
export default function HubMembershipSection({ memberId }: Props) {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [addSlug, setAddSlug] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null); // hubId

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/members/${memberId}/hubs`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't load hubs");
      setHubs(data.hubs);
      setMemberships(data.memberships);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load hubs");
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  const hubById = (hubId: string) => hubs.find((h) => h.id === hubId);
  const memberHubIds = new Set(memberships.map((m) => m.hubId));
  const available = hubs.filter((h) => !memberHubIds.has(h.id));
  const sortedMemberships = [...memberships].sort((a, b) =>
    (hubById(a.hubId)?.name ?? "").localeCompare(hubById(b.hubId)?.name ?? ""),
  );

  const post = async (hubSlug: string, isCoordinator: boolean) => {
    if (busySlug) return;
    setBusySlug(hubSlug);
    setError("");
    try {
      const res = await fetch(`/api/admin/members/${memberId}/hubs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hubSlug, isCoordinator }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't update hub membership");
      setAddSlug("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update hub membership");
    } finally {
      setBusySlug(null);
    }
  };

  const removeFromHub = async (hubSlug: string) => {
    if (busySlug) return;
    setBusySlug(hubSlug);
    setError("");
    try {
      const res = await fetch(`/api/admin/members/${memberId}/hubs`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hubSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't remove from hub");
      setConfirmRemove(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove from hub");
    } finally {
      setBusySlug(null);
    }
  };

  return (
    <section className="adm2-section">
      <h2 className="adm2-section__title">Hub memberships</h2>
      <p className="adm2-section__hint">
        Assign this person to any team hub — including pre-staging before they&rsquo;ve logged in.
        Marking someone a coordinator gives them coverage authority for that hub. Adding is silent; no email is sent.
      </p>

      {error && (
        <p className="adm2-save__error" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}

      {loading ? (
        <p className="adm2-section__hint">Loading…</p>
      ) : (
        <>
          {sortedMemberships.length === 0 ? (
            <p className="adm2-section__hint">Not a member of any hub yet.</p>
          ) : (
            <ul className="adm2-hublist">
              {sortedMemberships.map((m) => {
                const hub = hubById(m.hubId);
                if (!hub) return null;
                const rowBusy = busySlug === hub.slug;
                const isConfirming = confirmRemove === m.hubId;
                return (
                  <li key={m.hubId} className="adm2-hublist__row">
                    <div className="adm2-hublist__main">
                      <div className="adm2-hublist__info">
                        <span className="adm2-hublist__name">{hub.name}</span>
                        {m.status !== "ACTIVE" && (
                          <span className="adm2-hublist__status">{m.status.toLowerCase()}</span>
                        )}
                      </div>
                      <label className="adm2-hublist__coord">
                        <input
                          type="checkbox"
                          checked={m.isCoordinator}
                          disabled={rowBusy}
                          onChange={(e) => post(hub.slug, e.target.checked)}
                        />
                        Coordinator
                      </label>
                      {!isConfirming && (
                        <button
                          type="button"
                          className="adm2-hublist__remove"
                          disabled={rowBusy}
                          onClick={() => setConfirmRemove(m.hubId)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {isConfirming && (
                      <div className="adm2-hublist__confirm">
                        <span className="adm2-hublist__warn">
                          Remove from {hub.name}? This also clears their upcoming coverage in this hub.
                        </span>
                        <span className="adm2-hublist__confirm-actions">
                          <button
                            type="button"
                            className="adm2-btn--danger"
                            disabled={rowBusy}
                            onClick={() => removeFromHub(hub.slug)}
                          >
                            {rowBusy ? "Removing…" : "Yes, remove"}
                          </button>
                          <button
                            type="button"
                            className="adm2-btn--neutral"
                            disabled={rowBusy}
                            onClick={() => setConfirmRemove(null)}
                          >
                            Cancel
                          </button>
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {available.length > 0 && (
            <div className="adm2-hublist__add">
              <select
                className="adm2-hublist__select"
                value={addSlug}
                onChange={(e) => setAddSlug(e.target.value)}
                disabled={!!busySlug}
              >
                <option value="">Add to a hub…</option>
                {available.map((h) => (
                  <option key={h.id} value={h.slug}>
                    {h.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="adm2-save__btn"
                onClick={() => addSlug && post(addSlug, false)}
                disabled={!addSlug || !!busySlug}
              >
                {addSlug && busySlug === addSlug ? "Adding…" : "Add"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
