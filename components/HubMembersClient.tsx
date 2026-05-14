"use client";

/**
 * HubMembersClient — Members tab for all hubs.
 * CSS prefix: hub-mem-
 *
 * Coordinators can edit team state (status, hosting capability, communications,
 * pause note, coordinator note, position, isCoordinator). Admins can hard-remove
 * a member. Non-coordinator viewers see a read-only roster.
 *
 * Hub-membership authority (Phase 3): this tab is the control surface for
 * team state that is independent of system roles.
 */

import { useState } from "react";

type HubMemberStatus = "ACTIVE" | "PAUSED" | "INACTIVE";

interface MemberUser {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  title: string | null;
  email: string | null;
  avatarUrl?: string | null;
}

interface HubMemberRow {
  id: string;
  userId: string;
  isCoordinator: boolean;
  position: string | null;
  status: HubMemberStatus;
  hostingCapability: boolean;
  communicationsEnabled: boolean;
  pausedAt: string | null;
  pausedById: string | null;
  pauseNote: string | null;
  coordinatorNote: string | null;
  joinedAt: string;
  user: MemberUser;
}

interface UpcomingAssignment {
  id: string;
  programSlug: string;
  sessionDate: string | null;
}

interface Props {
  hubSlug: string;
  /** True when hub.hasSchedule — drives hosting-capability UI affordances. */
  hasSchedule: boolean;
  members: HubMemberRow[];
  isCoordinator: boolean;
  isAdmin: boolean;
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

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function HubMembersClient({
  hubSlug,
  hasSchedule,
  members: initialMembers,
  isCoordinator,
  isAdmin,
  currentUserId,
}: Props) {
  const [members, setMembers] = useState<HubMemberRow[]>(initialMembers);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [confirmHardRemove, setConfirmHardRemove] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; firstName: string | null; lastName: string | null; preferredName: string | null; email: string | null }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  // Destructive-action confirmation state
  const [confirmDialog, setConfirmDialog] = useState<null | {
    userId: string;
    memberName: string;
    upcoming: UpcomingAssignment[];
    pendingPayload: Record<string, unknown>;
  }>(null);

  const isHostingHub = hasSchedule;
  const canEdit = isCoordinator;

  async function patchMember(
    userId: string,
    payload: Record<string, unknown>,
    force = false,
    releaseAssignments = false
  ): Promise<{ ok: boolean; confirmed?: boolean }> {
    const res = await fetch(`/api/hub/${hubSlug}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, force, releaseAssignments }),
    });
    if (res.status === 409) {
      const j = await res.json().catch(() => ({}));
      if (j?.requiresConfirmation) {
        const row = members.find((m) => m.userId === userId);
        setConfirmDialog({
          userId,
          memberName: row ? displayName(row.user) : "this member",
          upcoming: j.upcomingAssignments ?? [],
          pendingPayload: payload,
        });
        return { ok: false, confirmed: false };
      }
    }
    if (res.ok) {
      const updated: HubMemberRow = { ...(await res.json()), user: members.find((m) => m.userId === userId)!.user };
      setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, ...updated } : m)));
      return { ok: true };
    }
    return { ok: false };
  }

  async function confirmProceed(releaseAssignments: boolean) {
    if (!confirmDialog) return;
    const { userId, pendingPayload } = confirmDialog;
    await patchMember(userId, pendingPayload, true, releaseAssignments);
    setConfirmDialog(null);
  }

  async function hardRemove(userId: string) {
    const res = await fetch(`/api/hub/${hubSlug}/members/${userId}`, { method: "DELETE" });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    }
    setConfirmHardRemove(null);
  }

  async function searchUsers(query: string) {
    setSearchQuery(query);
    if (query.trim().length < 3) { setSearchResults([]); return; }
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
    const isEditing = editingUserId === m.userId;
    const isPaused = m.status === "PAUSED";
    const isInactive = m.status === "INACTIVE";
    const statusClass = isInactive ? "hub-mem-status--inactive" : isPaused ? "hub-mem-status--paused" : "";

    return (
      <div key={m.id} className={`hub-mem-item ${statusClass}`}>
        {m.user.avatarUrl ? (
          <img src={m.user.avatarUrl} alt="" className="hub-mem-av hub-mem-av--img" />
        ) : (
          <div className={`hub-mem-av ${avClass}`}>{initials(m.user)}</div>
        )}
        <div className="hub-mem-item__info">
          <div className="hub-mem-item__name">
            {displayName(m.user)}
            {m.isCoordinator && <span className="coord-badge">Coordinator</span>}
            {isPaused && <span className="hub-mem-badge hub-mem-badge--paused">Paused</span>}
            {isInactive && <span className="hub-mem-badge hub-mem-badge--inactive">Inactive</span>}
          </div>
          {(m.user.title || m.position) && (
            <div className="hub-mem-item__role">{m.position || m.user.title}</div>
          )}
          {isHostingHub && !m.hostingCapability && m.status === "ACTIVE" && (
            <div className="hub-mem-item__flag">Hosting restricted</div>
          )}
          {!m.communicationsEnabled && (
            <div className="hub-mem-item__flag">Notifications off</div>
          )}
          {m.pauseNote && isPaused && (
            <div className="hub-mem-item__note">“{m.pauseNote}”</div>
          )}
        </div>
        <div className="hub-mem-item__join">Joined {fmtJoin(m.joinedAt)}</div>

        {canEdit && (
          <div className="hub-mem-item__actions">
            <button
              className="hub-mem-item__edit-btn"
              onClick={() => setEditingUserId(isEditing ? null : m.userId)}
            >
              {isEditing ? "Done" : "Edit"}
            </button>
          </div>
        )}

        {canEdit && isEditing && (
          <MemberEditor
            member={m}
            isHostingHub={isHostingHub}
            isSelf={isSelf}
            isAdmin={isAdmin}
            onSave={(payload) => patchMember(m.userId, payload)}
            onHardRemoveRequest={() => setConfirmHardRemove(m.userId)}
          />
        )}

        {confirmHardRemove === m.userId && (
          <div className="hub-mem-confirm">
            <p>Permanently remove {displayName(m.user)} from this hub? Their coordinator-owned state (pause notes, capability flags) will be lost.</p>
            <div className="hub-mem-confirm__actions">
              <button className="btn--ghost" onClick={() => setConfirmHardRemove(null)}>Cancel</button>
              <button className="hub-action-btn hub-action-btn--del" onClick={() => hardRemove(m.userId)}>Remove</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const coordinators = members.filter((m) => m.isCoordinator);
  const activeOthers = members.filter((m) => !m.isCoordinator && m.status === "ACTIVE");
  const pausedOthers = members.filter((m) => !m.isCoordinator && m.status === "PAUSED");
  const inactiveOthers = members.filter((m) => !m.isCoordinator && m.status === "INACTIVE");

  const existingUserIds = new Set(members.map((m) => m.userId));

  return (
    <div className="hub-mem-container">

      <div className="hub-section-header">
        <h2 className="hub-page__title">Members</h2>
        {canEdit && (
          <div className="hub-page__actions">
            <button className="btn btn--sm" onClick={() => setShowAddForm((v) => !v)}>
              + Add Member
            </button>
          </div>
        )}
      </div>

      {showAddForm && canEdit && (
        <div className="hub-mem-add-form">
          <input
            className="fi"
            type="text"
            value={searchQuery}
            onChange={(e) => searchUsers(e.target.value)}
            placeholder="Search by name or email (min 3 chars)…"
            autoFocus
          />
          {searchQuery.length > 0 && searchQuery.length < 3 && (
            <p className="hub-mem-add-form__hint">Type at least 3 characters to search.</p>
          )}
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
                  {u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email}
                  {u.email && <span className="hub-mem-search-result__email">{u.email}</span>}
                </button>
              ))}
            </div>
          )}
          {searchQuery.length >= 3 && !searching && searchResults.filter((u) => !existingUserIds.has(u.id)).length === 0 && (
            <p className="hub-mem-add-form__hint">No matching active members found.</p>
          )}
        </div>
      )}

      {coordinators.length > 0 && (
        <div className="hub-mem-section">
          <div className="hub-mem-section__label">Coordinators</div>
          <div className="hub-mem-list">
            {coordinators.map((m, i) => renderMember(m, i))}
          </div>
        </div>
      )}
      {activeOthers.length > 0 && (
        <div className="hub-mem-section">
          {coordinators.length > 0 && <div className="hub-mem-section__label">Members</div>}
          <div className="hub-mem-list">
            {activeOthers.map((m, i) => renderMember(m, i + coordinators.length))}
          </div>
        </div>
      )}
      {pausedOthers.length > 0 && (
        <div className="hub-mem-section">
          <div className="hub-mem-section__label">Paused</div>
          <div className="hub-mem-list">
            {pausedOthers.map((m, i) => renderMember(m, i + coordinators.length + activeOthers.length))}
          </div>
        </div>
      )}
      {inactiveOthers.length > 0 && (
        <div className="hub-mem-section">
          <div className="hub-mem-section__label">Inactive</div>
          <div className="hub-mem-list">
            {inactiveOthers.map((m, i) =>
              renderMember(m, i + coordinators.length + activeOthers.length + pausedOthers.length)
            )}
          </div>
        </div>
      )}
      {members.length === 0 && (
        <p className="hub-empty">
          {canEdit ? "No members yet. Use the button above to add members." : "No members yet."}
        </p>
      )}

      {confirmDialog && (
        <div className="hub-mem-dialog">
          <div className="hub-mem-dialog__panel">
            <h3>Revoke hosting for {confirmDialog.memberName}?</h3>
            <p className="hub-mem-dialog__lede">
              This member has {confirmDialog.upcoming.length} upcoming host assignment{confirmDialog.upcoming.length === 1 ? "" : "s"}. Pausing or restricting hosting will prevent them from joining those sessions as host.
            </p>
            <ul className="hub-mem-dialog__list">
              {confirmDialog.upcoming.slice(0, 10).map((a) => (
                <li key={a.id}>
                  <strong>{a.programSlug}</strong>{a.sessionDate ? ` — ${fmtDate(a.sessionDate)}` : ""}
                </li>
              ))}
              {confirmDialog.upcoming.length > 10 && (
                <li>…and {confirmDialog.upcoming.length - 10} more.</li>
              )}
            </ul>
            <div className="hub-mem-dialog__actions">
              <button className="btn--ghost" onClick={() => setConfirmDialog(null)}>Cancel</button>
              <button className="btn btn--sm" onClick={() => confirmProceed(false)}>
                Proceed (keep assignments)
              </button>
              <button className="hub-action-btn hub-action-btn--del" onClick={() => confirmProceed(true)}>
                Proceed and release assignments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberEditor({
  member,
  isHostingHub,
  isSelf,
  isAdmin,
  onSave,
  onHardRemoveRequest,
}: {
  member: HubMemberRow;
  isHostingHub: boolean;
  isSelf: boolean;
  isAdmin: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<{ ok: boolean; confirmed?: boolean }>;
  onHardRemoveRequest: () => void;
}) {
  const [position, setPosition] = useState(member.position ?? "");
  const [coord, setCoord] = useState(member.isCoordinator);
  const [status, setStatus] = useState<HubMemberStatus>(member.status);
  const [hostingCapability, setHostingCapability] = useState(member.hostingCapability);
  const [communicationsEnabled, setCommunicationsEnabled] = useState(member.communicationsEnabled);
  const [pauseNote, setPauseNote] = useState(member.pauseNote ?? "");
  const [coordinatorNote, setCoordinatorNote] = useState(member.coordinatorNote ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSave({
      position,
      isCoordinator: coord,
      status,
      hostingCapability,
      communicationsEnabled,
      pauseNote,
      coordinatorNote,
    });
    setSaving(false);
  }

  return (
    <div className="hub-mem-editor">
      <div className="hub-mem-editor__grid">
        <label className="hub-mem-editor__field">
          <span>Position</span>
          <input className="fi" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Virtual Host" />
        </label>
        <label className="hub-mem-editor__field">
          <span>Status</span>
          <select className="fi" value={status} onChange={(e) => setStatus(e.target.value as HubMemberStatus)} disabled={isSelf}>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>
        <label className="hub-mem-editor__check">
          <input type="checkbox" checked={coord} onChange={(e) => setCoord(e.target.checked)} disabled={isSelf} />
          <span>Coordinator</span>
        </label>
        {isHostingHub && (
          <label className="hub-mem-editor__check">
            <input
              type="checkbox"
              checked={hostingCapability}
              onChange={(e) => setHostingCapability(e.target.checked)}
            />
            <span>Can host sessions</span>
          </label>
        )}
        <label className="hub-mem-editor__check">
          <input
            type="checkbox"
            checked={communicationsEnabled}
            onChange={(e) => setCommunicationsEnabled(e.target.checked)}
          />
          <span>Receives hub notifications</span>
        </label>
      </div>
      <label className="hub-mem-editor__field">
        <span>Pause note (shown on member row when Paused)</span>
        <input
          className="fi"
          value={pauseNote}
          onChange={(e) => setPauseNote(e.target.value)}
          placeholder="e.g. On leave until June"
        />
      </label>
      <label className="hub-mem-editor__field">
        <span>Coordinator note (private)</span>
        <textarea
          className="fi"
          value={coordinatorNote}
          onChange={(e) => setCoordinatorNote(e.target.value)}
          rows={2}
        />
      </label>
      <div className="hub-mem-editor__actions">
        <button className="btn btn--sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        {isAdmin && !isSelf && (
          <button className="hub-action-btn hub-action-btn--del" onClick={onHardRemoveRequest}>
            Hard-remove from hub
          </button>
        )}
      </div>
    </div>
  );
}
