"use client";

/**
 * MigrateDocumentsClient — the dry-run runner for the native-docs → Google
 * Files cutover (RIM_GoogleWorkspace.md §6). Read-only: it POSTs the dry-run
 * and renders the report. The migrate action is added with the write step.
 * CSS: reuses adm- utility classes.
 */

import { useState } from "react";

interface DryRun {
  totalNonTrashed: number;
  byKind: { native: number; upload: number; link: number };
  byState: { active: number; archived: number };
  hubless: number;
  crossShared: number;
  uploadsWithBlob: number;
  uploadsMissingBlob: number;
  nativeEmpty: number;
  migratable: number;
  homeUnprovisioned: number;
  homelessToCommunity: number;
  perHub: { hubName: string; hubSlug: string | null; provisioned: boolean; docCount: number }[];
  notes: string[];
}

export default function MigrateDocumentsClient() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<DryRun | null>(null);
  const [error, setError] = useState("");

  async function runDryRun() {
    setRunning(true);
    setError("");
    try {
      const res = await fetch("/api/admin/migrate-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dry-run" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "The dry-run couldn't complete.");
      } else {
        setReport(data.report);
      }
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  const stat = (label: string, value: number | string) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "6px 0" }}>
      <span style={{ color: "var(--rim-text-muted)" }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );

  return (
    <div>
      <div className="adm-hubs-bulk">
        <button type="button" className="adm-hubs-btn-toggle" onClick={runDryRun} disabled={running}>
          {running ? "Running dry-run…" : "Run dry-run"}
        </button>
        {error && <span className="adm-hubs-hint" style={{ color: "var(--color-error)" }}>{error}</span>}
      </div>

      {report && (
        <div style={{ maxWidth: "var(--reading-width)" }}>
          <div style={{ background: "var(--rim-surface)", borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <h2 className="ac-page-title" style={{ fontSize: "var(--text-h4)", marginBottom: 12 }}>
              Would migrate: {report.migratable} document{report.migratable === 1 ? "" : "s"}
            </h2>
            {stat("Total (not trashed)", report.totalNonTrashed)}
            {stat("Native (→ Google Doc)", report.byKind.native)}
            {stat("Uploads with a file (→ Drive)", report.uploadsWithBlob)}
            {stat("Links (not migrated)", report.byKind.link)}
            {stat("Active", report.byState.active)}
            {stat("Archived (not migrated)", report.byState.archived)}
            {stat("Shared across hubs", report.crossShared)}
            {stat("Hubless → Community", report.homelessToCommunity)}
            {stat("Empty native docs", report.nativeEmpty)}
            {stat("Uploads missing their file", report.uploadsMissingBlob)}
            {stat("Home hub not provisioned", report.homeUnprovisioned)}
          </div>

          {report.perHub.length > 0 && (
            <div style={{ background: "var(--rim-surface)", borderRadius: 12, padding: 24, marginBottom: 20 }}>
              <h3 style={{ fontSize: "var(--text-ui)", marginBottom: 8 }}>By hub</h3>
              {report.perHub.map((h) => (
                <div key={h.hubSlug ?? h.hubName} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span>
                    {h.hubName}
                    {!h.provisioned && (
                      <span style={{ color: "var(--color-warning)", marginLeft: 8 }}>· not provisioned</span>
                    )}
                  </span>
                  <strong>{h.docCount}</strong>
                </div>
              ))}
            </div>
          )}

          {report.notes.length > 0 && (
            <ul style={{ paddingLeft: 20 }}>
              {report.notes.map((n, i) => (
                <li key={i} className="adm-hubs-hint" style={{ marginBottom: 6 }}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
