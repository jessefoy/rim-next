"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

const RELATIONSHIP_LABELS: Record<string, string> = {
  SPOUSE: "Spouse",
  PARTNER: "Partner",
  PARENT: "Parent",
  CHILD: "Child",
  SIBLING: "Sibling",
  OTHER: "Other",
};

interface HouseholdUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

interface OtherMember {
  userId: string;
  isPrimary: boolean;
  relationshipType: string;
  relationshipCustom: string | null;
  user: HouseholdUser;
}

interface HouseholdInfo {
  id: string;
  name: string | null;
  addressLine1: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  isPrimary: boolean;
  relationshipType: string;
  relationshipCustom: string | null;
  otherMembers: OtherMember[];
}

interface Props {
  memberId: string;
  household: HouseholdInfo | null;
}

function memberDisplayName(u: HouseholdUser) {
  const full = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return full || u.email;
}

function relationshipLabel(type: string, custom: string | null) {
  if (type === "OTHER" && custom) return custom;
  return RELATIONSHIP_LABELS[type] ?? type;
}

type Mode = "idle" | "creating" | "joining";

export default function HouseholdSection({ memberId, household: initialHousehold }: Props) {
  const [household, setHousehold] = useState(initialHousehold);
  const [mode, setMode] = useState<Mode>("idle");

  // Create household fields
  const [newName, setNewName] = useState("");
  const [newRel, setNewRel] = useState("OTHER");
  const [newCustom, setNewCustom] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Join household — search for another member (then use their household)
  const [joinSearch, setJoinSearch] = useState("");
  const [joinResults, setJoinResults] = useState<HouseholdUser[]>([]);
  const [joinSearching, setJoinSearching] = useState(false);
  const [joinTarget, setJoinTarget] = useState<{ householdId: string; householdName: string | null } | null>(null);
  const [joinRel, setJoinRel] = useState("OTHER");
  const [joinCustom, setJoinCustom] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Remove
  const [removing, setRemoving] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    const res = await fetch("/api/admin/households", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName || null,
        memberId,
        relationshipType: newRel,
        relationshipCustom: newRel === "OTHER" ? newCustom : null,
      }),
    });
    setCreating(false);
    if (res.ok) {
      const data = await res.json();
      setHousehold({
        id: data.id,
        name: data.name,
        addressLine1: data.addressLine1,
        addressCity: data.addressCity,
        addressState: data.addressState,
        addressZip: data.addressZip,
        isPrimary: true,
        relationshipType: newRel,
        relationshipCustom: newRel === "OTHER" ? newCustom : null,
        otherMembers: [],
      });
      setMode("idle");
    } else {
      const d = await res.json();
      setCreateError(d.error ?? "Error creating household.");
    }
  };

  const searchForJoin = useCallback(async (q: string) => {
    if (q.length < 2) { setJoinResults([]); return; }
    setJoinSearching(true);
    const res = await fetch(`/api/admin/members?q=${encodeURIComponent(q)}&limit=8`);
    setJoinSearching(false);
    if (res.ok) {
      const data = await res.json();
      setJoinResults((data.members ?? data).filter((u: HouseholdUser) => u.id !== memberId));
    }
  }, [memberId]);

  const checkMemberHousehold = async (userId: string) => {
    // Fetch that member's detail to get their household
    const res = await fetch(`/api/admin/members/${userId}/household`);
    if (!res.ok) return null;
    return res.json();
  };

  const handleSelectJoinTarget = async (u: HouseholdUser) => {
    const hh = await checkMemberHousehold(u.id);
    if (!hh) {
      setJoinError(`${memberDisplayName(u)} is not in a household yet. Create one instead.`);
      return;
    }
    setJoinTarget({ householdId: hh.id, householdName: hh.name });
    setJoinSearch("");
    setJoinResults([]);
    setJoinError(null);
  };

  const handleJoin = async () => {
    if (!joinTarget) return;
    setJoining(true);
    setJoinError(null);
    const res = await fetch(`/api/admin/households/${joinTarget.householdId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: memberId,
        relationshipType: joinRel,
        relationshipCustom: joinRel === "OTHER" ? joinCustom : null,
      }),
    });
    setJoining(false);
    if (res.ok) {
      // Refresh household data by fetching the new household detail
      const hhRes = await fetch(`/api/admin/households/${joinTarget.householdId}`);
      if (hhRes.ok) {
        const hhData = await hhRes.json();
        const me = hhData.members.find((m: { userId: string }) => m.userId === memberId);
        setHousehold({
          id: hhData.id,
          name: hhData.name,
          addressLine1: hhData.addressLine1,
          addressCity: hhData.addressCity,
          addressState: hhData.addressState,
          addressZip: hhData.addressZip,
          isPrimary: me?.isPrimary ?? false,
          relationshipType: me?.relationshipType ?? joinRel,
          relationshipCustom: me?.relationshipCustom ?? null,
          otherMembers: hhData.members
            .filter((m: { userId: string }) => m.userId !== memberId)
            .map((m: { userId: string; isPrimary: boolean; relationshipType: string; relationshipCustom: string | null; user: HouseholdUser }) => ({
              userId: m.userId,
              isPrimary: m.isPrimary,
              relationshipType: m.relationshipType,
              relationshipCustom: m.relationshipCustom,
              user: m.user,
            })),
        });
      }
      setMode("idle");
    } else {
      const d = await res.json();
      setJoinError(d.error ?? "Error joining household.");
    }
  };

  const handleRemove = async () => {
    if (!household) return;
    setRemoving(true);
    const res = await fetch(`/api/admin/households/${household.id}/members/${memberId}`, {
      method: "DELETE",
    });
    setRemoving(false);
    if (res.ok) {
      setHousehold(null);
      setMode("idle");
    }
  };

  // No household
  if (!household) {
    return (
      <section className="adm-section hh-section">
        <h2 className="adm-section__title">Household</h2>
        <p className="hh-empty">This member is not in a household.</p>

        {mode === "idle" && (
          <div className="hh-actions">
            <button className="adm-btn adm-btn--ghost" onClick={() => setMode("creating")}>
              Create new household
            </button>
            <button className="adm-btn adm-btn--ghost" onClick={() => setMode("joining")}>
              Add to existing household
            </button>
          </div>
        )}

        {mode === "creating" && (
          <div className="hh-create-form">
            <div className="adm-form__field">
              <label className="adm-form__label">Household name (optional)</label>
              <input
                className="adm-form__input"
                placeholder="e.g. The Smith Family"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="adm-form__row" style={{ gap: "12px", alignItems: "flex-end" }}>
              <div className="adm-form__field" style={{ flex: 1 }}>
                <label className="adm-form__label">This member&rsquo;s role in household</label>
                <select className="adm-form__select" value={newRel} onChange={(e) => setNewRel(e.target.value)}>
                  {Object.entries(RELATIONSHIP_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              {newRel === "OTHER" && (
                <div className="adm-form__field" style={{ flex: 1 }}>
                  <label className="adm-form__label">Describe (optional)</label>
                  <input
                    className="adm-form__input"
                    placeholder="e.g. guardian"
                    value={newCustom}
                    onChange={(e) => setNewCustom(e.target.value)}
                  />
                </div>
              )}
            </div>
            {createError && <p className="adm-form__hint adm-form__hint--warn">{createError}</p>}
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button className="adm-btn adm-btn--primary" onClick={handleCreate} disabled={creating}>
                {creating ? "Creating…" : "Create household"}
              </button>
              <button className="adm-btn adm-btn--ghost" onClick={() => setMode("idle")}>Cancel</button>
            </div>
          </div>
        )}

        {mode === "joining" && (
          <div className="hh-join-form">
            <p className="adm-form__hint">Search for another member who is already in a household.</p>
            {!joinTarget ? (
              <div className="hh-search">
                <input
                  className="adm-form__input"
                  placeholder="Search by name or email…"
                  value={joinSearch}
                  onChange={(e) => {
                    setJoinSearch(e.target.value);
                    searchForJoin(e.target.value);
                  }}
                  autoComplete="off"
                />
                {joinSearching && <p className="hh-search__status">Searching…</p>}
                {joinResults.length > 0 && (
                  <ul className="hh-search__results">
                    {joinResults.map((u) => (
                      <li key={u.id}>
                        <button className="hh-search__result" onClick={() => handleSelectJoinTarget(u)}>
                          {memberDisplayName(u)}
                          <span className="hh-search__email">{u.email}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {joinError && <p className="adm-form__hint adm-form__hint--warn">{joinError}</p>}
              </div>
            ) : (
              <div className="hh-add-form">
                <p className="hh-add-form__selected">
                  Household:{" "}
                  <strong>{joinTarget.householdName ?? "Unnamed household"}</strong>{" "}
                  <button className="adm-link" onClick={() => { setJoinTarget(null); setJoinError(null); }}>change</button>
                </p>
                <div className="adm-form__row" style={{ gap: "12px", alignItems: "flex-end" }}>
                  <div className="adm-form__field" style={{ flex: 1 }}>
                    <label className="adm-form__label">Relationship</label>
                    <select className="adm-form__select" value={joinRel} onChange={(e) => setJoinRel(e.target.value)}>
                      {Object.entries(RELATIONSHIP_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                  {joinRel === "OTHER" && (
                    <div className="adm-form__field" style={{ flex: 1 }}>
                      <label className="adm-form__label">Describe (optional)</label>
                      <input
                        className="adm-form__input"
                        placeholder="e.g. guardian"
                        value={joinCustom}
                        onChange={(e) => setJoinCustom(e.target.value)}
                      />
                    </div>
                  )}
                  <button className="adm-btn adm-btn--primary" onClick={handleJoin} disabled={joining}>
                    {joining ? "Adding…" : "Join household"}
                  </button>
                </div>
                {joinError && <p className="adm-form__hint adm-form__hint--warn">{joinError}</p>}
              </div>
            )}
            <button className="adm-btn adm-btn--ghost" onClick={() => { setMode("idle"); setJoinTarget(null); setJoinError(null); }} style={{ marginTop: "8px" }}>
              Cancel
            </button>
          </div>
        )}
      </section>
    );
  }

  // Has household
  const hhAddress = [household.addressLine1, household.addressCity, household.addressState, household.addressZip]
    .filter(Boolean).join(", ");

  return (
    <section className="adm-section hh-section">
      <h2 className="adm-section__title">Household</h2>
      <div className="hh-household-card">
        <div className="hh-household-card__header">
          <Link href={`/admin/households/${household.id}`} className="hh-link hh-household-card__name">
            {household.name ?? "Unnamed household"}
          </Link>
          {household.isPrimary && <span className="adm-badge adm-badge--registrar">Primary contact</span>}
          <span className="hh-household-card__rel">
            {relationshipLabel(household.relationshipType, household.relationshipCustom)}
          </span>
        </div>
        {hhAddress && (
          <p className="hh-household-card__address">{hhAddress}</p>
        )}
        {household.otherMembers.length > 0 && (
          <ul className="hh-member-list hh-member-list--compact">
            {household.otherMembers.map((m) => (
              <li key={m.userId} className="hh-member-row hh-member-row--compact">
                <Link href={`/admin/members/${m.user.id}`} className="hh-link">
                  {memberDisplayName(m.user)}
                </Link>
                <span className="hh-member-row__rel">
                  {relationshipLabel(m.relationshipType, m.relationshipCustom)}
                </span>
                {m.isPrimary && <span className="adm-badge adm-badge--registrar">Primary</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="hh-household-card__footer">
          <button
            className="adm-btn adm-btn--sm adm-btn--danger-ghost"
            onClick={handleRemove}
            disabled={removing}
          >
            {removing ? "Removing…" : "Remove from household"}
          </button>
        </div>
      </div>
    </section>
  );
}
