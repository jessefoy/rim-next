"use client";

import { useRef, useState } from "react";
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

const API = "/api/programs-pg/categories";

export default function CategoryOrderClient({ categories: initial }: { categories: Category[] }) {
  const [items, setItems] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState("");
  const [adding, setAdding] = useState(false);
  // Last server-saved name per id — so a blur only PATCHes when the name changed.
  const savedNames = useRef(new Map(initial.map((c) => [c.id, c.name] as [string, string])));
  const router = useRouter();

  async function patch(body: object): Promise<boolean> {
    setSaving(true);
    try {
      const res = await fetch(API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) router.refresh();
      return res.ok;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }

  function setKind(id: string, kind: string) {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, kind: kind || null } : c)));
    patch({ id, kind: kind || null });
  }

  function editName(id: string, name: string) {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }

  async function commitName(id: string) {
    const current = items.find((c) => c.id === id);
    if (!current) return;
    const name = current.name.trim();
    if (!name) {
      // Blank isn't allowed — revert to the last saved name.
      const saved = savedNames.current.get(id) ?? "";
      setItems((prev) => prev.map((c) => (c.id === id ? { ...c, name: saved } : c)));
      return;
    }
    if (name === savedNames.current.get(id)) return;
    const ok = await patch({ id, name });
    if (ok) savedNames.current.set(id, name);
  }

  async function move(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;
    const prev = items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    setSaving(true);
    try {
      await fetch(`${API}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((c) => c.id) }),
      });
      router.refresh();
    } catch {
      setItems(prev);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, name: string, count: number) {
    if (count > 0) {
      alert(`"${name}" has ${count} program${count !== 1 ? "s" : ""} assigned. Move them to another category first, then delete it.`);
      return;
    }
    if (!confirm(`Delete the category "${name}"? This can't be undone.`)) return;
    setSaving(true);
    try {
      const res = await fetch(API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((c) => c.id !== id));
        savedNames.current.delete(id);
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Could not delete category.");
      }
    } catch {
      /* network error — leave the row in place */
    } finally {
      setSaving(false);
    }
  }

  async function add() {
    const name = newName.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind: newKind || null }),
      });
      if (res.ok) {
        const cat = await res.json();
        setItems((prev) => [
          ...prev,
          {
            id: cat.id,
            slug: cat.slug,
            name: cat.name,
            kind: cat.kind ?? null,
            sortOrder: cat.sortOrder ?? 0,
            programCount: 0,
            hidden: cat.hideFromProgramsPage ?? false,
          },
        ]);
        savedNames.current.set(cat.id, cat.name);
        setNewName("");
        setNewKind("");
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Could not add category.");
      }
    } catch {
      /* network error */
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="catord">
      <h1 className="catord__title">Program Categories</h1>
      <p className="catord__desc">
        Each category is a section heading on the public Programs &amp; Events page, and carries a{" "}
        <strong>kind</strong> — what the offerings in it <em>are</em> (a drop-in, a class, a
        retreat&hellip;). The kind decides where a program shows up: the community schedule anyone
        can join, vs. a member&rsquo;s &ldquo;Coming up for you&rdquo; after they register. The name
        is just the heading; the kind is the behavior. Rename, set the kind, reorder, add, or remove
        below — changes save as you go.
      </p>

      <div className="catord__list">
        {items.map((cat, i) => (
          <div key={cat.id} className={`catord__row${cat.hidden ? " catord__row--hidden" : ""}`}>
            <div className="catord__arrows">
              <button className="catord__arrow" disabled={i === 0 || saving} onClick={() => move(i, "up")} aria-label="Move up">↑</button>
              <button className="catord__arrow" disabled={i === items.length - 1 || saving} onClick={() => move(i, "down")} aria-label="Move down">↓</button>
            </div>
            <div className="catord__info">
              <input
                className="catord__name-input"
                value={cat.name}
                disabled={saving}
                aria-label="Category name"
                onChange={(e) => editName(cat.id, e.target.value)}
                onBlur={() => commitName(cat.id)}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              />
              <span className="catord__count">
                {cat.programCount} program{cat.programCount !== 1 ? "s" : ""}{cat.hidden && " · hidden"}
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
                {PROGRAM_KINDS.map((k) => (<option key={k.code} value={k.code}>{k.label}</option>))}
              </select>
            </label>
            <button
              className="catord__delete"
              disabled={saving}
              title={cat.programCount > 0 ? "Move its programs elsewhere before deleting" : "Delete category"}
              aria-label={`Delete ${cat.name}`}
              onClick={() => remove(cat.id, cat.name, cat.programCount)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="catord__add">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="New category name"
          className="catord__add-input"
          disabled={adding}
        />
        <select
          className="catord__kind-select"
          value={newKind}
          disabled={adding}
          onChange={(e) => setNewKind(e.target.value)}
          aria-label="Kind for the new category"
        >
          <option value="">— kind —</option>
          {PROGRAM_KINDS.map((k) => (<option key={k.code} value={k.code}>{k.label}</option>))}
        </select>
        <button type="button" onClick={add} disabled={adding || !newName.trim()} className="catord__add-btn">
          {adding ? "Adding…" : "+ Add"}
        </button>
      </div>

      {saving && <p className="catord__saving">Saving…</p>}
    </div>
  );
}
