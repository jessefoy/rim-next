"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROGRAM_KINDS } from "@/lib/programKind";

interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  programCount: number;
  hidden: boolean;
  kind: string | null;
}

export default function CategoryOrderClient({ categories: initial }: { categories: Category[] }) {
  const [items, setItems] = useState(initial);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function setKind(id: string, kind: string) {
    const next = items.map((c) => (c.id === id ? { ...c, kind: kind || null } : c));
    setItems(next);
    setSaving(true);
    try {
      await fetch("/api/programs-pg/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, kind: kind || null }),
      });
      router.refresh();
    } catch {
      setItems(items);
    } finally {
      setSaving(false);
    }
  }

  async function move(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setItems(next);

    // Save immediately
    setSaving(true);
    try {
      await fetch("/api/programs-pg/categories/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((c) => c.id) }),
      });
      router.refresh();
    } catch {
      // Revert on error
      setItems(items);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="catord">
      <h1 className="catord__title">Program Categories</h1>
      <p className="catord__desc">
        Arrange the order categories appear on the programs page, and set each
        category&rsquo;s <strong>kind</strong> — what the offerings in it
        <em> are</em> (a drop-in, a class, a retreat&hellip;). Kind decides where
        a program shows up (the community schedule vs. a member&rsquo;s
        &ldquo;Coming up for you&rdquo;); the name is just the heading on the
        page.
      </p>

      <div className="catord__list">
        {items.map((cat, i) => (
          <div key={cat.id} className={`catord__row${cat.hidden ? " catord__row--hidden" : ""}`}>
            <div className="catord__arrows">
              <button
                className="catord__arrow"
                disabled={i === 0 || saving}
                onClick={() => move(i, "up")}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                className="catord__arrow"
                disabled={i === items.length - 1 || saving}
                onClick={() => move(i, "down")}
                aria-label="Move down"
              >
                ↓
              </button>
            </div>
            <div className="catord__info">
              <span className="catord__name">{cat.name}</span>
              <span className="catord__count">
                {cat.programCount} program{cat.programCount !== 1 ? "s" : ""}
                {cat.hidden && " · hidden"}
              </span>
            </div>
            <label className="catord__kind">
              <span className="catord__kind-label">Kind</span>
              <select
                className="catord__kind-select"
                value={cat.kind ?? ""}
                disabled={saving}
                onChange={(e) => setKind(cat.id, e.target.value)}
              >
                <option value="">— not set —</option>
                {PROGRAM_KINDS.map((k) => (
                  <option key={k.code} value={k.code}>{k.label}</option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>

      {saving && <p className="catord__saving">Saving...</p>}
    </div>
  );
}
