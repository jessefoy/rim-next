"use client";

/**
 * HubMembersClient — Members tab for all hubs.
 * CSS prefix: hub-mem-
 *
 * Member list with colored initials avatar, name, position, coordinator badge, join date.
 * Coordinators can: toggle coordinator status, update position, remove members, add members.
 */

import { useState } from "react";

interface MemberUser {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  title: string | null;
  email: string | null;
}

interface HubMemberRow {
  id: string;
  userId: string;
  isCoordinator: boolean;
  position: string | null;
  createdAt: string;
  user: MemberUser;
}

interface Props {
  hubSlug: string;
  members: HubMemberRow[];
  isCoordinator: boolean;
  currentUserId: string;
}

const AV_CLASSES = ["av--a", "av--b", "av--c", "av--d"] as const;

function displayName(u: MemberUser) {
  return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown";
}

function initials(u: MemberUser) {
  const name = displayName(u);
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function fmtJoin(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function HubMembersClient({ hubSlug, members: initialMembers, isCoordinator, currentUserId }: Props) {
  const [members, setMembers] = useState<HubMemberRow[]>(initialMembers);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; firstName: string | null; lastName: string | null; email: string | null }>>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  const coordinators = members.filter((m) => m.isCoordinator);
  const others = members.filter((m) => !m.isCoordinator);

  async function toggleCoordinator(memberId: string, current: boolean) {
    const res = await fetch(`/api/hub/${hubSlug}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCoordinator: !current }),
    });
    if (res.ok) {
      setMembers((prev) =>
        prev.map((m) => m.id === memberId ? { ...m, isCoordinator: !current } : m)
      );
    }
    setMenuOpen(null);
  }

  async function removeMember(memberId: string) {
    const res = await fetch(`/api/hub/${hubSlug}/members/${memberId}`, { method: "DELETE" });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
    setConfirmRemove(null);
    setMenuOpen(null);
  }

  async function searchUsers(query: string) {
    setSearchQuery(query);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const res = await fetch(`/api/hub/${hubSlug}/members/search?q=${encodeURIComponent(query.trim())}`);
    if (res.ok) setSearchResults(await res.json());
    setSearching(false);
  }

  async function addMember(userId: string) {
    setAdding(true);
    const res = await fetch(`/api/hub/${hubSlug}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      const newMember = await res.json();
      setMembers((prev) => [...prev, newMember]);
      setSearchQuery("");
      setSearchResults([]);
      setShowAddForm(false);
    }
    setAdding(false);
  }

  function renderMember(m: HubMemberRow, index: number) {
    const avClass = AV_CLASSES[index % AV_CLASSES.length];
    const isSelf = m.userId === currentUserId;
    const existingMemberIds = new Set(members.map((m) => m.userId));

    return (
      <div key={m.id} className="hub-mem-item">
        <div className={`hub-mem-av ${avClass}`}>{initials(m.user)}</div>
        <div className="hub-mem-item__info">
          <div className="hub-mem-item__name">
            {displayName(m.user)}
            {m.isCoordinator && <span className="coord-badge">Coordinator</span>}
          </div>
          {(m.user.title || m.position) && (
            <div className="hub-mem-item__role">{m.user.title || m.position}</div>
          )}
        </div>
        <div className="hub-mem-item__join">Joined {fmtJoin(m.createdAt)}</div>

        {/* Coordinator actions */}
        {isCoordinator && !isSelf && (
          <div className="hub-mem-item__menu-wrap">
            <button
              className="hub-mem-item__menu-btn"
              onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
            >
              ⋯
            </button>
            {menuOpen === m.id && (
              <div className="hub-mem-menu">
                <button onClick={() => toggleCoordinator(m.id, m.isCoordinator)}>
                  {m.isCoordinator ? "Remove coordinator" : "Make coordinator"}
                </button>
                <button
                  className="hub-mem-menu__danger"
                  onClick={() => setConfirmRemove(m.id)}
                >
                  Remove from hub
                </button>
              </div>
            )}
            {confirmRemove === m.id && (
              <div className="hub-mem-confirm">
                <p>Remove {displayName(m.user)} from this hub?</p>
                <div className="hub-mem-confirm__actions">
                  <button className="btn--ghost" onClick={() => setConfirmRemove(null)}>Cancel</button>
                  <button className="hub-action-btn hub-action-btn--del" onClick={() => removeMember(m.id)}>Remove</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (members.length === 0 && !isCoordinator) {
    return <p className="hub-empty">No members yet.</p>;
  }

  const existingUserIds = new Set(members.map((m) => m.userId));

  return (
    <div className="hub-mem-container">

      {/* Toolbar */}
      {isCoordinator && (
        <div className="hub-mem-toolbar">
          <button className="btn btn--sm" onClick={() => setShowAddForm((v) => !v)}>
            + Add Member
          </button>
        </div>
      )}

      {/* Add member form */}
      {showAddForm && (
        <div className="hub-mem-add-form">
          <input
            className="fi"
            type="text"
            value={searchQuery}
            onChange={(e) => searchUsers(e.target.value)}
            placeholder="Search by name or email…"
            autoFocus
          />
          {searching && <p className="hub-mem-add-form__hint">Searching…</p>}
          {searchResults.length > 0 && (
            <div className="hub-mem-search-results">
              {searchResults.filter((u) => !existingUserIds.has(u.id)).map((u) => (
                <button
                  key={u.id}
                  className="hub-mem-search-result"
                  onClick={() => addMember(u.id)}
                  disabled={adding}
                >
                  {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email}
                  {u.email && <span className="hub-mem-search-result__email">{u.email}</span>}
                </button>
              ))}
            </div>
          )}
          {searchQuery.length >= 2 && !searching && searchResults.filter((u) => !existingUserIds.has(u.id)).length === 0 && (
            <p className="hub-mem-add-form__hint">No matching users found.</p>
          )}
        </div>
      )}

      {/* Member list */}
      {coordinators.length > 0 && (
        <div className="hub-mem-section">
          <div className="hub-mem-section__label">Coordinators</div>
          <div className="hub-mem-list">
            {coordinators.map((m, i) => renderMember(m, i))}
          </div>
        </div>
      )}
      {others.length > 0 && (
        <div className="hub-mem-section">
          {coordinators.length > 0 && <div className="hub-mem-section__label">Members</div>}
          <div className="hub-mem-list">
            {others.map((m, i) => renderMember(m, i + coordinators.length))}
          </div>
        </div>
      )}
      {members.length === 0 && (
        <p className="hub-empty">No members yet. Use the button above to add members.</p>
      )}
    </div>
  );
}
