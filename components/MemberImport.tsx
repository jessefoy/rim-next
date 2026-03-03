"use client";

import { useState, useRef } from "react";

interface ParsedRow {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  memberstackId: string;
  memberSince: string;   // ISO string or ""
  lastLogin: string;     // ISO string or ""
  lastAttendance: string; // ISO string or ""
  activityCount: number | null;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
}

// Case-insensitive column header → index
function detectColumn(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

// Parse M/D/YYYY or YYYY-MM-DD → ISO string, or "" if blank/invalid
function parseDate(raw: string): string {
  if (!raw?.trim()) return "";
  const s = raw.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T00:00:00");
    return isNaN(d.getTime()) ? "" : d.toISOString();
  }
  // M/D/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [m, d, y] = s.split("/").map(Number);
    const dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? "" : dt.toISOString();
  }
  return "";
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Parse a single CSV line, handling quoted fields
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

  // Memberstack-specific column names (confirmed from actual export)
  const emailIdx       = detectColumn(headers, ["email"]);
  const firstIdx       = detectColumn(headers, ["first name", "firstname", "first_name"]);
  const lastIdx        = detectColumn(headers, ["last name", "lastname", "last_name"]);
  const phoneIdx       = detectColumn(headers, ["phone number", "phone", "mobile", "cell"]);
  const msIdIdx        = detectColumn(headers, ["member id", "memberid", "id"]);
  const createdIdx     = detectColumn(headers, ["createdat", "created at", "created_at"]);
  const lastLoginIdx   = detectColumn(headers, ["last login", "lastlogin", "last_login"]);
  const attendanceIdx  = detectColumn(headers, ["last attendance date", "last attendance"]);
  const activityIdx    = detectColumn(headers, ["activity count since 7/24/23", "activity count", "activitycount"]);

  if (emailIdx === -1) return [];

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseRow(lines[i]);
    const email = cols[emailIdx]?.trim().toLowerCase() ?? "";
    if (!email) continue;
    rows.push({
      email,
      firstName:     firstIdx       !== -1 ? (cols[firstIdx]?.trim()     ?? "") : "",
      lastName:      lastIdx        !== -1 ? (cols[lastIdx]?.trim()      ?? "") : "",
      phone:         phoneIdx       !== -1 ? (cols[phoneIdx]?.trim()     ?? "") : "",
      memberstackId: msIdIdx        !== -1 ? (cols[msIdIdx]?.trim()      ?? "") : "",
      memberSince:   createdIdx     !== -1 ? parseDate(cols[createdIdx]) : "",
      lastLogin:     lastLoginIdx   !== -1 ? parseDate(cols[lastLoginIdx]) : "",
      lastAttendance: attendanceIdx !== -1 ? parseDate(cols[attendanceIdx]) : "",
      activityCount: activityIdx    !== -1 ? (parseInt(cols[activityIdx] ?? "") || null) : null,
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

  const fmtDate = (iso: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
        Imports: name, email, phone, member ID, join date, last login, last attendance, activity count.
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
                      <th>Member since</th>
                      <th>Last login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td>{r.email}</td>
                        <td>{r.firstName || "—"}</td>
                        <td>{r.lastName || "—"}</td>
                        <td>{r.phone || "—"}</td>
                        <td>{fmtDate(r.memberSince)}</td>
                        <td>{fmtDate(r.lastLogin)}</td>
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
