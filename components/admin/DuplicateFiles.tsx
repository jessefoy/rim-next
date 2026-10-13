"use client";

/**
 * Admin review of duplicate team files (2026-10-13): each group of
 * same-name files in a team, whether their contents match, and one copy to
 * keep (suggested: the one with comments or a pin, else the latest edited).
 * One confirmation moves the others to Drive's trash (30-day recovery).
 */

import { useState } from "react";
import FormDone from "@/components/FormDone";

type DupFile = {
  id: string; name: string; mimeType: string; modifiedTime: string | null;
  folder: string; leadsOnly: boolean; comments: number; pinned: boolean;
};
type Group = { team: string; hubId: string; name: string; identical: boolean | null; keepId: string; files: DupFile[] };

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "unknown";

export default function DuplicateFiles() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [keep, setKeep] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"scan" | "trash" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ trashed: number; refused: number } | null>(null);

  const groupKey = (g: Group) => `${g.hubId}:${g.name}:${g.files[0].mimeType}`;

  async function scan() {
    setBusy("scan");
    setError(null);
    try {
      const res = await fetch("/api/admin/files-duplicates");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGroups(data.groups);
      setKeep(Object.fromEntries((data.groups as Group[]).map((g) => [groupKey(g), g.keepId])));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "We couldn't read the teams' files. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  // Never every copy: a group whose keeper isn't one of its files is skipped.
  const toTrashFiles = (groups ?? []).flatMap((g) => {
    const k = keep[groupKey(g)];
    return g.files.some((f) => f.id === k) ? g.files.filter((f) => f.id !== k) : [];
  });
  const toTrash = toTrashFiles.map((f) => f.id);
  const withNotes = toTrashFiles.filter((f) => f.comments > 0 || f.pinned).length;

  async function trash() {
    setBusy("trash");
    setError(null);
    try {
      const res = await fetch("/api/admin/files-duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trash: toTrash }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "The clean-up didn't finish. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (result) {
    return (
      <FormDone app title={`Done. ${result.trashed} duplicate ${result.trashed === 1 ? "copy is" : "copies are"} in Drive’s trash.`}>
        <p>
          They can be restored from Google Drive&rsquo;s trash for 30 days.
          {result.refused > 0 ? ` ${result.refused} weren’t moved (already gone, or not a team file).` : ""}
        </p>
      </FormDone>
    );
  }

  return (
    <section className="adm-diag__card adm-leads-move">
      <h2 className="adm-leads-move__title">Duplicate files</h2>
      <p>
        Files with the same name and type inside one team. Most are copies from the July move of
        the old in-app documents, which made one copy for each team a document appeared in.
      </p>
      {!groups ? (
        <button type="button" className="pp-btn" onClick={scan} disabled={busy !== null}>
          {busy === "scan" ? "Looking… this can take a minute" : "Find duplicates"}
        </button>
      ) : groups.length === 0 ? (
        <p><strong>No duplicates found.</strong> Every team&rsquo;s files have distinct names.</p>
      ) : (
        <>
          {groups.map((g) => (
            <fieldset key={groupKey(g)} className="adm-dup">
              <legend className="adm-dup__legend">
                {g.team}: &ldquo;{g.name}&rdquo;{" "}
                <span className="adm-dup__match">
                  {g.identical === true ? "Same contents" : g.identical === false ? "Contents differ: check before removing" : "Contents not compared"}
                </span>
              </legend>
              {g.files.map((f) => (
                <label key={f.id} className="adm-dup__file">
                  <input
                    type="radio"
                    name={groupKey(g)}
                    checked={keep[groupKey(g)] === f.id}
                    onChange={() => setKeep((k) => ({ ...k, [groupKey(g)]: f.id }))}
                  />
                  <span>
                    Keep this one: in {f.folder}{f.leadsOnly ? " (Leads only)" : ""}, last edited {when(f.modifiedTime)}
                    {f.comments ? `, ${f.comments} ${f.comments === 1 ? "comment" : "comments"}` : ""}
                    {f.pinned ? ", pinned" : ""}{" "}
                    <a href={`/account/files/${f.id}`} target="_blank" rel="noopener">Open</a>
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
          {!confirming ? (
            <button type="button" className="pp-btn" onClick={() => setConfirming(true)} disabled={toTrash.length === 0}>
              Move the other {toTrash.length} {toTrash.length === 1 ? "copy" : "copies"} to Drive&rsquo;s trash
            </button>
          ) : (
            <div className="adm-leads-move__confirm">
              <p>
                Move {toTrash.length} {toTrash.length === 1 ? "copy" : "copies"} to Drive&rsquo;s trash? They can be restored there for 30 days.
                {withNotes > 0
                  ? ` ${withNotes} of them ${withNotes === 1 ? "has" : "have"} comments or a pin in RIM, which stay with that copy.`
                  : ""}
              </p>
              <div className="pp-actions">
                <button type="button" className="pp-btn" onClick={trash} disabled={busy !== null}>
                  {busy === "trash" ? "Moving…" : "Yes, move them"}
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
