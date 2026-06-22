"use client";

/**
 * HubDocCategoryManager — the coordinator curation surface for a hub's document
 * categories. CSS prefix: hub-doc-cat-mgr- (reuses the notify-modal shell).
 *
 * The cleanup half of the "tended, not gated" model (RIM_Documents.md §5):
 * rename, merge (rename into an existing name), reorder, and remove. Members
 * still mint categories inline while filing a doc — this is where the list gets
 * kept clean. All operations go through /api/hub/[slug]/document-categories,
 * which cascades to HubDocument.category and is coordinator-gated server-side.
 *
 * Parent sync: onChange updates the hub's category list; onRecategorize re-files
 * the affected docs in the open list (rename → new name, remove → null) so the
 * grouped view stays correct without a reload.
 */

import { useState } from "react";

interface Props {
  hubSlug: string;
  categories: string[];
  onChange: (categories: string[]) => void;
  onRecategorize: (from: string, to: string | null) => void;
  onClose: () => void;
}

function normalize(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

export default function HubDocCategoryManager({
  hubSlug,
  categories,
  onChange,
  onRecategorize,
  onClose,
}: Props) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/hub/${hubSlug}/document-categories`;

  async function addCategory() {
    const name = normalize(newCat);
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add the category");
      onChange(data.categories);
      setNewCat("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the category");
    } finally {
      setBusy(false);
    }
  }

  function startRename(cat: string) {
    setRenaming(cat);
    setRenameDraft(cat);
    setError(null);
  }

  async function saveRename(cat: string) {
    const next = normalize(renameDraft);
    if (busy) return;
    if (!next || next === cat) { setRenaming(null); return; }

    // Renaming into an existing name merges — confirm, because docs move.
    const collision = categories.find(
      (c) => c !== cat && c.toLowerCase() === next.toLowerCase(),
    );
    if (collision && !window.confirm(
      `“${collision}” already exists. Merge “${cat}” into it? Documents filed under “${cat}” will move to “${collision}”.`
    )) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", oldName: cat, newName: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not rename the category");
      onChange(data.categories);
      onRecategorize(cat, data.renamedTo ?? next);
      setRenaming(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename the category");
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(cat: string) {
    if (busy) return;
    if (!window.confirm(
      `Remove “${cat}”? Documents filed under it become uncategorized — they're not deleted.`
    )) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}?name=${encodeURIComponent(cat)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not remove the category");
      onChange(data.categories);
      onRecategorize(cat, null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove the category");
    } finally {
      setBusy(false);
    }
  }

  async function reorder(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (busy || target < 0 || target >= categories.length) return;
    const order = [...categories];
    [order[index], order[target]] = [order[target], order[index]];
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", order }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not reorder");
      onChange(data.categories);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reorder");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hub-doc-notify-overlay" onClick={onClose}>
      <div className="hub-doc-notify-modal hub-doc-cat-mgr" onClick={(e) => e.stopPropagation()}>
        <div className="hub-doc-notify-modal__header">
          <strong>Manage categories</strong>
          <button className="btn--ghost btn--xs" onClick={onClose}>Done</button>
        </div>

        <p className="hub-doc-cat-mgr__hint">
          Rename, reorder, or remove. Renaming into an existing name merges the two.
          Members can still add a category when filing a document.
        </p>

        {error && <p className="hub-doc-cat-mgr__error">{error}</p>}

        {categories.length === 0 ? (
          <p className="hub-doc-cat-mgr__empty">No categories yet.</p>
        ) : (
          <ul className="hub-doc-cat-mgr__list">
            {categories.map((cat, i) => (
              <li key={cat} className="hub-doc-cat-mgr__row">
                {renaming === cat ? (
                  <>
                    <input
                      className="fi hub-doc-cat-mgr__input"
                      type="text"
                      value={renameDraft}
                      autoFocus
                      maxLength={40}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename(cat);
                        if (e.key === "Escape") setRenaming(null);
                      }}
                    />
                    <button className="hub-action-btn" onClick={() => saveRename(cat)} disabled={busy}>Save</button>
                    <button className="hub-action-btn" onClick={() => setRenaming(null)} disabled={busy}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="hub-doc-cat-mgr__name">{cat}</span>
                    <div className="hub-doc-cat-mgr__reorder">
                      <button
                        className="hub-doc-cat-mgr__arrow"
                        onClick={() => reorder(i, -1)}
                        disabled={busy || i === 0}
                        aria-label={`Move ${cat} up`}
                      >↑</button>
                      <button
                        className="hub-doc-cat-mgr__arrow"
                        onClick={() => reorder(i, 1)}
                        disabled={busy || i === categories.length - 1}
                        aria-label={`Move ${cat} down`}
                      >↓</button>
                    </div>
                    <button className="hub-action-btn" onClick={() => startRename(cat)} disabled={busy}>Rename</button>
                    <button className="hub-action-btn hub-action-btn--del" onClick={() => removeCategory(cat)} disabled={busy}>Remove</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="hub-doc-cat-mgr__add">
          <input
            className="fi hub-doc-cat-mgr__input"
            type="text"
            value={newCat}
            maxLength={40}
            placeholder="New category name"
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }}
          />
          <button className="btn btn--sm" onClick={addCategory} disabled={busy || !newCat.trim()}>Add</button>
        </div>
      </div>
    </div>
  );
}
