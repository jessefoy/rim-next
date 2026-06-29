"use client";

/**
 * MindMapsDirectory — the cross-hub finder (Slice 2). Sections are the viewer's
 * hubs → Community → Projects (hubless personal maps), mirroring the documents
 * directory. "New" creates a personal/project map; authored maps expose Share.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { relativeDate } from "@/lib/relativeDate";
import MindMapShareModal, { type ShareMap } from "./MindMapShareModal";

type Visibility = "HUB" | "COORDINATORS" | "COMMUNITY";
type EditPolicy = "OPEN" | "RESTRICTED";

interface DirMap {
  id: string;
  title: string;
  nodeCount: number;
  updatedAt: string;
  visibility: Visibility;
  editPolicy: EditPolicy;
  originHub: { id: string; slug: string; name: string } | null;
  sharedHubs: { id: string; slug: string; name: string }[];
  canManageSharing: boolean;
  canDelete: boolean;
  badge: string | null;
}

interface Section {
  key: string;
  label: string;
  maps: DirMap[];
}

export default function MindMapsDirectory({
  sections: initialSections,
  viewerHubs,
}: {
  sections: Section[];
  viewerHubs: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [sections, setSections] = useState(initialSections);
  const [creating, setCreating] = useState(false);
  const [shareMap, setShareMap] = useState<ShareMap | null>(null);

  async function createMap() {
    setCreating(true);
    try {
      const res = await fetch("/api/mindmaps", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!res.ok) throw new Error();
      const { id } = await res.json();
      router.push(`/account/mindmaps/${id}`);
    } catch {
      setCreating(false);
    }
  }

  async function deleteMap(id: string) {
    if (!window.confirm("Delete this mind map?")) return;
    const res = await fetch(`/api/mindmaps/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSections((secs) => secs.map((s) => ({ ...s, maps: s.maps.filter((m) => m.id !== id) })).filter((s) => s.maps.length > 0));
    }
  }

  function patchMap(id: string, patch: Partial<DirMap>) {
    setSections((secs) => secs.map((s) => ({ ...s, maps: s.maps.map((m) => (m.id === id ? { ...m, ...patch } : m)) })));
  }

  const empty = sections.length === 0;

  return (
    <div className="mm-dir">
      <header className="mm-dir__head">
        <div>
          <h1 className="mm-dir__title">Mind Maps</h1>
          <p className="mm-dir__sub">Every map across your hubs. Create maps inside a hub from its Mind Maps tab, or start a personal one here.</p>
        </div>
        <button className="mm-btn" onClick={createMap} disabled={creating}>
          {creating ? "Creating…" : "+ New mind map"}
        </button>
      </header>

      {empty ? (
        <p className="mm-dir__empty">No mind maps yet. Create one here, or from a hub’s Mind Maps tab.</p>
      ) : (
        sections.map((s) => (
          <section key={s.key} className="mm-dir__section">
            <h2 className="mm-dir__section-label">{s.label}</h2>
            <ul className="mm-dir__grid">
              {s.maps.map((m) => (
                <li key={`${s.key}-${m.id}`} className="mm-dir__card">
                  <Link href={`/account/mindmaps/${m.id}`} className="mm-dir__card-main">
                    <span className="mm-dir__card-title">{m.title || "Untitled mind map"}</span>
                    <span className="mm-dir__card-meta">
                      {m.nodeCount} {m.nodeCount === 1 ? "topic" : "topics"} · updated {relativeDate(m.updatedAt)}
                    </span>
                    {m.badge && <span className="mm-dir__badge">{m.badge}</span>}
                  </Link>
                  <div className="mm-dir__card-actions">
                    {m.canManageSharing && (
                      <button
                        className="mm-dir__card-act"
                        onClick={() =>
                          setShareMap({
                            id: m.id,
                            title: m.title,
                            visibility: m.visibility,
                            editPolicy: m.editPolicy,
                            originHub: m.originHub,
                            sharedHubs: m.sharedHubs,
                          })
                        }
                      >
                        Share
                      </button>
                    )}
                    {m.canDelete && (
                      <button className="mm-dir__card-del" onClick={() => deleteMap(m.id)}>Delete</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {shareMap && (
        <MindMapShareModal
          map={shareMap}
          viewerHubs={viewerHubs}
          onUpdated={(id, patch) => patchMap(id, patch)}
          onClose={() => setShareMap(null)}
        />
      )}
    </div>
  );
}
