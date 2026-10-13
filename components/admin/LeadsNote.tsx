"use client";

/**
 * One-time admin panel (2026-10-13): send the Leads only note to every
 * team's active leads, once. Remove with app/api/admin/leads-note.
 */

import { useState } from "react";
import FormDone from "@/components/FormDone";

type Recipient = { name: string; teams: string[] };

export default function LeadsNote() {
  const [list, setList] = useState<Recipient[] | null>(null);
  const [alreadySent, setAlreadySent] = useState(false);
  const [busy, setBusy] = useState<"load" | "send" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: string[]; failed: string[] } | null>(null);

  async function load() {
    setBusy("load");
    setError(null);
    try {
      const res = await fetch("/api/admin/leads-note");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setList(data.recipients);
      setAlreadySent(!!data.sent);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "We couldn't load the leads. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    setBusy("send");
    setError(null);
    try {
      const res = await fetch("/api/admin/leads-note", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "The note didn't go out. Please try again.");
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  }

  if (result) {
    return (
      <FormDone app title={`Sent. ${result.sent.length} ${result.sent.length === 1 ? "lead has" : "leads have"} the note.`}>
        <p>
          {result.sent.join(", ")}.
          {result.failed.length ? ` Not sent to: ${result.failed.join(", ")}.` : ""}
        </p>
      </FormDone>
    );
  }

  return (
    <section className="adm-diag__card adm-leads-move">
      <h2 className="adm-leads-move__title">Send the Leads only note to team leads</h2>
      <p>
        One email to each team&rsquo;s active leads (template &ldquo;Team Leads: Leads only and
        tidying files&rdquo; in Emails). You aren&rsquo;t sent a copy. It can only go out once.
      </p>
      {!list ? (
        <button type="button" className="pp-btn" onClick={load} disabled={busy !== null}>
          {busy === "load" ? "Loading…" : "See who it goes to"}
        </button>
      ) : alreadySent ? (
        <p><strong>This note has already gone out.</strong></p>
      ) : (
        <>
          <ul className="adm-leads-move__list">
            {list.map((r) => (
              <li key={r.name}>{r.name}: {r.teams.join(", ")}</li>
            ))}
          </ul>
          {!confirming ? (
            <button type="button" className="pp-btn" onClick={() => setConfirming(true)} disabled={list.length === 0}>
              Send to {list.length} {list.length === 1 ? "lead" : "leads"}
            </button>
          ) : (
            <div className="adm-leads-move__confirm">
              <p>Send the note to these {list.length} now?</p>
              <div className="pp-actions">
                <button type="button" className="pp-btn" onClick={send} disabled={busy !== null}>
                  {busy === "send" ? "Sending…" : "Yes, send it"}
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
