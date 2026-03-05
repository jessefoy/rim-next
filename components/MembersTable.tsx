"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface SerializedMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  roles: string[];
  archivedAt: string | null;
  createdAt: string;
  _count: { registrations: number };
}

type RoleFilter = "ALL" | "ADMIN" | "REGISTRAR" | "NOROLES";

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "adm-badge--admin",
  REGISTRAR: "adm-badge--registrar",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  REGISTRAR: "Registrar",
};

interface Props {
  members: SerializedMember[];
}

export default function MembersTable({ members }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [showArchived, setShowArchived] = useState(false);

  const filtered = members.filter((m) => {
    // Archived filter — by default only show active members
    if (!showArchived && m.archivedAt) return false;
    if (showArchived && !m.archivedAt) return false;

    if (roleFilter === "NOROLES" && m.roles.length > 0) return false;
    if (roleFilter !== "ALL" && roleFilter !== "NOROLES" && !m.roles.includes(roleFilter)) return false;

    if (search) {
      const q = search.toLowerCase();
      const name = `${m.firstName ?? ""} ${m.lastName ?? ""}`.toLowerCase();
      const email = m.email.toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });

  const archivedCount = members.filter((m) => m.archivedAt).length;

  const displayName = (m: SerializedMember) => {
    if (m.firstName || m.lastName) return `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim();
    return "—";
  };

  const joinedDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div>
      {/* Search + filter bar */}
      <div className="adm-search">
        <input
          type="search"
          className="adm-search__input"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
        <select
          className="adm-search__filter"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
        >
          <option value="ALL">All members</option>
          <option value="ADMIN">Admins</option>
          <option value="REGISTRAR">Registrars</option>
          <option value="NOROLES">No roles</option>
        </select>
        <span className="adm-search__count">
          {filtered.length} {filtered.length === 1 ? "member" : "members"}
        </span>
        {archivedCount > 0 && (
          <button
            className="adm-toggle-btn"
            onClick={() => setShowArchived((a) => !a)}
          >
            {showArchived ? "Show Active" : `Show Archived (${archivedCount})`}
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="adm-empty">No members match your search.</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th className="adm-table__col--roles">Roles</th>
                <th className="adm-table__col--num">Registrations</th>
                <th className="adm-table__col--date">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr
                  key={m.id}
                  className={`adm-table__row${m.archivedAt ? " adm-member-row--archived" : ""}`}
                  onClick={() => router.push(`/admin/members/${m.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && router.push(`/admin/members/${m.id}`)}
                >
                  <td className="adm-table__name">
                    {displayName(m)}
                    {m.archivedAt && <span className="adm-badge--archived">Archived</span>}
                  </td>
                  <td className="adm-table__email">{m.email}</td>
                  <td className="adm-table__col--roles">
                    {m.roles.length === 0 ? (
                      <span className="adm-badge adm-badge--none">—</span>
                    ) : (
                      m.roles.map((r) => (
                        <span key={r} className={`adm-badge ${ROLE_COLORS[r] ?? "adm-badge--other"}`}>
                          {ROLE_LABELS[r] ?? r}
                        </span>
                      ))
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
    </div>
  );
}
