"use client";

/**
 * The team's own line under its name on Home (Hub.description), and its
 * editor for the team's leads (Jesse, 2026-10-13): plainly offered, one line,
 * answered beside its button (SaveNote, one status region that stays mounted
 * so the answer is announced). Focus returns to the edit button after saving
 * or cancelling. Saved by PATCH /api/hubs/[slug]/home.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SaveNote } from "@/components/FormDone";

export const TEAM_LINE_FALLBACK = "Your team’s shared space.";

export function TeamLine({
  slug,
  line,
  canEdit,
}: {
  slug: string;
  line: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  // What is shown: the saved line, updated from the response at once (the
  // page refresh catches up after).
  const [shown, setShown] = useState<string | null>(line);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(line ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const editButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (!editing && returnFocus.current) {
      returnFocus.current = false;
      editButton.current?.focus();
    }
  }, [editing]);

  function close() {
    returnFocus.current = true;
    setEditing(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch(`/api/hubs/${slug}/home`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: value }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json().catch(() => ({}));
      const saved = typeof data.description === "string" ? data.description : null;
      setShown(saved);
      setValue(saved ?? "");
      setStatus("saved");
      close();
      router.refresh();
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="hub-line">
      {editing ? (
        <form className="hub-line__form" onSubmit={save}>
          <label className="pp-form__label" htmlFor="hub-line-input">
            The line under your team&rsquo;s name
          </label>
          <input
            id="hub-line-input"
            className="pp-form__input"
            type="text"
            maxLength={200}
            value={value}
            placeholder={TEAM_LINE_FALLBACK}
            onChange={(e) => {
              setValue(e.target.value);
              setStatus("idle");
            }}
            autoFocus
          />
          <p className="pp-form__help">
            One sentence about this team, for everyone on it. Leave it empty to show &ldquo;{TEAM_LINE_FALLBACK}&rdquo;
          </p>
          <div className="hub-line__actions">
            <button type="submit" className="pp-btn" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="pp-btn pp-btn--ghost"
              disabled={saving}
              onClick={() => {
                setValue(shown ?? "");
                setStatus("idle");
                close();
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="ac-page-sub hub-line__text">{shown || TEAM_LINE_FALLBACK}</p>
          {canEdit && (
            <button
              ref={editButton}
              type="button"
              className="hub-line__edit"
              onClick={() => {
                setStatus("idle");
                setEditing(true);
              }}
            >
              {shown ? "Edit this line" : "Write this team’s line"}
            </button>
          )}
        </>
      )}
      {canEdit && (
        <SaveNote
          status={saving ? "saving" : status}
          saved="Saved. Everyone on this team sees the new line."
          problem="Your line was not saved. It is still here. Please try again."
        />
      )}
    </div>
  );
}
