"use client";

/**
 * HubMembersClient — Members tab for generic hubs.
 * CSS prefix: mem-
 *
 * Member list with colored initials avatar, name, position, coordinator badge, join date.
 * Avatar colors rotate through av--a/b/c/d by index.
 */

interface MemberUser {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
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
  members: HubMemberRow[];
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

export default function HubMembersClient({ members }: Props) {
  const coordinators = members.filter((m) => m.isCoordinator);
  const others       = members.filter((m) => !m.isCoordinator);

  function renderMember(m: HubMemberRow, index: number) {
    const avClass = AV_CLASSES[index % AV_CLASSES.length];
    return (
      <div key={m.id} className="mem-item">
        <div className={`mem-av ${avClass}`}>{initials(m.user)}</div>
        <div className="mem-item__info">
          <div className="mem-item__name">
            {displayName(m.user)}
            {m.isCoordinator && <span className="coord-badge">Coordinator</span>}
          </div>
          {m.position && <div className="mem-item__role">{m.position}</div>}
        </div>
        <div className="mem-item__join">Joined {fmtJoin(m.createdAt)}</div>
      </div>
    );
  }

  if (members.length === 0) {
    return <p className="hub-empty">No members yet.</p>;
  }

  return (
    <div style={{ maxWidth: 680 }}>
      {coordinators.length > 0 && (
        <div className="mem-section">
          <div className="mem-section__label">Coordinators</div>
          <div className="mem-list">
            {coordinators.map((m, i) => renderMember(m, i))}
          </div>
        </div>
      )}
      {others.length > 0 && (
        <div className="mem-section">
          {coordinators.length > 0 && <div className="mem-section__label">Members</div>}
          <div className="mem-list">
            {others.map((m, i) => renderMember(m, i + coordinators.length))}
          </div>
        </div>
      )}
    </div>
  );
}
