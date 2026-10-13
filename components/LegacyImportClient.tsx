"use client";

import { useState } from "react";

type SkippedPerson = { name: string; email: string; joined: string | null };
type ImportResult = {
  ok: true;
  dryRun: boolean;
  memberstackTotal: number;
  skippedNoEmail: number;
  duplicates: number;
  alreadyInApp: number;
  cutoff: string;
  earlierNotRecreated: number;
  suspectedBots: SkippedPerson[];
  created: number;
  newByMonth: Record<string, number>;
};
type Result = ImportResult | { error: string };

function isOk(r: Result | null): r is ImportResult {
  return !!r && "ok" in r && r.ok === true;
}

function monthLabel(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return key;
  return new Date(Date.UTC(+m[1], +m[2] - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

/** Preview, then a confirmed import. Each run fetches Memberstack fresh. */
export default function LegacyImportClient() {
  const [pending, setPending] = useState<"preview" | "import" | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [confirming, setConfirming] = useState(false);

  const run = async (dryRun: boolean) => {
    if (pending) return;
    setPending(dryRun ? "preview" : "import");
    if (dryRun) setResult(null);
    try {
      const res = await fetch("/api/admin/import-legacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const data: Result = await res.json().catch(() => ({ error: "Couldn't read the response." }));
      setResult(data);
    } catch {
      setResult({ error: "The request didn't go through. Nothing is lost; please try again." });
    } finally {
      setPending(null);
      setConfirming(false);
    }
  };

  const ok = isOk(result) ? result : null;
  const previewReady = !!ok && ok.dryRun && ok.created > 0;
  const months = ok ? Object.keys(ok.newByMonth).sort() : [];
  const skipped = ok ? ok.skippedNoEmail + ok.duplicates : 0;

  return (
    <div className="adm-diag__card">
      <div className="adm-diag__label">Import</div>

      {confirming && ok ? (
        <>
          <p className="adm-diag__warning">
            This creates {ok.created} quiet {ok.created === 1 ? "account" : "accounts"}. No one is
            emailed.
          </p>
          <div className="adm-diag__row adm-diag__row--wrap" style={{ marginTop: "var(--space-2)" }}>
            <button type="button" className="btn" onClick={() => run(false)} disabled={!!pending}>
              {pending === "import" ? "Importing…" : "Yes, import them"}
            </button>
            <button
              type="button"
              className="adm2-btn--neutral"
              onClick={() => setConfirming(false)}
              disabled={!!pending}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="adm-diag__row adm-diag__row--wrap">
          {previewReady && ok && (
            <button type="button" className="btn" onClick={() => setConfirming(true)}>
              Import {people(ok.created)}…
            </button>
          )}
          <button
            type="button"
            className={previewReady ? "adm2-btn--neutral" : "btn"}
            onClick={() => run(true)}
            disabled={!!pending}
          >
            {pending === "preview" ? "Checking Memberstack…" : ok ? "Preview again" : "Preview"}
          </button>
        </div>
      )}

      {result && pending !== "preview" && (
        <div style={{ marginTop: "var(--space-2)" }}>
          {ok ? (
            <>
              <p className={ok.dryRun ? "adm-diag__help" : "adm-diag__success"}>
                {ok.dryRun
                  ? "Preview only. Nothing has been written."
                  : `Done. ${people(ok.created)} imported.`}
              </p>
              <ul className="adm-diag__help">
                <li>{ok.memberstackTotal} members in Memberstack</li>
                <li>{ok.alreadyInApp} already here, left as they are</li>
                <li>
                  Looking for people who joined after{" "}
                  {new Date(ok.cutoff).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </li>
                <li>
                  {ok.dryRun ? "Joined since then, to import" : "Imported"}: <strong>{ok.created}</strong>
                </li>
                {months.length > 0 && (
                  <li>
                    Joined:{" "}
                    {months.map((k, i) => (
                      <span key={k}>
                        {i > 0 && ", "}
                        {monthLabel(k)} {ok.newByMonth[k]}
                      </span>
                    ))}
                  </li>
                )}
                {ok.earlierNotRecreated > 0 && (
                  <li>
                    {ok.earlierNotRecreated} who joined earlier and aren&rsquo;t here now, not
                    brought back
                  </li>
                )}
                {ok.suspectedBots.length > 0 && (
                  <li>{ok.suspectedBots.length} suspected bots left behind (listed below)</li>
                )}
                {skipped > 0 && <li>{skipped} skipped for a missing or repeated email</li>}
              </ul>
              {ok.suspectedBots.length > 0 && (
                <details style={{ marginTop: "var(--space-1)" }}>
                  <summary className="adm-diag__help">Suspected bots, for review</summary>
                  <ul className="adm-diag__help">
                    {ok.suspectedBots.map((p) => (
                      <li key={p.email}>
                        {p.name || "(no name)"}, {p.email}
                        {p.joined && <>, joined {p.joined}</>}
                      </li>
                    ))}
                  </ul>
                  <p className="adm-diag__help">
                    A real person here can join on the new site, or be added from the member registry.
                  </p>
                </details>
              )}
              {ok.dryRun && ok.created === 0 && (
                <p className="adm-diag__success">No one new to bring in.</p>
              )}
            </>
          ) : (
            <p className="adm-diag__warning">{"error" in result ? result.error : ""}</p>
          )}
        </div>
      )}
    </div>
  );
}
