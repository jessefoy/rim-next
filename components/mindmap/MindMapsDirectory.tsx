"use client";

/**
 * MindMapsDirectory — the member's mind-map list (Slice 1). "New mind map"
 * creates one (POST → navigate into the editor); each card opens its map; a
 * quiet Delete (confirm → soft-delete) keeps the list tidy. Slice 2 grows this
 * into hub + Community sections via the access gate.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { relativeDate } from "@/lib/relativeDate";

interface MapCard {
  id: string;
  title: string;
  updatedAt: string;
  nodeCount: number;
}

export default function MindMapsDirectory({ initialMaps }: { initialMaps: MapCard[] }) {
  const router = useRouter();
  const [maps, setMaps] = useState(initialMaps);
  const [creating, setCreating] = useState(false);

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
    if (res.ok) setMaps((m) => m.filter((x) => x.id !== id));
  }

  return (
    <div className="mm-dir">
      <header className="mm-dir__head">
        <div>
          <h1 className="mm-dir__title">Mind Maps</h1>
          <p className="mm-dir__sub">A spatial place to brainstorm topics and organize them into branches.</p>
        </div>
        <button className="mm-btn" onClick={createMap} disabled={creating}>
          {creating ? "Creating…" : "+ New mind map"}
        </button>
      </header>

      {maps.length === 0 ? (
        <p className="mm-dir__empty">No mind maps yet. Create one to start brainstorming.</p>
      ) : (
        <ul className="mm-dir__grid">
          {maps.map((m) => (
            <li key={m.id} className="mm-dir__card">
              <Link href={`/account/mindmaps/${m.id}`} className="mm-dir__card-main">
                <span className="mm-dir__card-title">{m.title || "Untitled mind map"}</span>
                <span className="mm-dir__card-meta">
                  {m.nodeCount} {m.nodeCount === 1 ? "topic" : "topics"} · updated {relativeDate(m.updatedAt)}
                </span>
              </Link>
              <button className="mm-dir__card-del" onClick={() => deleteMap(m.id)} aria-label="Delete map">
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
