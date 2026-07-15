"use client";

/**
 * The revoke/lockdown actions for one place on the Google Files admin
 * console (app/admin/google-files/page.tsx). Server-rendered worklist as the
 * initial state; each row's Revoke button and the place-wide "Lock down"
 * button update that state directly from the routes' responses — no full
 * page reload needed to see the result.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pill } from "@/components/admin/DiagPill";
import { relativeDate } from "@/lib/relativeDate";

interface WorklistRow {
  googleFileId: string;
  mintedAt: string;
  name: string | null;
  stillExposed: boolean;
  /** True when the live status check itself failed (transient Drive error) —
   *  shown as "couldn't check," never a false all-clear. */
  checkFailed: boolean;
}

interface Place {
  key: string;
  name: string;
  hubId: string | null;
}

export default function GoogleFileAdminClient({
  place,
  initialWorklist,
}: {
  place: Place;
  initialWorklist: WorklistRow[];
}) {
  const router = useRouter();
  const [worklist, setWorklist] = useState(initialWorklist);
  // Server is the source of truth: when a router.refresh() re-runs the page's
  // live Drive checks, resync to the fresh list (a new prop reference). Local
  // optimistic edits between refreshes still work; a refresh corrects them.
  useEffect(() => {
    setWorklist(initialWorklist);
  }, [initialWorklist]);
  // A Set, not a single id — revoking one row must not re-enable another
  // row's button while its own request is still in flight.
  const [revokingIds, setRevokingIds] = useState<Set<string>>(new Set());
  const [lockingDown, setLockingDown] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const exposedCount = worklist.filter((w) => w.stillExposed).length;
  const uncheckedCount = worklist.filter((w) => w.checkFailed).length;

  async function revokeOne(fileId: string) {
    setRevokingIds((prev) => new Set(prev).add(fileId));
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/google/files/${fileId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hubId: place.hubId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not revoke this link.");
      setWorklist((rows) =>
        rows.map((r) => (r.googleFileId === fileId ? { ...r, stillExposed: false } : r)),
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not revoke this link.");
    } finally {
      setRevokingIds((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  }

  async function lockDownPlace() {
    if (
      !window.confirm(
        `Revoke every link ${place.name} has ever handed out? Anyone still holding an old link loses edit access; RIM will mint a fresh one the next time they open a file here.`,
      )
    ) {
      return;
    }
    setLockingDown(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/google/places/${encodeURIComponent(place.key)}/lockdown`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not finish locking this down.");
      setMessage(`Checked ${data.checked} file(s), revoked ${data.revoked}.`);
      // Pull the server's fresh live-checked worklist rather than optimistically
      // assume every revoke succeeded — a file that failed to revoke must keep
      // showing as still exposed, not flip to a false all-clear.
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not finish locking this down.");
    } finally {
      setLockingDown(false);
    }
  }

  return (
    <div className="adm-diag__card">
      <div className="adm-diag__row adm-diag__row--spaced adm-diag__row--between adm-diag__label">
        <span>
          {place.name} — {worklist.length} file{worklist.length === 1 ? "" : "s"} ever linked,{" "}
          {exposedCount} still exposed
          {uncheckedCount > 0 ? `, ${uncheckedCount} couldn’t be checked` : ""}
        </span>
        <button
          className="btn btn--danger"
          onClick={lockDownPlace}
          disabled={lockingDown || exposedCount === 0}
        >
          {lockingDown ? "Locking down…" : "Lock down this drive"}
        </button>
      </div>

      {message && <p className="adm-diag__help">{message}</p>}

      {worklist.length === 0 ? (
        <p className="adm-diag__help">No links have been minted here yet.</p>
      ) : (
        <ul className="adm-file-worklist">
          {worklist.map((row) => (
            <li key={row.googleFileId} className="adm-file-worklist__row">
              <span className="adm-file-worklist__name">
                {row.name ?? <em>File no longer exists</em>}
              </span>
              <span className="adm-diag__id">{row.googleFileId}</span>
              <span className="adm-file-worklist__minted">
                Minted {relativeDate(row.mintedAt)}
              </span>
              {row.checkFailed
                ? pill("error", "Couldn't check")
                : row.name === null
                  ? pill("success", "Deleted")
                  : row.stillExposed
                    ? pill("warning", "Anyone can edit")
                    : pill("success", "Locked down")}
              <button
                className="btn"
                onClick={() => revokeOne(row.googleFileId)}
                // Enabled when there's plausibly something to cut off: still
                // exposed, or the check failed so we can't be sure it isn't
                // (revoke is idempotent and safe either way). Disabled when
                // confirmed clean — locked down, or the file is gone (both
                // leave stillExposed=false with no check failure).
                disabled={
                  revokingIds.has(row.googleFileId) ||
                  (!row.stillExposed && !row.checkFailed)
                }
              >
                {revokingIds.has(row.googleFileId) ? "Revoking…" : "Revoke"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
