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

/** A plain answer for a refused request: sign-in, permission and missing
    things in people's words; the server's own reason only when it is a
    sentence written for people; otherwise the kind fallback. */
function readableError(status: number, serverError: unknown, fallback: string): string {
  if (status === 401) return "You\u2019ve been signed out. Sign in again, then try once more.";
  if (status === 404) return "That isn\u2019t here any more. Refresh the page.";
  // Keep the server's words only when they are a sentence written for people
  // (several words, ending in a full stop), never a code like "Hub not found".
  const text = typeof serverError === "string" ? serverError.trim() : "";
  if (/\s/.test(text) && /[.?!]$/.test(text) && !/\b(hubs?|spaces?)\b/i.test(text)) return text;
  // A refusal says why when the server wrote it for people ("Open this from
  // within RIM."); otherwise plainly.
  if (status === 403) return "You don\u2019t have permission to do that here.";
  return fallback;
}

async function reasonFrom(res: Response, fallback: string) {
  const data = await res.json().catch(() => null);
  return readableError(res.status, data?.error, fallback);
}

const OFFLINE = "Couldn't reach the server, so nothing changed. Please try again.";

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
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [joinTarget, setJoinTarget] = useState<{ householdId: string; householdName: string | null } | null>(null);
  const [joinRel, setJoinRel] = useState("OTHER");
  const [joinCustom, setJoinCustom] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Remove (asked first, in the card)
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
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
      if (!res.ok) {
        setCreateError(await reasonFrom(res, "The household wasn't created. Please try again."));
        return;
      }
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
    } catch {
      setCreateError("Couldn't reach the server, so the household wasn't created. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const searchForJoin = useCallback(async (q: string) => {
    if (q.length < 2) { setJoinResults([]); return; }
    setJoinSearching(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/admin/members?q=${encodeURIComponent(q)}&limit=8`);
      if (!res.ok) { setJoinError("The search didn't work just now. Please try typing again."); return; }
      const data = await res.json();
      setJoinResults((data.members ?? data).filter((u: HouseholdUser) => u.id !== memberId));
    } catch {
      setJoinError("The search didn't work just now. Please try typing again.");
    } finally {
      setJoinSearching(false);
    }
  }, [memberId]);

  const handleSelectJoinTarget = async (u: HouseholdUser) => {
    setCheckingId(u.id);
    setJoinError(null);
    try {
      // That member's household, if they have one (null when they don't).
      const res = await fetch(`/api/admin/members/${u.id}/household`);
      if (!res.ok) {
        setJoinError(await reasonFrom(res, `Couldn't look up ${memberDisplayName(u)}'s household. Please try again.`));
        return;
      }
      const hh = await res.json();
      if (!hh) {
        setJoinError(`${memberDisplayName(u)} is not in a household yet. Create one instead.`);
        return;
      }
      setJoinTarget({ householdId: hh.id, householdName: hh.name });
      setJoinSearch("");
      setJoinResults([]);
    } catch {
      setJoinError(`Couldn't reach the server to look up ${memberDisplayName(u)}'s household. Please try again.`);
    } finally {
      setCheckingId(null);
    }
  };

  const handleJoin = async () => {
    if (!joinTarget) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/admin/households/${joinTarget.householdId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: memberId,
          relationshipType: joinRel,
          relationshipCustom: joinRel === "OTHER" ? joinCustom : null,
        }),
      });
      if (!res.ok) {
        setJoinError(await reasonFrom(res, "This member wasn't added to the household. Please try again."));
        return;
      }
      // They are in. Show the household as it now stands; if that read
      // fails, show what we already know rather than nothing.
      const known: HouseholdInfo = {
        id: joinTarget.householdId,
        name: joinTarget.householdName,
        addressLine1: null,
        addressCity: null,
        addressState: null,
        addressZip: null,
        isPrimary: false,
        relationshipType: joinRel,
        relationshipCustom: joinRel === "OTHER" ? joinCustom || null : null,
        otherMembers: [],
      };
      const hhRes = await fetch(`/api/admin/households/${joinTarget.householdId}`).catch(() => null);
      const hhData = hhRes?.ok ? await hhRes.json().catch(() => null) : null;
      if (hhData?.members) {
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
      } else {
        setHousehold(known);
      }
      setMode("idle");
    } catch {
      setJoinError("Couldn't reach the server, so this member wasn't added. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const handleRemove = async () => {
    if (!household) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      const res = await fetch(`/api/admin/households/${household.id}/members/${memberId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setRemoveError(await reasonFrom(res, "This member wasn't removed from the household. Please try again."));
        return;
      }
      setConfirmRemove(false);
      setHousehold(null);
      setMode("idle");
    } catch {
      setRemoveError(OFFLINE);
    } finally {
      setRemoving(false);
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
              <label className="adm-form__label" htmlFor="hhs-new-name">Household name (optional)</label>
              <input
                id="hhs-new-name"
                className="adm-form__input"
                placeholder="e.g. The Smith Family"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="adm-form__row" style={{ gap: "12px", alignItems: "flex-end" }}>
              <div className="adm-form__field" style={{ flex: 1 }}>
                <label className="adm-form__label" htmlFor="hhs-new-rel">This member&rsquo;s role in household</label>
                <select id="hhs-new-rel" className="adm-form__select" value={newRel} onChange={(e) => setNewRel(e.target.value)}>
                  {Object.entries(RELATIONSHIP_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              {newRel === "OTHER" && (
                <div className="adm-form__field" style={{ flex: 1 }}>
                  <label className="adm-form__label" htmlFor="hhs-new-custom">Describe (optional)</label>
                  <input
                    id="hhs-new-custom"
                    className="adm-form__input"
                    placeholder="e.g. guardian"
                    value={newCustom}
                    onChange={(e) => setNewCustom(e.target.value)}
                  />
                </div>
              )}
            </div>
            {createError && <p className="adm-form__hint adm-form__hint--warn" role="alert">{createError}</p>}
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button className="adm-btn adm-btn--primary" onClick={handleCreate} disabled={creating}>
                {creating ? "Creating…" : "Create household"}
              </button>
              <button className="adm-btn adm-btn--ghost" onClick={() => { setMode("idle"); setCreateError(null); }} disabled={creating}>Cancel</button>
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
                  aria-label="Search members by name or email"
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
                        <button className="hh-search__result" onClick={() => handleSelectJoinTarget(u)} disabled={checkingId !== null}>
                          {checkingId === u.id ? "Checking…" : memberDisplayName(u)}
                          <span className="hh-search__email">{u.email}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {joinError && <p className="adm-form__hint adm-form__hint--warn" role="alert">{joinError}</p>}
              </div>
            ) : (
              <div className="hh-add-form">
                <p className="hh-add-form__selected">
                  Household:{" "}
                  <strong>{joinTarget.householdName ?? "Unnamed household"}</strong>{" "}
                  <button className="adm-link" onClick={() => { setJoinTarget(null); setJoinError(null); }}>change</button>
                </p>
                <div className="hh-inline-form">
                  <div className="adm-form__field hh-inline-form__field">
                    <label className="adm-form__label" htmlFor="hhs-join-rel">Relationship</label>
                    <select id="hhs-join-rel" className="adm-form__select" value={joinRel} onChange={(e) => setJoinRel(e.target.value)}>
                      {Object.entries(RELATIONSHIP_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                  {joinRel === "OTHER" && (
                    <div className="adm-form__field hh-inline-form__field">
                      <label className="adm-form__label" htmlFor="hhs-join-custom">Describe (optional)</label>
                      <input
                        id="hhs-join-custom"
                        className="adm-form__input"
                        placeholder="e.g. guardian"
                        value={joinCustom}
                        onChange={(e) => setJoinCustom(e.target.value)}
                      />
                    </div>
                  )}
                  <button className="adm-btn adm-btn--primary hh-inline-form__btn" onClick={handleJoin} disabled={joining}>
                    {joining ? "Adding…" : "Join household"}
                  </button>
                </div>
                {joinError && <p className="adm-form__hint adm-form__hint--warn" role="alert">{joinError}</p>}
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
          {household.isPrimary && <span className="adm-badge adm-badge--primary-contact">Primary contact</span>}
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
                {m.isPrimary && <span className="adm-badge adm-badge--primary-contact">Primary</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="hh-household-card__footer">
          {!confirmRemove ? (
            <button
              className="adm-btn adm-btn--sm adm-btn--danger-ghost"
              onClick={() => { setConfirmRemove(true); setRemoveError(null); }}
            >
              Remove from household
            </button>
          ) : (
            <div className="adm-confirm">
              <p>
                Take this member out of {household.name ?? "this household"}? The household
                itself stays, with anyone else still in it.
              </p>
              <button className="adm-btn adm-btn--danger" onClick={handleRemove} disabled={removing}>
                {removing ? "Removing…" : "Yes, remove"}
              </button>
              <button
                className="adm-btn adm-btn--ghost"
                onClick={() => { setConfirmRemove(false); setRemoveError(null); }}
                disabled={removing}
              >
                Cancel
              </button>
            </div>
          )}
          {removeError && <p className="save-note save-note--error" role="alert">{removeError}</p>}
        </div>
      </div>
    </section>
  );
}
