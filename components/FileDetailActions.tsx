/**
 * The interactive header of a file's detail page (RIM_GoogleWorkspace.md,
 * file-detail slice). The document itself is rendered server-side by the page;
 * this component carries the state + actions that live at RIM's layer:
 *
 *  - attribution ("Created by …", with a coordinator/creator "Change" picker),
 *  - the draft toggle (Share with the Space / Hold as draft),
 *  - opening the real Google editor, or downloading a stored file.
 *
 * Every mutation is a PATCH to /api/files/[fileId]; on success we
 * router.refresh() so the server page re-renders with the new state (the
 * body's draft-vs-shared rendering, the attribution line) rather than trying
 * to reconcile it client-side. One dominant action per state.
 *
 * CSS prefix: gf-detail-
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  name: string;
}

interface Props {
  fileId: string;
  /** "Google Doc" | "Spreadsheet" | … — the human file-kind label. */
  kindLabel: string;
  /** Google-native editor file (Doc/Sheet/Slides) → offer "Edit in Google". */
  isGoogleEditor: boolean;
  /** "Docs" | "Sheets" | "Slides" — the editor name for the button label. */
  editorName: string;
  held: boolean;
  /** The viewer created this file (informational — canManage drives controls). */
  mine: boolean;
  /** May the viewer hold/share/re-attribute (creator, coordinator, GT/ADMIN)? */
  canManage: boolean;
  createdByName: string | null;
  createdByUserId: string | null;
  modifiedLabel: string | null;
  /** The Space's members, for the "Change creator" picker. */
  members: Member[];
}

const GENERIC_ERROR = "Something went wrong. Please try again.";

export default function FileDetailActions({
  fileId,
  kindLabel,
  isGoogleEditor,
  editorName,
  held,
  mine,
  canManage,
  createdByName,
  createdByUserId,
  modifiedLabel,
  members,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [pickValue, setPickValue] = useState(createdByUserId ?? "");

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? GENERIC_ERROR);
        return false;
      }
      return true;
    } catch {
      setError(GENERIC_ERROR);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleDraft(action: "hold" | "share") {
    if (await patch({ action })) router.refresh();
  }

  async function saveCreator() {
    if (await patch({ action: "set-creator", creatorUserId: pickValue || null })) {
      setPicking(false);
      router.refresh();
    }
  }

  return (
    <div className="gf-detail__head">
      <p className="gf-detail__meta">
        <span className="gf-detail__kind">{kindLabel}</span>
        <span className="gf-detail__attribution">
          {createdByName ? `Created by ${createdByName}` : "Added directly in Google Drive"}
        </span>
        {modifiedLabel && <span className="gf-detail__updated">Updated {modifiedLabel}</span>}
        {canManage && !picking && (
          <button className="gf-detail__link-btn" onClick={() => setPicking(true)}>
            Change
          </button>
        )}
      </p>

      {picking && (
        <div className="gf-detail__picker">
          <label className="gf-detail__picker-label" htmlFor="gf-creator">
            Created by
          </label>
          <select
            id="gf-creator"
            className="gf-detail__select"
            value={pickValue}
            onChange={(e) => setPickValue(e.target.value)}
            disabled={busy}
          >
            <option value="">Added directly in Google Drive</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <div className="gf-detail__picker-actions">
            <button
              className="gf-detail__btn gf-detail__btn--ghost"
              onClick={() => {
                setPicking(false);
                setPickValue(createdByUserId ?? "");
                setError(null);
              }}
              disabled={busy}
            >
              Cancel
            </button>
            <button className="gf-detail__btn" onClick={saveCreator} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {held && (
        <p className="gf-detail__draft-note">
          <span className="gf-detail__draft-pill">Draft</span>
          {mine
            ? "Only you can see this until you share it with the Space."
            : "A draft — not yet shared with the Space by its creator."}
        </p>
      )}

      <div className="gf-detail__actions">
        {/* One dominant action per state. */}
        {held && canManage && (
          <button
            className="gf-detail__btn gf-detail__btn--primary"
            onClick={() => toggleDraft("share")}
            disabled={busy}
          >
            Share with the Space
          </button>
        )}

        {isGoogleEditor ? (
          <a
            className={`gf-detail__btn${held && canManage ? " gf-detail__btn--ghost" : " gf-detail__btn--primary"}`}
            href={`/api/files/open/${fileId}`}
            target="_blank"
            rel="noopener"
          >
            {editorName ? `Edit in Google ${editorName}` : "Open in Google"}
          </a>
        ) : (
          <a
            className={`gf-detail__btn${held && canManage ? " gf-detail__btn--ghost" : " gf-detail__btn--primary"}`}
            href={`/api/files/stream/${fileId}`}
            target="_blank"
            rel="noopener"
          >
            Download
          </a>
        )}

        {!held && canManage && (
          <button
            className="gf-detail__btn gf-detail__btn--ghost"
            onClick={() => toggleDraft("hold")}
            disabled={busy}
          >
            Hold as draft
          </button>
        )}
      </div>

      {error && (
        <p className="gf-detail__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
