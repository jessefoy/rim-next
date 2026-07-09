"use client";

/**
 * DocumentsDirectoryClient — the master directory's interactive shell.
 * CSS prefix: docs-
 *
 * Renders the server-computed sections (the viewer's hubs → Community →
 * Projects), recency-first within each. A single search box spans everything and
 * collapses the sections into one flat, deduped, recency-sorted result list.
 * Rows lead with a doc-kind chip and the "Updated <when>" freshness signal.
 */

import { useState } from "react";
import { relativeDate } from "@/lib/relativeDate";

interface DirDoc {
  id: string;
  label: string;
  description: string | null;
  docKind: "NATIVE" | "LINK" | "UPLOAD";
  fileType: string;
  category: string | null;
  updatedAt: string;
  author: string;
  visibility: "HUB" | "COORDINATORS" | "COMMUNITY";
  originName: string | null;
  href: string;
  external: boolean;
}

interface DirSection { key: string; label: string; docs: DirDoc[] }
interface Props { sections: DirSection[] }

const KIND_LABEL: Record<DirDoc["docKind"], string> = {
  NATIVE: "Doc",
  LINK: "Link",
  UPLOAD: "File",
};

export default function DocumentsDirectoryClient({ sections }: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const total = sections.reduce((n, s) => n + s.docs.length, 0);

  // Flat, deduped, recency-sorted results when searching.
  const flat: DirDoc[] = [];
  if (searching) {
    const seen = new Set<string>();
    for (const s of sections) {
      for (const d of s.docs) {
        if (seen.has(d.id)) continue;
        if ([d.label, d.description ?? "", d.category ?? "", d.author, d.originName ?? ""].join(" ").toLowerCase().includes(q)) {
          seen.add(d.id);
          flat.push(d);
        }
      }
    }
    flat.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  function renderRow(d: DirDoc, key: string) {
    const inner = (
      <>
        <span className="docs-kind">{KIND_LABEL[d.docKind]}</span>
        <span className="docs-row__main">
          <span className="docs-row__title">{d.label}{d.external ? " ↗" : ""}</span>
          <span className="docs-row__meta">
            {d.category && <span className="docs-row__cat">{d.category}</span>}
            Updated {relativeDate(d.updatedAt)} · {d.author}
          </span>
        </span>
        {d.originName && <span className="docs-badge">Shared from {d.originName}</span>}
        {d.visibility === "COMMUNITY" && <span className="docs-badge docs-badge--community">Community</span>}
      </>
    );
    return d.external ? (
      <a key={key} className="docs-row" href={d.href} target="_blank" rel="noopener noreferrer">{inner}</a>
    ) : (
      <a key={key} className="docs-row" href={d.href}>{inner}</a>
    );
  }

  return (
    <div className="docs-wrap">
      <div className="docs-header">
        <h1 className="docs-title">Documents</h1>
        <p className="docs-sub">Everything you can reach — across your hubs, the community, and projects.</p>
      </div>

      {total > 0 && (
        <div className="docs-search">
          <input
            className="docs-search__input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            aria-label="Search documents"
          />
        </div>
      )}

      {total === 0 ? (
        <p className="docs-empty">No documents you can reach yet.</p>
      ) : searching ? (
        flat.length === 0 ? (
          <p className="docs-empty">No documents match “{query.trim()}”.</p>
        ) : (
          <div className="docs-list">{flat.map((d) => renderRow(d, d.id))}</div>
        )
      ) : (
        sections.map((s) => (
          <div key={s.key} className="docs-section">
            <div className="docs-section__title">{s.label}</div>
            <div className="docs-list">{s.docs.map((d) => renderRow(d, `${s.key}-${d.id}`))}</div>
          </div>
        ))
      )}
    </div>
  );
}
