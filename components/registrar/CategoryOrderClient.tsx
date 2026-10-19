"use client";

import { Fragment, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PROGRAM_KINDS } from "@/lib/programKind";
import { ActionNotice, useActionNotice } from "@/components/FormDone";

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
  // The row whose Delete was pressed: its plain-language confirmation shows
  // beneath it, with Cancel.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { notice, say } = useActionNotice();
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
      if (res.ok) {
        router.refresh();
        say("Saved.");
        return true;
      }
      const d = await res.json().catch(() => ({}));
      say(d.error || "That change didn't save. Please try again.", "error");
      return false;
    } catch {
      say("That change didn't save. Please check your connection and try again.", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function setKind(id: string, kind: string) {
    const before = items.find((c) => c.id === id)?.kind ?? null;
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, kind: kind || null } : c)));
    const ok = await patch({ id, kind: kind || null });
    // Put the old kind back, so the page never shows what didn't save.
    if (!ok) setItems((prev) => prev.map((c) => (c.id === id ? { ...c, kind: before } : c)));
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
    else {
      const saved = savedNames.current.get(id) ?? "";
      setItems((prev) => prev.map((c) => (c.id === id ? { ...c, name: saved } : c)));
    }
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
      const res = await fetch(`${API}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((c) => c.id) }),
      });
      if (res.ok) {
        router.refresh();
        say("The new order is saved.");
      } else {
        setItems(prev);
        say("The order didn't change. Please try again.", "error");
      }
    } catch {
      setItems(prev);
      say("The order didn't change. Please check your connection and try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, name: string) {
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
        setConfirmingId(null);
        router.refresh();
        say(`The category "${name}" is deleted.`);
      } else {
        const d = await res.json().catch(() => ({}));
        say(d.error || `"${name}" wasn't deleted. Please try again.`, "error");
      }
    } catch {
      say(`"${name}" wasn't deleted. Please check your connection and try again.`, "error");
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
        say(`The category "${cat.name}" is added at the end of the list.`);
      } else {
        const d = await res.json().catch(() => ({}));
        say(d.error || "The category wasn't added. Please try again.", "error");
      }
    } catch {
      say("The category wasn't added. Please check your connection and try again.", "error");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="catord">
      <h1 className="catord__title">Program Categories</h1>
      <p className="catord__desc">
        These are the <em>old</em> categories, kept until the move to Category and Format is
        verified. They no longer set a program&rsquo;s section on the public Programs &amp; Events
        page: a program&rsquo;s <strong>Category</strong> and <strong>Format</strong> are set in the
        Program Manager, and who may join without registering is its <strong>Open entry</strong>{" "}
        setting on the Registration tab. A category&rsquo;s <strong>kind</strong> now decides access
        only for a program whose Open entry has never been set; hiding a category still hides its
        programs from the public page. Changes save as you go.
      </p>

      <div className="catord__list">
        {items.map((cat, i) => (
          <Fragment key={cat.id}>
          <div className={`catord__row${cat.hidden ? " catord__row--hidden" : ""}`}>
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
              aria-expanded={confirmingId === cat.id}
              onClick={() => setConfirmingId(confirmingId === cat.id ? null : cat.id)}
            >
              ×
            </button>
          </div>
          {confirmingId === cat.id && (
            <div className="adm2-danger-confirm">
              {cat.programCount > 0 ? (
                <>
                  <p className="adm2-danger-confirm__msg">
                    &ldquo;{cat.name}&rdquo; still has {cat.programCount} program{cat.programCount !== 1 ? "s" : ""} in
                    it. Move {cat.programCount !== 1 ? "them" : "it"} to another category first, then you can delete it.
                  </p>
                  <div className="adm2-danger-confirm__actions">
                    <button type="button" className="adm2-btn--neutral" onClick={() => setConfirmingId(null)}>
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="adm2-danger-confirm__msg">
                    Delete the category &ldquo;{cat.name}&rdquo;? This can&rsquo;t be undone.
                  </p>
                  <div className="adm2-danger-confirm__actions">
                    <button
                      type="button"
                      className="adm2-btn--danger"
                      disabled={saving}
                      onClick={() => remove(cat.id, cat.name)}
                    >
                      {saving ? "Deleting…" : "Delete category"}
                    </button>
                    <button type="button" className="adm2-btn--neutral" disabled={saving} onClick={() => setConfirmingId(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          </Fragment>
        ))}
      </div>

      <div className="catord__add">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="New category name"
          aria-label="New category name"
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
      <ActionNotice notice={notice} onClose={() => say(null)} />
    </div>
  );
}
