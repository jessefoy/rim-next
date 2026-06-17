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
  derivedFromRole: boolean;
  derivedRole: string | null;
}

interface Props {
  memberId: string;
}

type Seg = "off" | "member" | "coordinator";

/**
 * Teams panel on the admin member profile (ADMIN / REGISTRAR). One row per
 * active hub with an Off / Member / Coordinator control — the single place to
 * see and set which teams a person serves on, including pre-staging before they
 * log in. Memberships that come from a role (courses ← Teacher, registrar ←
 * Registrar) render locked "via … role" and are managed in Roles & access.
 * Changes are silent (no email); turning a team Off clears the person's upcoming
 * coverage in that hub (the s146 FK-safe cleanup), so it sits behind a confirm.
 */
export default function HubMembershipSection({ memberId }: Props) {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [confirmOff, setConfirmOff] = useState<string | null>(null); // hubId

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

  const membershipFor = (hubId: string) => memberships.find((m) => m.hubId === hubId);
  const stateOf = (hubId: string): Seg => {
    const m = membershipFor(hubId);
    if (!m) return "off";
    return m.isCoordinator ? "coordinator" : "member";
  };

  const apply = async (hubSlug: string, target: Seg) => {
    if (busySlug) return;
    setBusySlug(hubSlug);
    setError("");
    try {
      const res =
        target === "off"
          ? await fetch(`/api/admin/members/${memberId}/hubs`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ hubSlug }),
            })
          : await fetch(`/api/admin/members/${memberId}/hubs`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ hubSlug, isCoordinator: target === "coordinator" }),
            });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't update hub membership");
      setConfirmOff(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update hub membership");
    } finally {
      setBusySlug(null);
    }
  };

  const onSeg = (hub: Hub, target: Seg) => {
    if (stateOf(hub.id) === target) return; // no-op on the current state
    if (target === "off") {
      setConfirmOff(hub.id); // removal clears coverage — confirm first
      return;
    }
    setConfirmOff(null);
    apply(hub.slug, target);
  };

  const sortedHubs = [...hubs].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="adm2-section">
      <h2 className="adm2-section__title">Hub memberships</h2>
      <p className="adm2-section__hint">
        The teams this person serves on. Set each to Member or Coordinator — a coordinator holds
        coverage authority for that hub. Changes are silent (no email). Teams marked “via … role”
        come from Roles &amp; access above.
      </p>

      {error && (
        <p className="adm2-save__error" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}

      {loading ? (
        <p className="adm2-section__hint">Loading…</p>
      ) : (
        <ul className="adm2-hublist">
          {sortedHubs.map((hub) => {
            const m = membershipFor(hub.id);
            const seg = stateOf(hub.id);
            const rowBusy = busySlug === hub.slug;
            const isConfirming = confirmOff === hub.id;

            return (
              <li key={hub.id} className="adm2-hublist__row">
                <div className="adm2-hublist__main">
                  <div className="adm2-hublist__info">
                    <span className="adm2-hublist__name">{hub.name}</span>
                    {m && m.status !== "ACTIVE" && (
                      <span className="adm2-hublist__status">{m.status.toLowerCase()}</span>
                    )}
                  </div>

                  {m?.derivedFromRole ? (
                    <span className="adm2-hublist__locked">
                      <i className="ti ti-lock" aria-hidden="true" />
                      {m.isCoordinator ? "Coordinator" : "Member"} · via{" "}
                      {(m.derivedRole ?? "").toLowerCase()} role
                    </span>
                  ) : (
                    <span className="adm2-seg" role="group" aria-label={`${hub.name} membership`}>
                      {(["off", "member", "coordinator"] as Seg[]).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={`adm2-seg__btn${seg === opt ? " adm2-seg__btn--active" : ""}`}
                          disabled={rowBusy}
                          aria-pressed={seg === opt}
                          onClick={() => onSeg(hub, opt)}
                        >
                          {opt === "off" ? "Off" : opt === "member" ? "Member" : "Coordinator"}
                        </button>
                      ))}
                    </span>
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
                        onClick={() => apply(hub.slug, "off")}
                      >
                        {rowBusy ? "Removing…" : "Yes, remove"}
                      </button>
                      <button
                        type="button"
                        className="adm2-btn--neutral"
                        disabled={rowBusy}
                        onClick={() => setConfirmOff(null)}
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
    </section>
  );
}
