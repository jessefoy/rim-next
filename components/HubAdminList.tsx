"use client";

/**
 * HubAdminList — table of all hubs for the /admin/hubs page.
 * CSS prefix: adm-hubs-
 */

import { useState } from "react";
import Link from "next/link";

interface HubRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  _count: { members: number };
}

interface Props {
  hubs: HubRow[];
  showCreated?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  OPERATIONAL: "Operational",
  GOVERNANCE: "Governance",
  COMMUNITY_GROUP: "Community Group",
};

export default function HubAdminList({ hubs: initial, showCreated }: Props) {
  const [hubs, setHubs] = useState(initial);
  const [toggling, setToggling] = useState<string | null>(null);

  async function toggleStatus(hub: HubRow) {
    setToggling(hub.id);
    const newStatus = hub.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
    try {
      const res = await fetch(`/api/admin/hubs/${hub.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setHubs((prev) =>
          prev.map((h) => (h.id === hub.id ? { ...h, status: newStatus } : h)),
        );
      }
    } finally {
      setToggling(null);
    }
  }

  const active = hubs.filter((h) => h.status === "ACTIVE");
  const archived = hubs.filter((h) => h.status !== "ACTIVE");

  function renderRow(hub: HubRow) {
    const isArchived = hub.status !== "ACTIVE";
    return (
      <tr key={hub.id} className={isArchived ? "adm-hubs-row--archived" : ""}>
        <td>
          <Link href={`/admin/hubs/${hub.slug}/edit`} className="adm-hubs-name-link">
            {hub.name}
          </Link>
        </td>
        <td className="adm-hubs-slug">{hub.slug}</td>
        <td>{TYPE_LABELS[hub.type] ?? hub.type}</td>
        <td>
          <span className={`adm-hubs-status adm-hubs-status--${hub.status.toLowerCase()}`}>
            {hub.status === "ACTIVE" ? "Active" : "Archived"}
          </span>
        </td>
        <td className="adm-hubs-count">{hub._count.members}</td>
        <td>
          <div className="adm-hubs-row-actions">
            <Link href={`/admin/hubs/${hub.slug}/edit`} className="adm-hubs-btn-edit">
              Edit
            </Link>
            <button
              className="adm-hubs-btn-toggle"
              onClick={() => toggleStatus(hub)}
              disabled={toggling === hub.id}
            >
              {toggling === hub.id ? "..." : isArchived ? "Unarchive" : "Archive"}
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      {showCreated && <div className="adm-hubs-success">Hub created successfully.</div>}

      <div className="adm-hubs-table-wrap">
        <table className="adm-hubs-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Type</th>
              <th>Status</th>
              <th>Members</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {active.map(renderRow)}
            {archived.length > 0 && (
              <>
                {active.length > 0 && (
                  <tr className="adm-hubs-divider-row">
                    <td colSpan={6} className="adm-hubs-divider-cell">Archived</td>
                  </tr>
                )}
                {archived.map(renderRow)}
              </>
            )}
          </tbody>
        </table>
      </div>

      {hubs.length === 0 && (
        <p className="adm-hubs-empty">No hubs found.</p>
      )}
    </>
  );
}
