"use client";

/**
 * HubMindMapsClient — the per-hub Mind Maps module (mirrors HubDocumentsClient,
 * leaner). Lists maps that originate in or are shared into this hub; create a
 * new hub map; share/remove/delete per card.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { relativeDate } from "@/lib/relativeDate";
import MindMapShareModal, { type ShareMap } from "./MindMapShareModal";

type Visibility = "HUB" | "COORDINATORS" | "COMMUNITY";
type EditPolicy = "OPEN" | "RESTRICTED";

interface HubMapCard {
  id: string;
  title: string;
  nodeCount: number;
  updatedAt: string;
  visibility: Visibility;
  editPolicy: EditPolicy;
  isOrigin: boolean;
  originHub: { id: string; slug: string; name: string } | null;
  sharedHubs: { id: string; slug: string; name: string }[];
  canManageSharing: boolean;
  canDelete: boolean;
}

interface Props {
  hubSlug: string;
  hubId: string;
  hubName: string;
  isCoordinator: boolean;
  initialMaps: HubMapCard[];
  viewerHubs: { id: string; name: string }[];
}

export default function HubMindMapsClient({ hubSlug, hubId, hubName, isCoordinator, initialMaps, viewerHubs }: Props) {
  const router = useRouter();
  const [maps, setMaps] = useState(initialMaps);
  const [creating, setCreating] = useState(false);
  const [shareMap, setShareMap] = useState<ShareMap | null>(null);

  async function createMap() {
    setCreating(true);
    try {
      const res = await fetch("/api/mindmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hubId }),
      });
      if (!res.ok) throw new Error();
      const { id } = await res.json();
      router.push(`/account/mindmaps/${id}`);
    } catch {
      setCreating(false);
    }
  }

  async function removeFromHub(id: string) {
    if (!window.confirm("Remove this map from this hub? (It stays in its home hub.)")) return;
    const res = await fetch(`/api/mindmaps/${id}/placements?hubId=${encodeURIComponent(hubId)}`, { method: "DELETE" });
    if (res.ok) setMaps((m) => m.filter((x) => x.id !== id));
  }

  async function deleteMap(id: string) {
    if (!window.confirm("Delete this mind map for everyone?")) return;
    const res = await fetch(`/api/mindmaps/${id}`, { method: "DELETE" });
    if (res.ok) setMaps((m) => m.filter((x) => x.id !== id));
  }

  function badge(m: HubMapCard): string | null {
    if (!m.isOrigin && m.originHub) return `Shared from ${m.originHub.name}`;
    if (m.visibility === "COMMUNITY") return "Community";
    if (m.isOrigin && m.sharedHubs.length > 0) return "Shared";
    return null;
  }

  return (
    <div className="mm-dir">
      <header className="mm-dir__head">
        <div>
          <h1 className="mm-dir__title">Mind Maps</h1>
          <p className="mm-dir__sub">Brainstorm topics for {hubName} and organize them into branches.</p>
        </div>
        <button className="mm-btn" onClick={createMap} disabled={creating}>
          {creating ? "Creating…" : "+ New mind map"}
        </button>
      </header>

      {maps.length === 0 ? (
        <p className="mm-dir__empty">No mind maps in this hub yet. Create one to start brainstorming.</p>
      ) : (
        <ul className="mm-dir__grid">
          {maps.map((m) => {
            const b = badge(m);
            return (
              <li key={m.id} className="mm-dir__card">
                <Link href={`/account/mindmaps/${m.id}`} className="mm-dir__card-main">
                  <span className="mm-dir__card-title">{m.title || "Untitled mind map"}</span>
                  <span className="mm-dir__card-meta">
                    {m.nodeCount} {m.nodeCount === 1 ? "topic" : "topics"} · updated {relativeDate(m.updatedAt)}
                  </span>
                  {b && <span className="mm-dir__badge">{b}</span>}
                </Link>
                <div className="mm-dir__card-actions">
                  {m.isOrigin && m.canManageSharing && (
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
                  {!m.isOrigin && isCoordinator && (
                    <button className="mm-dir__card-act" onClick={() => removeFromHub(m.id)}>Remove from hub</button>
                  )}
                  {m.isOrigin && m.canDelete && (
                    <button className="mm-dir__card-del" onClick={() => deleteMap(m.id)}>Delete</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {shareMap && (
        <MindMapShareModal
          map={shareMap}
          viewerHubs={viewerHubs}
          onUpdated={(id, patch) =>
            setMaps((ms) => ms.map((x) => (x.id === id ? { ...x, ...patch } : x)))
          }
          onClose={() => setShareMap(null)}
        />
      )}
    </div>
  );
}
