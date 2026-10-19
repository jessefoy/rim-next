"use client";

/**
 * HubAdminList — table of all hubs for the /admin/hubs page.
 * CSS prefix: adm-hubs-
 */

import { Fragment, useState } from "react";
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

const TYPE_LABELS: Record<string, string> = {
  OPERATIONAL: "Operational",
  GOVERNANCE: "Governance",
  COMMUNITY_GROUP: "Community Group",
};

export default function HubAdminList({ hubs: initial, showCreated }: Props) {
  const [hubs, setHubs] = useState(initial);
  const [toggling, setToggling] = useState<string | null>(null);
  const [provisioningAll, setProvisioningAll] = useState(false);
  const [provisionNote, setProvisionNote] = useState<string>("");

  // Backfill Files storage across every team in one click (finish-sequence
  // "auto-provision every existing hub"). Idempotent; Community is skipped
  // server-side (it rides the name-resolved Community Drive, not a folder).
  async function provisionAll() {
    setProvisioningAll(true);
    setProvisionNote("");
    try {
      const res = await fetch("/api/admin/hubs/provision-all", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProvisionNote(readableError(res.status, data.error, "Couldn't set up files. Please try again."));
      } else {
        const parts = [`${data.provisioned} set up`, `${data.already} already had files`];
        if (data.failedCount > 0) {
          parts.push(
            `${data.failedCount} failed (${data.failed.map((f: { name: string }) => f.name).join(", ")})`,
          );
        }
        setProvisionNote(`Done: ${parts.join(" · ")}.`);
      }
    } catch {
      setProvisionNote("Couldn't reach the server. Please try again.");
    } finally {
      setProvisioningAll(false);
    }
  }

  // Archiving a whole team is asked first, in the page; unarchiving is not
  // (it only brings the team back). The answer stays beside the row.
  const [confirming, setConfirming] = useState<{ id: string; warning?: string } | null>(null);
  const [rowError, setRowError] = useState<{ id: string; msg: string } | null>(null);

  async function toggleStatus(hub: HubRow, confirmCoverageClear = false) {
    setToggling(hub.id);
    setRowError(null);
    const newStatus = hub.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
    try {
      const res = await fetch(`/api/admin/hubs/${hub.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, ...(confirmCoverageClear && { confirmCoverageClear: true }) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.requiresConfirmation) {
        // The team still has people on its schedule: say what will be
        // cleared and ask once more.
        setConfirming({ id: hub.id, warning: data.error });
        return;
      }
      if (!res.ok) {
        setRowError({
          id: hub.id,
          msg: readableError(res.status, data.error, `${hub.name} couldn't be ${newStatus === "ARCHIVED" ? "archived" : "unarchived"}. Nothing changed. Please try again.`),
        });
        return;
      }
      setHubs((prev) =>
        prev.map((h) => (h.id === hub.id ? { ...h, status: newStatus } : h)),
      );
      setConfirming(null);
    } catch {
      setRowError({ id: hub.id, msg: "Couldn't reach the server, so nothing changed. Please try again." });
    } finally {
      setToggling(null);
    }
  }

  const active = hubs.filter((h) => h.status === "ACTIVE");
  const archived = hubs.filter((h) => h.status !== "ACTIVE");

  function renderRow(hub: HubRow) {
    const isArchived = hub.status !== "ACTIVE";
    const busy = toggling === hub.id;
    const asking = confirming?.id === hub.id;
    const problem = rowError?.id === hub.id ? rowError.msg : null;
    return (
      <Fragment key={hub.id}>
        <tr className={isArchived ? "adm-hubs-row--archived" : ""}>
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
                type="button"
                className="adm-hubs-btn-toggle"
                onClick={() => {
                  setRowError(null);
                  if (isArchived) toggleStatus(hub);
                  else setConfirming({ id: hub.id });
                }}
                disabled={busy || asking}
              >
                {busy && !asking ? "Unarchiving…" : isArchived ? "Unarchive" : "Archive"}
              </button>
            </div>
          </td>
        </tr>
        {(asking || problem) && (
          <tr className="adm-hubs-divider-row">
            <td colSpan={6}>
              {asking && (
                <div className="adm2-danger-confirm">
                  <p className="adm2-danger-confirm__msg">
                    {confirming?.warning
                      ? confirming.warning
                      : `Archive ${hub.name}? Its members will no longer see it among their teams. You can unarchive it later.`}
                  </p>
                  <div className="adm2-danger-confirm__actions">
                    <button
                      type="button"
                      className="adm2-btn--danger"
                      onClick={() => toggleStatus(hub, !!confirming?.warning)}
                      disabled={busy}
                    >
                      {busy ? "Archiving…" : confirming?.warning ? "Archive and clear the schedule" : "Archive this team"}
                    </button>
                    <button
                      type="button"
                      className="adm2-btn--neutral"
                      onClick={() => { setConfirming(null); setRowError(null); }}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {problem && (
                <p className="save-note save-note--error" role="alert">{problem}</p>
              )}
            </td>
          </tr>
        )}
      </Fragment>
    );
  }

  return (
    <>
      {showCreated && <div className="adm-hubs-success">Team created.</div>}

      <div className="adm-hubs-bulk">
        <button
          type="button"
          className="adm-hubs-btn-toggle"
          onClick={provisionAll}
          disabled={provisioningAll}
        >
          {provisioningAll ? "Setting up files…" : "Set up files for all teams"}
        </button>
        <span className="adm-hubs-hint" role="status">{provisionNote}</span>
      </div>

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
        <p className="adm-hubs-empty">No teams yet.</p>
      )}
    </>
  );
}
