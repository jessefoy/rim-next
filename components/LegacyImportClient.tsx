"use client";

import { useState, type ChangeEvent } from "react";

type ImportResult = {
  ok: true;
  dryRun: boolean;
  parsed: number;
  warnings: string[];
  warningCount: number;
  created: number;
  updated: number;
  claimedCollisions: number;
};
type ErrorResult = { error: string; warnings?: string[] };
type Result = ImportResult | ErrorResult;

function isOk(r: Result | null): r is ImportResult {
  return !!r && "ok" in r && r.ok === true;
}

export default function LegacyImportClient() {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [previewed, setPreviewed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setResult(null);
    setPreviewed(false);
    setConfirming(false);
    if (!file) {
      setCsv("");
      setFileName("");
      return;
    }
    setFileName(file.name);
    setCsv(await file.text());
  };

  const run = async (dryRun: boolean) => {
    if (busy || !csv.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/import-legacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, dryRun }),
      });
      const data: Result = await res.json().catch(() => ({ error: "Couldn't read the response." }));
      setResult(data);
      if (res.ok && dryRun) setPreviewed(true);
      if (res.ok && !dryRun) {
        setPreviewed(false);
        setConfirming(false);
      }
    } catch {
      setResult({ error: "Request failed. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="adm-section">
      <h2 className="adm-section__title">Upload the Memberstack export</h2>
      <p className="adm2-section__hint" style={{ marginBottom: 16 }}>
        Imports each row as a quiet, unclaimed legacy account — invisible in the
        main member list, silent (no emails), and exempt from cleanup — until the
        person logs in and accepts the agreements, which promotes them. Safe to
        re-run: it resumes idempotently and never overturns anyone who has already
        signed in. <strong>Preview first</strong> to see the counts before any
        accounts are written.
      </p>

      <div style={{ marginBottom: 16 }}>
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="adm-form__input" />
        {fileName && (
          <p className="adm2-section__hint" style={{ marginTop: 8 }}>
            Loaded <strong>{fileName}</strong>.
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          className="adm2-btn--neutral"
          onClick={() => run(true)}
          disabled={busy || !csv.trim()}
        >
          {busy ? "Working…" : "Preview (dry run)"}
        </button>

        {previewed && !confirming && (
          <button type="button" className="adm-add-btn" onClick={() => setConfirming(true)} disabled={busy}>
            Run import…
          </button>
        )}

        {confirming && (
          <>
            <button type="button" className="adm-add-btn" onClick={() => run(false)} disabled={busy}>
              {busy ? "Importing…" : "Yes, import for real"}
            </button>
            <button
              type="button"
              className="adm2-btn--neutral"
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {result && (
        <div style={{ marginTop: 18 }}>
          {isOk(result) ? (
            <>
              <p className="adm2-save__success">
                {result.dryRun ? "Preview — nothing written yet." : "Import complete."}
              </p>
              <ul className="adm2-section__hint" style={{ marginTop: 8, lineHeight: 1.7 }}>
                <li>{result.parsed} record(s) parsed from the file</li>
                <li>
                  {result.dryRun ? "Would create" : "Created"}: <strong>{result.created}</strong> new
                  legacy account(s)
                </li>
                <li>
                  {result.dryRun ? "Would update" : "Updated"}: <strong>{result.updated}</strong>{" "}
                  existing account(s)
                  {result.claimedCollisions > 0 && (
                    <> — of which {result.claimedCollisions} are already-claimed members (legacy history refreshed only)</>
                  )}
                </li>
                {result.warningCount > 0 && (
                  <li>
                    {result.warningCount} row(s) skipped with warnings (first {result.warnings.length}{" "}
                    shown below)
                  </li>
                )}
              </ul>
              {result.warnings.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary className="adm2-section__hint">Skipped rows</summary>
                  <ul className="adm2-section__hint" style={{ marginTop: 6 }}>
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <p className="adm2-save__error">{result.error}</p>
          )}
        </div>
      )}
    </section>
  );
}
