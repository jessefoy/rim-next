"use client";

import { useState, useRef } from "react";

interface ParsedRow {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
}

// Case-insensitive column header → our field name
function detectColumn(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Parse headers — handle quoted fields
  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields.map((f) => f.trim());
  };

  const headers = parseRow(lines[0]);

  const emailIdx = detectColumn(headers, ["email", "e-mail", "email address"]);
  const firstIdx = detectColumn(headers, ["first name", "firstname", "first_name", "given name"]);
  const lastIdx = detectColumn(headers, ["last name", "lastname", "last_name", "surname", "family name"]);
  const phoneIdx = detectColumn(headers, ["phone", "phone number", "mobile", "cell"]);

  if (emailIdx === -1) return [];

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseRow(lines[i]);
    const email = cols[emailIdx]?.trim().toLowerCase() ?? "";
    if (!email) continue;
    rows.push({
      email,
      firstName: firstIdx !== -1 ? (cols[firstIdx]?.trim() ?? "") : "",
      lastName: lastIdx !== -1 ? (cols[lastIdx]?.trim() ?? "") : "",
      phone: phoneIdx !== -1 ? (cols[phoneIdx]?.trim() ?? "") : "",
    });
  }
  return rows;
}

export default function MemberImport() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        setError("Could not parse the CSV. Make sure it has an Email column.");
        setRows([]);
      } else {
        setRows(parsed);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/members/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data);
      setRows([]);
      setFileName("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setRows([]);
    setFileName("");
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  if (!open) {
    return (
      <button className="adm-import-btn" onClick={() => setOpen(true)}>
        Import from Memberstack
      </button>
    );
  }

  return (
    <div className="adm-import">
      <div className="adm-import__header">
        <h2 className="adm-import__title">Import from Memberstack CSV</h2>
        <button className="adm-import__close" onClick={handleClose} aria-label="Close">
          ✕
        </button>
      </div>

      <p className="adm-import__help">
        Export your members from the{" "}
        <strong>Memberstack dashboard → Members → Export</strong>. Upload the CSV below.
        Columns mapped: Email, First Name, Last Name, Phone.
      </p>

      {result ? (
        <div className="adm-import__result">
          <p className="adm-import__result-line">
            Import complete —{" "}
            <strong>{result.created} new</strong> ·{" "}
            <strong>{result.updated} updated</strong> ·{" "}
            <strong>{result.skipped} skipped</strong>
          </p>
          <p className="adm-import__result-hint">
            Reload the page to see all imported members.
          </p>
          <button className="adm-import-btn" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      ) : (
        <>
          <div className="adm-import__upload">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="adm-import__file"
              id="member-csv"
            />
            <label htmlFor="member-csv" className="adm-import__file-label">
              {fileName || "Choose CSV file…"}
            </label>
          </div>

          {error && <p className="adm-import__error">{error}</p>}

          {rows.length > 0 && (
            <>
              <p className="adm-import__count">
                {rows.length} {rows.length === 1 ? "member" : "members"} ready to import
              </p>

              {/* Preview: first 5 rows */}
              <div className="adm-import__preview-wrap">
                <table className="adm-import__preview">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>First</th>
                      <th>Last</th>
                      <th>Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td>{r.email}</td>
                        <td>{r.firstName || "—"}</td>
                        <td>{r.lastName || "—"}</td>
                        <td>{r.phone || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 5 && (
                  <p className="adm-import__preview-more">
                    …and {rows.length - 5} more
                  </p>
                )}
              </div>

              <div className="adm-import__actions">
                <button
                  className="adm-import__submit"
                  onClick={handleImport}
                  disabled={loading}
                >
                  {loading ? "Importing…" : `Import ${rows.length} members`}
                </button>
                <button className="adm-import__cancel" onClick={handleClose}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
