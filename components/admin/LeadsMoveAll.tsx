"use client";

/**
 * One-time admin panel (2026-10-13): preview, then move every team's Team
 * files into its "Leads only" folder. Remove with
 * app/api/admin/files-leads/route.ts once it has run.
 */

import { useState } from "react";
import FormDone from "@/components/FormDone";

type Row = { team: string; items: number; moved: number; failed: number; revoked: number };

export default function LeadsMoveAll() {
  const [preview, setPreview] = useState<Row[] | null>(null);
  const [done, setDone] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<"preview" | "move" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function load() {
    setBusy("preview");
    setError(null);
    try {
      const res = await fetch("/api/admin/files-leads");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data.results);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "We couldn't read the teams' files. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function move() {
    setBusy("move");
    setError(null);
    try {
      const res = await fetch("/api/admin/files-leads", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(data.results);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "The move didn't finish. Please try again; anything already moved stays moved.");
    } finally {
      setBusy(null);
    }
  }

  const total = (preview ?? []).reduce((n, r) => n + r.items, 0);

  if (done) {
    const moved = done.reduce((n, r) => n + r.moved, 0);
    const failed = done.reduce((n, r) => n + Math.max(r.failed, 0), 0);
    return (
      <FormDone app title={`Done. ${moved} ${moved === 1 ? "item" : "items"} moved into each team’s Leads only.`}>
        <p>
          {failed > 0
            ? `${failed} couldn’t be moved and are still in Team files; run it again to retry them. `
            : ""}
          Members see an empty Team files until their leads move things back.
        </p>
        <ul className="adm-leads-move__list">
          {done.map((r) => (
            <li key={r.team}>
              {r.team}: {r.moved} moved{r.failed > 0 ? `, ${r.failed} not moved` : ""}
            </li>
          ))}
        </ul>
      </FormDone>
    );
  }

  return (
    <section className="adm-diag__card adm-leads-move">
      <h2 className="adm-leads-move__title">Move every team&rsquo;s files into Leads only</h2>
      <p>
        Once, for every team: everything in Team files moves into that team&rsquo;s Leads only, and
        links already handed out stop working. Members see an empty Team files until their leads
        move things back.
      </p>
      {!preview ? (
        <button type="button" className="pp-btn" onClick={load} disabled={busy !== null}>
          {busy === "preview" ? "Counting…" : "See what would move"}
        </button>
      ) : (
        <>
          <ul className="adm-leads-move__list">
            {preview.map((r) => (
              <li key={r.team}>
                {r.team}: {r.items} {r.items === 1 ? "item" : "items"}
              </li>
            ))}
          </ul>
          <p>
            <strong>{total}</strong> top-level {total === 1 ? "item" : "items"} in all (a folder counts once and carries its contents).
          </p>
          {!confirming ? (
            <button type="button" className="pp-btn" onClick={() => setConfirming(true)} disabled={total === 0}>
              Move them into Leads only
            </button>
          ) : (
            <div className="adm-leads-move__confirm">
              <p>Move all {total} now? Members lose sight of them until their leads move them back.</p>
              <div className="pp-actions">
                <button type="button" className="pp-btn" onClick={move} disabled={busy !== null}>
                  {busy === "move" ? "Moving… this can take a few minutes" : "Yes, move them"}
                </button>
                <button type="button" className="pp-btn pp-btn--ghost" onClick={() => setConfirming(false)} disabled={busy !== null}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {error && <p className="save-note save-note--error" role="alert">{error}</p>}
    </section>
  );
}
