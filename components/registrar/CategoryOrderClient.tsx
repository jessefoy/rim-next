"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  programCount: number;
  hidden: boolean;
}

export default function CategoryOrderClient({ categories: initial }: { categories: Category[] }) {
  const [items, setItems] = useState(initial);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

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
        Arrange the order categories appear on the programs page.
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
          </div>
        ))}
      </div>

      {saving && <p className="catord__saving">Saving...</p>}
    </div>
  );
}
