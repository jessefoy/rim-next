"use client";

/**
 * RotationConflictModal — shown after a coordinator saves a rotation. Calls
 * /api/host/standing-assignments/preview to find out what the rotation would
 * fill vs. what conflicts with existing assignments. Lets the coordinator
 * pick a resolution mode and commits via /apply.
 *
 * Three resolution paths:
 *   1. Leave conflicts as-is (fill only open slots)
 *   2. Replace all conflicts (override every existing assignment that isn't sub-cover)
 *   3. Decide per-date (toggle Keep/Replace on each conflict row)
 *
 * Sub-cover assignments are always protected — shown but not togglable.
 */

import { useState, useEffect, useRef } from "react";

interface OpenSession {
  dateStr:      string;
  dateLabel:    string;
  programSlug:  string;
  programName:  string;
  proposedHost: { userId: string; displayName: string };
}

interface Conflict {
  dateStr:           string;
  dateLabel:         string;
  programSlug:       string;
  programName:       string;
  proposedHost:      { userId: string; displayName: string };
  currentHost:       { userId: string | null; displayName: string };
  source:            "standing-self" | "standing-other" | "manual" | "sub-cover";
  protected:         boolean;
  hostAssignmentId:  string;
}

interface Preview {
  openSessions: OpenSession[];
  conflicts:    Conflict[];
  pastIgnored:  number;
}

type Mode = "leave" | "replace-all" | "perDate";

interface Props {
  /** v3: scope by (programSlug, dayOfWeek) bundle. */
  programSlug: string;
  dayOfWeek?:  string;
  /** Hub that owns this rotation (session 140). Without it the preview/apply
   *  default to host-team and an edit in an AV/greeter/peer-led hub would
   *  reach across hubs. Every other Scheduler route already scopes by hub. */
  hubSlug?:    string;
  /** v2 back-compat: scope by single rotation id. */
  standingId?: string;
  year:        number;
  month:       number;
  onClose:     () => void;
  /** Fired after the apply call succeeds — parent uses this to refresh dependent
   *  views (e.g. the Schedule's local sessions cache). */
  onApplied?:  () => void;
}

const SOURCE_LABEL: Record<Conflict["source"], string> = {
  "standing-self":  "via this rotation",
  "standing-other": "via another rotation",
  "manual":         "manually assigned",
  "sub-cover":      "sub-cover (protected)",
};

/**
 * A conflict is shielded from "Replace all" when it's sub-cover (already
 * protected) or a manual self-claim someone deliberately picked — override
 * those via "Decide one by one". Single source of truth so the summary count
 * and the per-row decision can't drift apart (session 140).
 */
const isShieldedFromReplaceAll = (c: Conflict) => c.protected || c.source === "manual";

export default function RotationConflictModal({ standingId, programSlug, dayOfWeek, hubSlug, year, month, onClose, onApplied }: Props) {
  const [preview, setPreview]     = useState<Preview | null>(null);
  const [loading, setLoading]     = useState(true);
  // A preview that couldn't load ends the dialog's use; an apply that
  // failed does not: the preview and Apply stay so the person can retry.
  const [error, setError]         = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [mode, setMode]           = useState<Mode>("leave");
  const [perDate, setPerDate]     = useState<Record<string, "keep" | "replace">>({});
  const [applying, setApplying]   = useState(false);
  const [result, setResult]       = useState<{ filled: number; replaced: number; kept: number } | null>(null);

  // ── Load preview on mount ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/host/standing-assignments/preview", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ standingId, programSlug, dayOfWeek, hubSlug, year, month }),
        });
        if (!res.ok) throw new Error("preview failed");
        const data: Preview = await res.json();
        setPreview(data);
        // Default per-date map: keep all (so toggling to perDate doesn't accidentally replace)
        const init: Record<string, "keep" | "replace"> = {};
        for (const c of data.conflicts) {
          init[c.dateStr] = c.protected ? "keep" : "keep";
        }
        setPerDate(init);
      } catch {
        setError("Could not load preview. Please close and try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [standingId, programSlug, dayOfWeek, hubSlug, year, month]);

  // ── Apply ──────────────────────────────────────────────────────────────
  const handleApply = async () => {
    setApplying(true);
    setApplyError(null);

    let resolution: unknown;
    if (mode === "leave")        resolution = "leave";
    else if (mode === "replace-all") resolution = "replace-all";
    else                         resolution = { perDate };

    try {
      const res = await fetch("/api/host/standing-assignments/apply", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ standingId, programSlug, dayOfWeek, hubSlug, year, month, resolution }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setApplyError(
          body && typeof body.error === "string" && body.error
            ? `The rotation wasn't applied: ${body.error} Your choices are still here, so you can press Apply again.`
            : "The rotation wasn't applied. Your choices are still here, so you can press Apply again.",
        );
        return;
      }
      const data = await res.json();
      setResult({ filled: data.filled, replaced: data.replaced, kept: data.kept });
      onApplied?.();
    } catch {
      setApplyError("Couldn't reach the server, so the rotation wasn't applied. Your choices are still here, so you can press Apply again.");
    } finally {
      setApplying(false);
    }
  };

  const togglePerDate = (dateStr: string) => {
    setPerDate((prev) => ({
      ...prev,
      [dateStr]: prev[dateStr] === "replace" ? "keep" : "replace",
    }));
  };

  // ── Dialog behaviour: focus moves in, Escape closes, focus returns ─────
  const closeRef = useRef<HTMLButtonElement>(null);
  const applyingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    applyingRef.current = applying;
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !applyingRef.current) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="hs-cmodal-backdrop" role="dialog" aria-modal="true" aria-labelledby="hs-cmodal-title">
      <div className="hs-cmodal">
        {/* HEADER */}
        <div className="hs-cmodal__head">
          <h2 className="hs-cmodal__title" id="hs-cmodal-title">
            {result ? "Done" : "Apply rotation"}
          </h2>
          <button className="hs-cmodal__close" ref={closeRef} onClick={onClose} disabled={applying} aria-label="Close">×</button>
        </div>

        {/* BODY */}
        <div className="hs-cmodal__body">
          {loading && <p className="hs-cmodal__loading">Looking at the schedule…</p>}

          {error && <p className="hs-cmodal__error" role="alert">{error}</p>}

          {result && (
            <div className="hs-cmodal__result">
              <p>
                <strong>Done.</strong> Filled <strong>{result.filled}</strong>,
                {" "}replaced <strong>{result.replaced}</strong>, kept <strong>{result.kept}</strong>.
              </p>
              <button className="hs-cmodal__done" onClick={onClose}>Close</button>
            </div>
          )}

          {!loading && preview && !result && (
            <>
              {/* SUMMARY */}
              <div className="hs-cmodal__summary">
                {preview.openSessions.length > 0 && (
                  <p className="hs-cmodal__summary-line">
                    <strong>{preview.openSessions.length}</strong> open future session
                    {preview.openSessions.length === 1 ? "" : "s"} will be filled.
                  </p>
                )}
                {preview.conflicts.length > 0 && (
                  <p className="hs-cmodal__summary-line">
                    <strong>{preview.conflicts.length}</strong> future session
                    {preview.conflicts.length === 1 ? " is" : "s are"} already
                    assigned. Choose what to do below.
                  </p>
                )}
                {preview.openSessions.length === 0 && preview.conflicts.length === 0 && (
                  <p className="hs-cmodal__summary-line">
                    Nothing to do this month. Every future session that matches this rotation is already covered.
                  </p>
                )}
                {preview.pastIgnored > 0 && (
                  <p className="hs-cmodal__summary-meta">
                    {preview.pastIgnored} past session{preview.pastIgnored === 1 ? "" : "s"} ignored — past is never modified.
                  </p>
                )}
              </div>

              {/* OPEN SESSIONS PREVIEW (always informational, no choice) */}
              {preview.openSessions.length > 0 && (
                <div className="hs-cmodal__open">
                  <h3 className="hs-cmodal__section-h">Will be filled</h3>
                  <ul className="hs-cmodal__list">
                    {preview.openSessions.map((s) => (
                      <li key={s.dateStr} className="hs-cmodal__row hs-cmodal__row--open">
                        <span className="hs-cmodal__date">{s.dateLabel}</span>
                        <span className="hs-cmodal__arrow">→</span>
                        <span className="hs-cmodal__name">{s.proposedHost.displayName}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* CONFLICTS — mode selector + list */}
              {preview.conflicts.length > 0 && (
                <div className="hs-cmodal__conflicts">
                  <h3 className="hs-cmodal__section-h">Conflicts</h3>

                  {/* Plain-language read of what "Replace all" would do, so
                      the outcome is legible before the coordinator commits
                      (session 140). */}
                  {(() => {
                    const protectedCount = preview.conflicts.filter(isShieldedFromReplaceAll).length;
                    const replaceable = preview.conflicts.length - protectedCount;
                    return (
                      <p className="hs-cmodal__summary-meta">
                        {replaceable} can be replaced
                        {protectedCount > 0
                          ? ` · ${protectedCount} protected (sub-cover or self-assigned) and kept unless you override them one by one`
                          : ""}.
                      </p>
                    );
                  })()}

                  <div className="hs-cmodal__modes" role="radiogroup" aria-label="Conflict resolution">
                    <label className={`hs-cmodal__mode${mode === "leave" ? " hs-cmodal__mode--active" : ""}`}>
                      <input
                        type="radio"
                        name="resolution"
                        value="leave"
                        checked={mode === "leave"}
                        onChange={() => setMode("leave")}
                      />
                      <span className="hs-cmodal__mode-label">
                        <strong>Leave them alone</strong>
                        <span className="hs-cmodal__mode-hint">Fill only the open slots. The people already scheduled keep these dates.</span>
                      </span>
                    </label>
                    <label className={`hs-cmodal__mode${mode === "replace-all" ? " hs-cmodal__mode--active" : ""}`}>
                      <input
                        type="radio"
                        name="resolution"
                        value="replace-all"
                        checked={mode === "replace-all"}
                        onChange={() => setMode("replace-all")}
                      />
                      <span className="hs-cmodal__mode-label">
                        <strong>Replace all</strong>
                        <span className="hs-cmodal__mode-hint">Override every conflict. Sub-cover and manually self-assigned dates are protected — switch to one-by-one to override those.</span>
                      </span>
                    </label>
                    <label className={`hs-cmodal__mode${mode === "perDate" ? " hs-cmodal__mode--active" : ""}`}>
                      <input
                        type="radio"
                        name="resolution"
                        value="perDate"
                        checked={mode === "perDate"}
                        onChange={() => setMode("perDate")}
                      />
                      <span className="hs-cmodal__mode-label">
                        <strong>Decide one by one</strong>
                        <span className="hs-cmodal__mode-hint">Toggle each date below.</span>
                      </span>
                    </label>
                  </div>

                  <ul className="hs-cmodal__list hs-cmodal__list--conflicts">
                    {preview.conflicts.map((c) => {
                      const decision = mode === "replace-all" && !isShieldedFromReplaceAll(c)
                        ? "replace"
                        : mode === "perDate"
                          ? perDate[c.dateStr] ?? "keep"
                          : "keep";
                      return (
                        <li key={c.dateStr} className={`hs-cmodal__row hs-cmodal__row--conflict${decision === "replace" ? " hs-cmodal__row--will-replace" : ""}`}>
                          <span className="hs-cmodal__date">{c.dateLabel}</span>
                          <span className="hs-cmodal__current">
                            {c.currentHost.displayName}
                            <span className="hs-cmodal__source">{SOURCE_LABEL[c.source]}</span>
                          </span>
                          {mode === "perDate" ? (
                            <button
                              type="button"
                              className={`hs-cmodal__toggle${decision === "replace" ? " hs-cmodal__toggle--replace" : ""}`}
                              onClick={() => !c.protected && togglePerDate(c.dateStr)}
                              disabled={c.protected}
                              aria-pressed={decision === "replace"}
                            >
                              {c.protected
                                ? "Protected"
                                : decision === "replace"
                                  ? `Replace with ${c.proposedHost.displayName}`
                                  : `Keep ${c.currentHost.displayName}`}
                            </button>
                          ) : (
                            <span className="hs-cmodal__decision">
                              {c.protected
                                ? "(protected — kept)"
                                : decision === "replace"
                                  ? `→ ${c.proposedHost.displayName}`
                                  : "(keeping)"}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        {!result && (
          <div className="hs-cmodal__foot">
            {applyError && (
              <p className="hs-cmodal__error" role="alert" style={{ flex: "1 1 auto", alignSelf: "center" }}>
                {applyError}
              </p>
            )}
            <button className="hs-cmodal__cancel" onClick={onClose} disabled={applying}>
              Cancel
            </button>
            {!loading && preview && (
              <button
                className="hs-cmodal__apply"
                onClick={handleApply}
                disabled={applying || (preview.openSessions.length === 0 && preview.conflicts.length === 0)}
              >
                {applying ? "Applying…" : "Apply"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
