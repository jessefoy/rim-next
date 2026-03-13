"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import RimEditor from "./RimEditor";

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
  preferredName: string | null;
  email: string;
}

interface HouseholdMember {
  id: string;
  userId: string;
  isPrimary: boolean;
  relationshipType: string;
  relationshipCustom: string | null;
  createdAt: string;
  user: HouseholdUser;
}

interface Household {
  id: string;
  name: string | null;
  addressLine1: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  notes: string | null;
  createdAt: string;
  members: HouseholdMember[];
}

interface Props {
  household: Household;
  isAdmin: boolean;
}

function memberDisplayName(u: HouseholdUser) {
  const full = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return full || u.email;
}

function relationshipLabel(m: HouseholdMember) {
  if (m.relationshipType === "OTHER" && m.relationshipCustom) return m.relationshipCustom;
  return RELATIONSHIP_LABELS[m.relationshipType] ?? m.relationshipType;
}

export default function HouseholdDetail({ household: initial, isAdmin }: Props) {
  const [household, setHousehold] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Editable household fields
  const [name, setName] = useState(initial.name ?? "");
  const [addressLine1, setAddressLine1] = useState(initial.addressLine1 ?? "");
  const [addressCity, setAddressCity] = useState(initial.addressCity ?? "");
  const [addressState, setAddressState] = useState(initial.addressState ?? "");
  const [addressZip, setAddressZip] = useState(initial.addressZip ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");

  // Add member
  const [addSearch, setAddSearch] = useState("");
  const [addResults, setAddResults] = useState<HouseholdUser[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addMember, setAddMember] = useState<HouseholdUser | null>(null);
  const [addRel, setAddRel] = useState("OTHER");
  const [addCustom, setAddCustom] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Delete household
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Remove member
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Edit relationship inline
  const [editingRelId, setEditingRelId] = useState<string | null>(null);
  const [editRelType, setEditRelType] = useState("OTHER");
  const [editRelCustom, setEditRelCustom] = useState("");
  const [savingRelId, setSavingRelId] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    const res = await fetch(`/api/admin/households/${household.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, addressLine1, addressCity, addressState, addressZip, notes }),
    });
    setSaving(false);
    if (res.ok) {
      setSaveMsg("Saved.");
      setTimeout(() => setSaveMsg(null), 3000);
    } else {
      setSaveMsg("Error saving.");
    }
  };

  const searchMembers = useCallback(async (q: string) => {
    if (q.length < 2) { setAddResults([]); return; }
    setAddSearching(true);
    const res = await fetch(`/api/admin/members?q=${encodeURIComponent(q)}&limit=8`);
    setAddSearching(false);
    if (res.ok) {
      const data = await res.json();
      // Exclude members already in this household
      const inHousehold = new Set(household.members.map((m) => m.userId));
      setAddResults((data.members ?? data).filter((u: HouseholdUser) => !inHousehold.has(u.id)));
    }
  }, [household.members]);

  const handleSetPrimary = async (userId: string) => {
    const res = await fetch(`/api/admin/households/${household.id}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimary: true }),
    });
    if (res.ok) {
      setHousehold((h) => ({
        ...h,
        members: h.members.map((m) => ({ ...m, isPrimary: m.userId === userId })),
      }));
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setRemovingId(userId);
    const res = await fetch(`/api/admin/households/${household.id}/members/${userId}`, {
      method: "DELETE",
    });
    setRemovingId(null);
    if (res.ok) {
      setHousehold((h) => ({
        ...h,
        members: h.members.filter((m) => m.userId !== userId),
      }));
    }
  };

  const handleAddMember = async () => {
    if (!addMember) return;
    setAdding(true);
    setAddError(null);
    const res = await fetch(`/api/admin/households/${household.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: addMember.id,
        relationshipType: addRel,
        relationshipCustom: addRel === "OTHER" ? addCustom : null,
      }),
    });
    setAdding(false);
    if (res.ok) {
      const newMember = await res.json();
      setHousehold((h) => ({ ...h, members: [...h.members, newMember] }));
      setAddMember(null);
      setAddSearch("");
      setAddResults([]);
      setAddRel("OTHER");
      setAddCustom("");
    } else {
      const data = await res.json();
      setAddError(data.error ?? "Error adding member.");
    }
  };

  const handleEditRelStart = (m: HouseholdMember) => {
    setEditingRelId(m.userId);
    setEditRelType(m.relationshipType);
    setEditRelCustom(m.relationshipCustom ?? "");
  };

  const handleSaveRel = async (userId: string) => {
    setSavingRelId(userId);
    const res = await fetch(`/api/admin/households/${household.id}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relationshipType: editRelType,
        relationshipCustom: editRelType === "OTHER" ? editRelCustom || null : null,
      }),
    });
    setSavingRelId(null);
    if (res.ok) {
      setHousehold((h) => ({
        ...h,
        members: h.members.map((m) =>
          m.userId === userId
            ? { ...m, relationshipType: editRelType, relationshipCustom: editRelType === "OTHER" ? editRelCustom || null : null }
            : m
        ),
      }));
      setEditingRelId(null);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/admin/households/${household.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      window.location.href = "/admin/households";
    } else {
      const data = await res.json();
      alert(data.error ?? "Error deleting household.");
      setConfirmDelete(false);
    }
  };

  return (
    <div>
      <header className="adm-header">
        <p className="lp-label">
          <Link href="/admin/households" className="adm-back">← Households</Link>
        </p>
        <h1 className="adm-header__title">
          {household.name ?? <span className="adm-muted">Unnamed household</span>}
        </h1>
      </header>

      {/* Household info form */}
      <section className="adm-section">
        <h2 className="adm-section__title">Household info</h2>
        <div className="adm-form__field">
          <label className="adm-form__label">Name</label>
          <input
            className="adm-form__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. The Smith Family"
          />
        </div>
        <div className="adm-form__field">
          <label className="adm-form__label">Street address</label>
          <input
            className="adm-form__input"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
          />
        </div>
        <div className="adm-form__row adm-form__row--3col">
          <div className="adm-form__field">
            <label className="adm-form__label">City</label>
            <input className="adm-form__input" value={addressCity} onChange={(e) => setAddressCity(e.target.value)} />
          </div>
          <div className="adm-form__field">
            <label className="adm-form__label">State</label>
            <input className="adm-form__input" value={addressState} onChange={(e) => setAddressState(e.target.value)} maxLength={2} style={{ maxWidth: "80px" }} />
          </div>
          <div className="adm-form__field">
            <label className="adm-form__label">ZIP</label>
            <input className="adm-form__input" value={addressZip} onChange={(e) => setAddressZip(e.target.value)} maxLength={10} style={{ maxWidth: "120px" }} />
          </div>
        </div>
        <div className="adm-form__field">
          <label className="adm-form__label">Notes</label>
          <RimEditor
            rows={4}
            value={notes ?? ""}
            onChange={setNotes}
          />
        </div>
        <div className="adm-save-bar">
          <button className="adm-btn adm-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saveMsg && <span className="adm-save-bar__msg">{saveMsg}</span>}
        </div>
      </section>

      {/* Members */}
      <section className="adm-section">
        <h2 className="adm-section__title">Members ({household.members.length})</h2>

        {household.members.length === 0 ? (
          <p className="adm-empty">No members.</p>
        ) : (
          <ul className="hh-member-list">
            {household.members.map((m) => (
              <li key={m.id} className="hh-member-row">
                <div className="hh-member-row__main">
                  <div className="hh-member-row__info">
                    <Link href={`/admin/members/${m.user.id}`} className="hh-link hh-member-row__name">
                      {memberDisplayName(m.user)}
                    </Link>
                    {editingRelId !== m.userId && (
                      <div className="hh-member-row__rel-area">
                        <span className="hh-member-row__rel">{relationshipLabel(m)}</span>
                        <button className="hh-member-row__edit-rel" onClick={() => handleEditRelStart(m)}>edit</button>
                        {m.isPrimary && <span className="adm-badge adm-badge--primary-contact">Primary</span>}
                      </div>
                    )}
                  </div>
                  <div className="hh-member-row__actions">
                    {!m.isPrimary && (
                      <button
                        className="adm-btn adm-btn--sm adm-btn--ghost"
                        onClick={() => handleSetPrimary(m.userId)}
                      >
                        Set primary
                      </button>
                    )}
                    <button
                      className="adm-btn adm-btn--sm adm-btn--danger-ghost"
                      onClick={() => handleRemoveMember(m.userId)}
                      disabled={removingId === m.userId}
                    >
                      {removingId === m.userId ? "Removing…" : "Remove"}
                    </button>
                  </div>
                </div>
                {editingRelId === m.userId && (
                  <div className="hh-rel-edit">
                    <select
                      className="adm-form__select hh-rel-edit__select"
                      value={editRelType}
                      onChange={(e) => setEditRelType(e.target.value)}
                    >
                      {Object.entries(RELATIONSHIP_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                    {editRelType === "OTHER" && (
                      <input
                        className="adm-form__input hh-rel-edit__input"
                        placeholder="e.g. guardian"
                        value={editRelCustom}
                        onChange={(e) => setEditRelCustom(e.target.value)}
                      />
                    )}
                    <button
                      className="adm-btn adm-btn--sm adm-btn--primary"
                      onClick={() => handleSaveRel(m.userId)}
                      disabled={savingRelId === m.userId}
                    >
                      {savingRelId === m.userId ? "Saving…" : "Save"}
                    </button>
                    <button className="adm-btn adm-btn--sm adm-btn--ghost" onClick={() => setEditingRelId(null)}>
                      Cancel
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Add member */}
        <div className="hh-add-member">
          <h3 className="hh-add-member__title">Add member</h3>
          {!addMember ? (
            <div className="hh-search">
              <input
                className="adm-form__input"
                placeholder="Search by name or email…"
                value={addSearch}
                onChange={(e) => {
                  setAddSearch(e.target.value);
                  searchMembers(e.target.value);
                }}
                autoComplete="off"
              />
              {addSearching && <p className="hh-search__status">Searching…</p>}
              {addResults.length > 0 && (
                <ul className="hh-search__results">
                  {addResults.map((u) => (
                    <li key={u.id}>
                      <button
                        className="hh-search__result"
                        onClick={() => {
                          setAddMember(u);
                          setAddSearch("");
                          setAddResults([]);
                        }}
                      >
                        {memberDisplayName(u)}
                        <span className="hh-search__email">{u.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="hh-add-form">
              <p className="hh-add-form__selected">
                Adding: <strong>{memberDisplayName(addMember)}</strong>{" "}
                <button className="adm-link" onClick={() => setAddMember(null)}>change</button>
              </p>
              <div className="hh-inline-form">
                <div className="adm-form__field hh-inline-form__field">
                  <label className="adm-form__label">Relationship</label>
                  <select className="adm-form__select" value={addRel} onChange={(e) => setAddRel(e.target.value)}>
                    {Object.entries(RELATIONSHIP_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                {addRel === "OTHER" && (
                  <div className="adm-form__field hh-inline-form__field">
                    <label className="adm-form__label">Describe (optional)</label>
                    <input
                      className="adm-form__input"
                      placeholder="e.g. roommate"
                      value={addCustom}
                      onChange={(e) => setAddCustom(e.target.value)}
                    />
                  </div>
                )}
                <button
                  className="adm-btn adm-btn--primary hh-inline-form__btn"
                  onClick={handleAddMember}
                  disabled={adding}
                >
                  {adding ? "Adding…" : "Add"}
                </button>
              </div>
              {addError && <p className="adm-form__hint adm-form__hint--warn">{addError}</p>}
            </div>
          )}
        </div>
      </section>

      {/* Danger zone */}
      {isAdmin && (
        <section className="adm-danger-zone">
          <h2 className="adm-danger-zone__title">Danger zone</h2>
          <p>
            Delete this household permanently.{" "}
            {household.members.length > 1
              ? "Remove all members first before deleting."
              : "Members will no longer be grouped."}
          </p>
          {!confirmDelete ? (
            <button
              className="adm-btn adm-btn--danger"
              onClick={() => setConfirmDelete(true)}
              disabled={household.members.length > 1}
            >
              Delete household
            </button>
          ) : (
            <div className="adm-confirm">
              <p>Are you sure? This cannot be undone.</p>
              <button className="adm-btn adm-btn--danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button className="adm-btn adm-btn--ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
