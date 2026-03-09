"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  _count: { registrations: number };
}

type RoleFilter = "ALL" | "ADMIN" | "REGISTRAR" | "HOST" | "NOROLES";
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "VISITOR" | "STUDENT" | "VOLUNTEER";
type SortField = "firstName" | "lastName" | "email" | "createdAt" | "registrations";
type SortDir = "asc" | "desc";

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "adm-badge--admin",
  REGISTRAR: "adm-badge--registrar",
  HOST: "adm-badge--host",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  REGISTRAR: "Registrar",
  HOST: "Host",
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
    } else if (field === "email") {
      aVal = a.email.toLowerCase();
      bVal = b.email.toLowerCase();
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

export default function MembersTable({ members }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [showArchived, setShowArchived] = useState(false);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return <span className="adm-table__sort-dir adm-table__sort-dir--inactive">↕</span>;
    return <span className="adm-table__sort-dir">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const filtered = members.filter((m) => {
    if (!showArchived && m.archivedAt) return false;
    if (showArchived && !m.archivedAt) return false;

    if (roleFilter === "NOROLES" && m.roles.length > 0) return false;
    if (roleFilter !== "ALL" && roleFilter !== "NOROLES" && !m.roles.includes(roleFilter)) return false;

    if (statusFilter !== "ALL" && m.memberStatus !== statusFilter) return false;

    if (search) {
      const q = search.toLowerCase();
      const name = `${m.firstName ?? ""} ${m.lastName ?? ""} ${m.preferredName ?? ""}`.toLowerCase();
      const email = m.email.toLowerCase();
      const tags = m.tags.join(" ").toLowerCase();
      if (!name.includes(q) && !email.includes(q) && !tags.includes(q)) return false;
    }
    return true;
  });

  const sorted = sortMembers(filtered, sortField, sortDir);
  const archivedCount = members.filter((m) => m.archivedAt).length;

  const displayName = (m: SerializedMember) => {
    const full = `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim();
    if (!full) return "—";
    if (m.preferredName && m.preferredName !== m.firstName) {
      return `${full} (${m.preferredName})`;
    }
    return full;
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
          placeholder="Search by name, email, or tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
        <select
          className="adm-search__filter"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
        >
          <option value="ALL">All roles</option>
          <option value="ADMIN">Admins</option>
          <option value="REGISTRAR">Registrars</option>
          <option value="HOST">Hosts</option>
          <option value="NOROLES">No roles</option>
        </select>
        <select
          className="adm-search__filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="VISITOR">Visitor</option>
          <option value="STUDENT">Student</option>
          <option value="VOLUNTEER">Volunteer</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <div className="adm-toolbar__right">
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
                  <button className="adm-table__sort-btn" onClick={() => handleSort("firstName")}>
                    First name {sortIndicator("firstName")}
                  </button>
                </th>
                <th>
                  <button className="adm-table__sort-btn" onClick={() => handleSort("lastName")}>
                    Last name {sortIndicator("lastName")}
                  </button>
                </th>
                <th>
                  <button className="adm-table__sort-btn" onClick={() => handleSort("email")}>
                    Email {sortIndicator("email")}
                  </button>
                </th>
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
                    {m.firstName ?? "—"}
                    {m.preferredName && m.preferredName !== m.firstName && (
                      <span className="adm-table__preferred"> ({m.preferredName})</span>
                    )}
                    {m.archivedAt && <span className="adm-badge--archived">Archived</span>}
                  </td>
                  <td>{m.lastName ?? "—"}</td>
                  <td className="adm-table__email">{m.email}</td>
                  <td className="adm-table__col--roles">
                    <span className={`adm-status adm-status--${m.memberStatus.toLowerCase()}`}>
                      {STATUS_LABELS[m.memberStatus] ?? m.memberStatus}
                    </span>
                    {m.roles.map((r) => (
                      <span key={r} className={`adm-badge ${ROLE_COLORS[r] ?? "adm-badge--other"}`}>
                        {ROLE_LABELS[r] ?? r}
                      </span>
                    ))}
                  </td>
                  <td className="adm-table__col--num">{m._count.registrations}</td>
                  <td className="adm-table__col--date">{joinedDate(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
