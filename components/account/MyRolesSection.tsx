"use client";

/**
 * MyRolesSection — account profile page.
 *
 * Lets the member manage their RoleProfile records. Each profile is a
 * title + optional roleKey (from lib/roleKeys.ts) + Message-type description.
 *
 * Placement registered in lib/editorRegistry.ts as `role-profile-description`.
 */

import { useState } from "react";
import RimProseEditor from "@/components/RimProseEditor";
import { ROLE_KEY_VALUES, labelForRoleKey } from "@/lib/roleKeys";

interface RoleProfile {
  id: string;
  title: string;
  description: unknown;
  roleKey: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

interface Props {
  initialProfiles: RoleProfile[];
}

export default function MyRolesSection({ initialProfiles }: Props) {
  const [profiles, setProfiles] = useState<RoleProfile[]>(initialProfiles);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<RoleProfile>>>({});
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newRoleKey, setNewRoleKey] = useState<string>("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function getDraft(p: RoleProfile): RoleProfile {
    return { ...p, ...(drafts[p.id] ?? {}) };
  }

  function updateDraft(id: string, patch: Partial<RoleProfile>) {
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? {}), ...patch } }));
  }

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) {
      setError("Please enter a title.");
      return;
    }
    setError("");
    setBusyId("__new");
    try {
      const res = await fetch("/api/account/role-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          roleKey: newRoleKey || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setProfiles((p) => [...p, data.profile]);
      setOpenId(data.profile.id);
      setNewTitle("");
      setNewRoleKey("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSave(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    setError("");
    setBusyId(id);
    try {
      const res = await fetch(`/api/account/role-profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setProfiles((arr) => arr.map((p) => (p.id === id ? data.profile : p)));
      setDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this role profile? This cannot be undone.")) return;
    setError("");
    setBusyId(id);
    try {
      const res = await fetch(`/api/account/role-profiles/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setProfiles((arr) => arr.filter((p) => p.id !== id));
      setDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      if (openId === id) setOpenId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  const usedKeys = new Set(profiles.map((p) => p.roleKey).filter(Boolean) as string[]);

  return (
    <section className="mp-section mp-roles">
      <p className="mp-section__title">My roles</p>
      <p className="mp-section__hint">
        Describe the roles you hold at RIM. Each role has its own description
        and can be referenced in the appropriate hub.
      </p>

      {error && <p className="mp-save__error">{error}</p>}

      {profiles.length === 0 && !adding && (
        <p className="mp-roles__empty">No role descriptions yet.</p>
      )}

      <ul className="mp-roles__list">
        {profiles.map((p) => {
          const draft = getDraft(p);
          const isOpen = openId === p.id;
          const busy = busyId === p.id;
          const hasChanges = !!drafts[p.id];
          return (
            <li key={p.id} className="mp-role">
              <div className="mp-role__header">
                <button
                  type="button"
                  className="mp-role__toggle"
                  onClick={() => setOpenId(isOpen ? null : p.id)}
                  aria-expanded={isOpen}
                >
                  <span className="mp-role__title">{draft.title}</span>
                  {draft.roleKey && (
                    <span className="mp-role__tag">
                      {labelForRoleKey(draft.roleKey)}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="mp-role__delete"
                  onClick={() => handleDelete(p.id)}
                  disabled={busy}
                  aria-label="Delete role profile"
                >
                  Delete
                </button>
              </div>

              {isOpen && (
                <div className="mp-role__body">
                  <div className="mp-field">
                    <label className="mp-label">Title</label>
                    <input
                      className="mp-input"
                      type="text"
                      value={draft.title}
                      onChange={(e) =>
                        updateDraft(p.id, { title: e.target.value })
                      }
                    />
                  </div>
                  <div className="mp-field">
                    <label className="mp-label">Role key (optional)</label>
                    <select
                      className="mp-input"
                      value={draft.roleKey ?? ""}
                      onChange={(e) =>
                        updateDraft(p.id, {
                          roleKey: e.target.value || null,
                        })
                      }
                    >
                      <option value="">— None —</option>
                      {ROLE_KEY_VALUES.map((k) => (
                        <option
                          key={k}
                          value={k}
                          disabled={k !== p.roleKey && usedKeys.has(k)}
                        >
                          {labelForRoleKey(k)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mp-field">
                    <label className="mp-label">Description</label>
                    <RimProseEditor
                      value={
                        Array.isArray(draft.description)
                          ? draft.description
                          : null
                      }
                      onChange={(v: unknown) =>
                        updateDraft(p.id, { description: v })
                      }
                      placeholder="Describe this role in your own words…"
                      minHeight={140}
                    />
                  </div>
                  <div className="mp-save">
                    <button
                      type="button"
                      className="mp-save__btn"
                      onClick={() => handleSave(p.id)}
                      disabled={busy || !hasChanges}
                    >
                      {busy ? "Saving…" : "Save role"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {adding ? (
        <div className="mp-role mp-role--new">
          <div className="mp-role__body">
            <div className="mp-field">
              <label className="mp-label">Title</label>
              <input
                className="mp-input"
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Guiding Teacher"
                autoFocus
              />
            </div>
            <div className="mp-field">
              <label className="mp-label">Role key (optional)</label>
              <select
                className="mp-input"
                value={newRoleKey}
                onChange={(e) => setNewRoleKey(e.target.value)}
              >
                <option value="">— None —</option>
                {ROLE_KEY_VALUES.map((k) => (
                  <option
                    key={k}
                    value={k}
                    disabled={usedKeys.has(k)}
                  >
                    {labelForRoleKey(k)}
                  </option>
                ))}
              </select>
            </div>
            <div className="mp-save">
              <button
                type="button"
                className="mp-save__btn"
                onClick={handleCreate}
                disabled={busyId === "__new"}
              >
                {busyId === "__new" ? "Adding…" : "Add role"}
              </button>
              <button
                type="button"
                className="mp-role__cancel"
                onClick={() => {
                  setAdding(false);
                  setNewTitle("");
                  setNewRoleKey("");
                  setError("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="mp-roles__add"
          onClick={() => setAdding(true)}
        >
          + Add a role
        </button>
      )}
    </section>
  );
}
