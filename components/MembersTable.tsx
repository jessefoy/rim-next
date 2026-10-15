"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, shownRoles } from "@/lib/roleLabels";

export interface SerializedMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  phone: string | null;
  roles: string[];
  memberStatus: string;
  tags: string[];
  archivedAt: string | null;
  createdAt: string;
  isLegacyUnclaimed: boolean;
  /** Teams (active hubs) this person is on; coordinators first, then by name. */
  teams: MemberTeam[];
  /** Another account may be the same person (lib/memberDuplicates.ts). */
  possibleDuplicate: boolean;
  _count: { registrations: number };
}

export interface MemberTeam {
  slug: string;
  name: string;
  isCoordinator: boolean;
  status: string;
}

type RoleFilter = "ALL" | "ADMIN" | "REGISTRAR" | "TEACHER" | "HOST_MANAGER" | "GUIDING_TEACHER" | "NOROLES";
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "VISITOR" | "STUDENT" | "VOLUNTEER" | "DUPLICATE";
type SortField = "firstName" | "lastName" | "createdAt" | "registrations";
type SortDir = "asc" | "desc";

// Teams named in a row before the rest are summed up; the profile lists them all.
const TEAMS_SHOWN = 3;

const teamLabel = (t: MemberTeam) => {
  const notes = [
    t.isCoordinator ? "coordinator" : null,
    t.status === "PAUSED" ? "paused" : t.status === "INACTIVE" ? "inactive" : null,
  ].filter(Boolean);
  return notes.length ? `${t.name} (${notes.join(", ")})` : t.name;
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  VISITOR: "Visitor",
  STUDENT: "Student",
  VOLUNTEER: "Volunteer",
};

interface Props {
  members: SerializedMember[];
  teams: { slug: string; name: string }[];
  showLegacyPool: boolean;
  legacyCount: number;
}

function sortMembers(members: SerializedMember[], field: SortField, dir: SortDir) {
  return [...members].sort((a, b) => {
    let aVal: string | number = "";
    let bVal: string | number = "";

    if (field === "firstName") {
      aVal = (a.firstName ?? "").toLowerCase();
      bVal = (b.firstName ?? "").toLowerCase();
    } else if (field === "lastName") {
      aVal = (a.lastName ?? "").toLowerCase();
      bVal = (b.lastName ?? "").toLowerCase();
    } else if (field === "createdAt") {
      aVal = a.createdAt;
      bVal = b.createdAt;
    } else if (field === "registrations") {
      aVal = a._count.registrations;
      bVal = b._count.registrations;
    }

    if (aVal < bVal) return dir === "asc" ? -1 : 1;
    if (aVal > bVal) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

export default function MembersTable({ members, teams, showLegacyPool, legacyCount }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  // "ALL", "ANY" (on a team), "NONE" (on no team), or a team's slug.
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [showArchived, setShowArchived] = useState(false);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Add-member modal. Creates a staged account, then lands on the new member's
  // profile to assign role + schedule. No email fires (see lib/email.ts gate).
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const openAdd = () => {
    setAddForm({ firstName: "", lastName: "", email: "", phone: "" });
    setAddError(null);
    setShowAdd(true);
  };

  const handleAddSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (adding) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddError(data?.error ?? "Couldn't create the member. Please try again.");
        setAdding(false);
        return;
      }
      // Land on the new member's profile to assign their role + schedule.
      router.push(`/admin/members/${data.id}`);
    } catch {
      setAddError("Couldn't create the member. Please try again.");
      setAdding(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortState = (field: SortField) =>
    sortField !== field ? "" : sortDir === "asc" ? ", sorted A to Z" : ", sorted Z to A";

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return <span className="adm-table__sort-dir adm-table__sort-dir--inactive">↕</span>;
    return <span className="adm-table__sort-dir">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const filtered = members.filter((m) => {
    if (!showArchived && m.archivedAt) return false;
    if (showArchived && !m.archivedAt) return false;

    if (roleFilter === "NOROLES" && shownRoles(m.roles).length > 0) return false;
    if (roleFilter !== "ALL" && roleFilter !== "NOROLES" && !m.roles.includes(roleFilter)) return false;

    if (teamFilter === "ANY" && m.teams.length === 0) return false;
    if (teamFilter === "NONE" && m.teams.length > 0) return false;
    if (teamFilter !== "ALL" && teamFilter !== "ANY" && teamFilter !== "NONE" && !m.teams.some((t) => t.slug === teamFilter)) return false;

    if (statusFilter === "DUPLICATE") {
      if (!m.possibleDuplicate) return false;
    } else if (statusFilter !== "ALL" && m.memberStatus !== statusFilter) return false;

    if (search) {
      const q = search.toLowerCase();
      const name = `${m.firstName ?? ""} ${m.lastName ?? ""} ${m.preferredName ?? ""}`.toLowerCase();
      const email = m.email.toLowerCase();
      const tags = m.tags.join(" ").toLowerCase();
      const teamNames = m.teams.map((t) => t.name).join(" ").toLowerCase();
      if (!name.includes(q) && !email.includes(q) && !tags.includes(q) && !teamNames.includes(q)) return false;
    }
    return true;
  });

  const sorted = sortMembers(filtered, sortField, sortDir);
  const archivedCount = members.filter((m) => m.archivedAt).length;

  // A row says a person's state only when it isn't the usual one (an active,
  // claimed member), so the exceptions stand out instead of every row
  // repeating "Active".
  const memberState = (m: SerializedMember) => {
    const notes = [
      m.archivedAt
        ? "Archived"
        : m.isLegacyUnclaimed && !showLegacyPool
          ? "Unclaimed"
          : m.memberStatus !== "ACTIVE"
            ? STATUS_LABELS[m.memberStatus] ?? m.memberStatus
            : null,
      m.possibleDuplicate ? "Possible second account" : null,
    ].filter(Boolean);
    return notes.length ? notes.join(" · ") : null;
  };

  const joinedDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div>
      {/* Toolbar */}
      <div className="adm-toolbar">
        <input
          type="search"
          className="adm-search__input"
          placeholder="Search by name, email, team, or tag…"
          aria-label="Search members"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
        <select
          className="adm-search__filter"
          aria-label="Role"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
        >
          <option value="ALL">All roles</option>
          <option value="ADMIN">Admins</option>
          <option value="GUIDING_TEACHER">Guiding teachers</option>
          <option value="REGISTRAR">Registrars</option>
          <option value="TEACHER">Teachers</option>
          <option value="HOST_MANAGER">Scheduling managers</option>
          <option value="NOROLES">No roles</option>
        </select>
        <select
          className="adm-search__filter"
          aria-label="Team"
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
        >
          <option value="ALL">All teams</option>
          <option value="ANY">On a team</option>
          <option value="NONE">Not on a team</option>
          {teams.map((t) => (
            <option key={t.slug} value={t.slug}>{t.name}</option>
          ))}
        </select>
        <select
          className="adm-search__filter"
          aria-label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="VISITOR">Visitor</option>
          <option value="STUDENT">Student</option>
          <option value="VOLUNTEER">Volunteer</option>
          <option value="INACTIVE">Inactive</option>
          <option value="DUPLICATE">Possible second account</option>
        </select>
        <div className="adm-toolbar__right">
          <button type="button" className="adm-add-btn" onClick={openAdd}>
            + Add member
          </button>
          <span className="adm-search__count">
            {sorted.length} {sorted.length === 1 ? "member" : "members"}
          </span>
          {archivedCount > 0 && (
            <button
              className="adm-toggle-btn"
              onClick={() => setShowArchived((a) => !a)}
            >
              {showArchived ? "Show Active" : `Archived (${archivedCount})`}
            </button>
          )}
          {showLegacyPool ? (
            <button
              type="button"
              className="adm-toggle-btn"
              onClick={() => router.push("/admin/members")}
            >
              ← Back to members
            </button>
          ) : (
            legacyCount > 0 && (
              <button
                type="button"
                className="adm-toggle-btn"
                onClick={() => router.push("/admin/members?pool=legacy")}
              >
                Legacy pool ({legacyCount})
              </button>
            )
          )}
        </div>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <p className="adm-empty">No members match your search.</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>
                  {/* One Name column, sortable by first or last name. The
                      hidden words carry the column's name and the sort state
                      to screen readers; the arrows are visual. */}
                  <span className="rim-sr-only">Name. </span>
                  <span className="adm-table__sort-pair">
                    <button className="adm-table__sort-btn" onClick={() => handleSort("firstName")}>
                      First<span className="rim-sr-only"> name{sortState("firstName")}</span>
                      <span aria-hidden="true">{sortIndicator("firstName")}</span>
                    </button>
                    <span className="adm-table__sort-sep" aria-hidden="true">/</span>
                    <button className="adm-table__sort-btn" onClick={() => handleSort("lastName")}>
                      Last<span className="rim-sr-only"> name{sortState("lastName")}</span>
                      <span aria-hidden="true">{sortIndicator("lastName")}</span>
                    </button>
                  </span>
                </th>
                <th className="adm-table__col--teams">Teams</th>
                <th className="adm-table__col--roles">Roles</th>
                <th className="adm-table__col--num">
                  <button className="adm-table__sort-btn adm-table__sort-btn--center" onClick={() => handleSort("registrations")}>
                    Regs {sortIndicator("registrations")}
                  </button>
                </th>
                <th className="adm-table__col--date">
                  <button className="adm-table__sort-btn" onClick={() => handleSort("createdAt")}>
                    Joined {sortIndicator("createdAt")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr
                  key={m.id}
                  className={`adm-table__row${m.archivedAt ? " adm-member-row--archived" : ""}`}
                  onClick={() => router.push(`/admin/members/${m.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && router.push(`/admin/members/${m.id}`)}
                >
                  <td className="adm-table__name">
                    {(sortField === "lastName"
                      ? [m.lastName, m.firstName].filter(Boolean).join(", ")
                      : [m.firstName, m.lastName].filter(Boolean).join(" ")) || "—"}
                    {m.preferredName && m.preferredName !== m.firstName && (
                      <span className="adm-table__preferred"> ({m.preferredName})</span>
                    )}
                    {/* The email sits under the name, as in a directory, so the
                        table fits its frame (an address alone was ~270px). */}
                    <span className="adm-member-email">
                      {/* May wrap after the @, never mid-word. */}
                      {m.email.split("@")[0]}@<wbr />{m.email.split("@").slice(1).join("@")}
                    </span>
                    {memberState(m) && <span className="adm-member-state">{memberState(m)}</span>}
                  </td>
                  <td className="adm-table__col--teams">
                    {m.teams.length > 0 && (
                      <span className="adm-member-teams">
                        {m.teams.slice(0, TEAMS_SHOWN).map(teamLabel).join(", ")}
                        {m.teams.length > TEAMS_SHOWN && (
                          <span className="adm-member-teams__more">
                            {" "}and {m.teams.length - TEAMS_SHOWN} more
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="adm-table__col--roles">
                    {shownRoles(m.roles).length > 0 && (
                      <span className="adm-member-roles">
                        {shownRoles(m.roles).map((r) => (
                          <span key={r} className="adm-member-role">{ROLE_LABELS[r]}</span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="adm-table__col--num">{m._count.registrations}</td>
                  <td className="adm-table__col--date">{joinedDate(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="adm-modal-backdrop" onClick={() => !adding && setShowAdd(false)}>
          <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="adm-modal__title">Add a member</h2>
            <p className="adm-modal__hint">
              Creates the account now. No email is sent — they cross the usual
              sign-up threshold (agreements + sign-in) when they first log in,
              and their name updates to whatever they enter. You&rsquo;ll land on
              their profile next to assign a role.
            </p>
            <form className="adm-form" onSubmit={handleAddSubmit}>
              <div className="adm-form__row">
                <div className="adm-form__field">
                  <label className="adm-form__label" htmlFor="add-firstName">First name</label>
                  <input
                    id="add-firstName"
                    className="adm-form__input"
                    value={addForm.firstName}
                    onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))}
                    autoComplete="off"
                    autoFocus
                    required
                  />
                </div>
                <div className="adm-form__field">
                  <label className="adm-form__label" htmlFor="add-lastName">Last name</label>
                  <input
                    id="add-lastName"
                    className="adm-form__input"
                    value={addForm.lastName}
                    onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))}
                    autoComplete="off"
                    required
                  />
                </div>
              </div>
              <div className="adm-form__field">
                <label className="adm-form__label" htmlFor="add-email">Email</label>
                <input
                  id="add-email"
                  type="email"
                  className="adm-form__input"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  autoComplete="off"
                  required
                />
              </div>
              <div className="adm-form__field">
                <label className="adm-form__label" htmlFor="add-phone">Phone (optional)</label>
                <input
                  id="add-phone"
                  type="tel"
                  className="adm-form__input"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  autoComplete="off"
                />
              </div>
              {addError && <p className="adm-modal__error">{addError}</p>}
              <div className="adm-modal__actions">
                <button
                  type="button"
                  className="adm-btn--cancel"
                  onClick={() => setShowAdd(false)}
                  disabled={adding}
                >
                  Cancel
                </button>
                <button type="submit" className="adm-add-btn" disabled={adding}>
                  {adding ? "Creating…" : "Create member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
