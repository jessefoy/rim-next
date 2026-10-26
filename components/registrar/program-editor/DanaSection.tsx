"use client";

/** Dana: how dana works for this program, its amounts, the message in the
 *  dana step, and the note on the program page. One of the program editor's
 *  seven sections. */

import { memo, useEffect, useState } from "react";
import { isHtmlString, renderBlockNoteHtml } from "@/lib/renderRichContent";
import { EditorSection, RimTiptapEditor, type Setter } from "./shared";

/* ── Dana message templates ────────────────────────────────────────────────
   Built-in templates are plain strings converted to BlockNote JSON on load.
   Custom templates are saved as BlockNote JSON to localStorage.
   ── */

/** Wrap a plain string in a single HTML paragraph. */
function textToHtml(text: string): string {
  // Minimal HTML escape for the few characters that matter inside a <p>.
  const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<p>${safe}</p>`;
}

const DANA_BUILTIN: { name: string; text: string }[] = [
  {
    name: "General support",
    text: "Your dana makes this program possible. RIM is supported entirely by the generosity of our community. Every amount is welcome.",
  },
  {
    name: "Reciprocity",
    text: "This is an old practice of reciprocity: the teachings are offered freely, and we give back as we are able. All amounts are welcome.",
  },
  {
    name: "Sliding scale / no one turned away",
    text: "We offer this program on a sliding scale so it is accessible to everyone. Please offer an amount that reflects both your means and your appreciation for the teaching. No one is turned away for lack of funds.",
  },
];

const DANA_LS_KEY = "rim_dana_templates";
const DANA_LS_HIDDEN_KEY = "rim_dana_templates_hidden";

function loadDanaTemplates(): { name: string; content: string }[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(DANA_LS_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    // Convert any legacy BlockNote-JSON content to HTML strings on read.
    return raw.map((t: { name: string; content: unknown }) => ({
      name: t.name,
      content: isHtmlString(t.content) ? t.content : (renderBlockNoteHtml(t.content) || ""),
    }));
  } catch { return []; }
}
function loadHiddenBuiltins(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(DANA_LS_HIDDEN_KEY) ?? "[]"); }
  catch { return []; }
}

function DanaTemplateSelector({ onLoad, value }: { onLoad: (v: string) => void; value: string }) {
  const [saved, setSaved] = useState<{ name: string; content: string }[]>([]);
  const [hiddenBuiltins, setHiddenBuiltins] = useState<string[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [lastLoadedName, setLastLoadedName] = useState("");

  useEffect(() => {
    setSaved(loadDanaTemplates());
    setHiddenBuiltins(loadHiddenBuiltins());
  }, []);

  const hasContent = value.replace(/<[^>]+>/g, "").trim().length > 0;
  const visibleBuiltins = DANA_BUILTIN.filter((t) => !hiddenBuiltins.includes(t.name));
  const allHidden = visibleBuiltins.length === 0;

  function load(content: string, name: string) {
    setLastLoadedName(name);
    onLoad(content);
  }

  function saveTemplate() {
    const name = saveName.trim();
    if (!name || !hasContent) return;
    const base = loadDanaTemplates();
    const updated = [...base.filter((t) => t.name !== name), { name, content: value }];
    localStorage.setItem(DANA_LS_KEY, JSON.stringify(updated));
    setSaved(updated);
    setSaveName("");
    setShowSave(false);
  }

  function deleteCustom(name: string) {
    const updated = saved.filter((t) => t.name !== name);
    localStorage.setItem(DANA_LS_KEY, JSON.stringify(updated));
    setSaved(updated);
  }

  function hideBuiltin(name: string) {
    const updated = [...hiddenBuiltins, name];
    localStorage.setItem(DANA_LS_HIDDEN_KEY, JSON.stringify(updated));
    setHiddenBuiltins(updated);
  }

  function restoreBuiltins() {
    localStorage.removeItem(DANA_LS_HIDDEN_KEY);
    setHiddenBuiltins([]);
  }

  const hasAnyTemplates = visibleBuiltins.length > 0 || saved.length > 0;

  return (
    <div className="pe-template-bar">
      {/* Header: label + save button */}
      <div className="pe-template-bar__header">
        <span className="pe-template-bar__label">Templates</span>
        <button
          type="button"
          className="app-act"
          onClick={() => { setShowSave((s) => !s); setSaveName(lastLoadedName); }}
          disabled={!hasContent}
          title="Save what's currently in the editor as a reusable template"
        >
          + Save current
        </button>
      </div>

      {/* Save name input */}
      {showSave && (
        <div className="pe-template-bar__save-row">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Template name…"
            aria-label="Template name"
            className="pe-input pe-template-bar__name-input"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveTemplate(); } }}
            autoFocus
          />
          <button type="button" className="pe-btn pe-btn--primary" onClick={saveTemplate} disabled={!saveName.trim()}>Save</button>
          <button type="button" className="app-act" onClick={() => setShowSave(false)}>Cancel</button>
        </div>
      )}

      {/* Chips */}
      {hasAnyTemplates && (
        <div className="pe-template-bar__chips">
          {visibleBuiltins.map((t) => (
            <span key={t.name} className="pe-template-chip pe-template-chip--builtin">
              <button type="button" className="pe-template-chip__name" onClick={() => load(textToHtml(t.text), t.name)}>{t.name}</button>
              <button type="button" className="pe-template-chip__delete" onClick={() => hideBuiltin(t.name)} title="Remove" aria-label={`Remove the template ${t.name}`}>×</button>
            </span>
          ))}
          {saved.map((t) => (
            <span key={t.name} className="pe-template-chip">
              <button type="button" className="pe-template-chip__name" onClick={() => load(t.content, t.name)}>{t.name}</button>
              <button type="button" className="pe-template-chip__delete" onClick={() => deleteCustom(t.name)} title="Delete" aria-label={`Delete the template ${t.name}`}>×</button>
            </span>
          ))}
        </div>
      )}
      {allHidden && (
        <button type="button" className="app-act" onClick={restoreBuiltins}>Restore default templates</button>
      )}
    </div>
  );
}

interface Props {
  danaMode: string;
  setDanaMode: Setter<string>;
  suggestedDana: string;
  setSuggestedDana: Setter<string>;
  danaBaseAmount: string;
  setDanaBaseAmount: Setter<string>;
  danaFixedAmount: string;
  setDanaFixedAmount: Setter<string>;
  danaMessage: string;
  setDanaMessage: Setter<string>;
  danaText: string;
  setDanaText: Setter<string>;
  markDirty: () => void;
}

function DanaSection({
  danaMode, setDanaMode,
  suggestedDana, setSuggestedDana,
  danaBaseAmount, setDanaBaseAmount,
  danaFixedAmount, setDanaFixedAmount,
  danaMessage, setDanaMessage,
  danaText, setDanaText,
  markDirty,
}: Props) {
  const [danaEditorKey, setDanaEditorKey] = useState(0);

  return (
    <EditorSection id="dana">
      <div className="pe-form">
        <div className="pe-field">
          <span className="pe-field__label">Dana Mode</span>
          <span className="pe-field__help">How donations work for this program. &lsquo;Voluntary&rsquo; lets people give any amount. &lsquo;Base + Dana&rsquo; sets a minimum. &lsquo;Fixed&rsquo; sets an exact amount. &lsquo;None&rsquo; skips the donation step entirely.</span>
          <div className="pe-option-cards">
            {[
              { value: "none", label: "None" },
              { value: "voluntary", label: "Voluntary" },
              { value: "base_plus_dana", label: "Base + Dana" },
              { value: "fixed", label: "Fixed" },
            ].map((opt) => (
              <label key={opt.value} className={`pe-option-card${danaMode === opt.value ? " pe-option-card--active" : ""}`}>
                <input type="radio" name="danaMode" checked={danaMode === opt.value} onChange={() => setDanaMode(opt.value)} />
                <span className="pe-option-card__mark" />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {(danaMode === "voluntary" || danaMode === "base_plus_dana") && (
          <label className="pe-field">
            <span className="pe-field__label">Suggested Amount ($)</span>
            <span className="pe-field__help">Voluntary mode: a suggested donation amount shown during registration. Participants can change it.</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={suggestedDana}
              onChange={(e) => setSuggestedDana(e.target.value)}
              className="pe-input pe-input--narrow"
            />
          </label>
        )}

        {danaMode === "base_plus_dana" && (
          <label className="pe-field">
            <span className="pe-field__label">Base Amount ($)</span>
            <span className="pe-field__help">Base + Dana mode: the minimum amount. Participants can add more on top of this.</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={danaBaseAmount}
              onChange={(e) => setDanaBaseAmount(e.target.value)}
              className="pe-input pe-input--narrow"
            />
          </label>
        )}

        {danaMode === "fixed" && (
          <label className="pe-field">
            <span className="pe-field__label">Fixed Amount ($)</span>
            <span className="pe-field__help">Fixed mode: the exact amount charged. Participants cannot change it.</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={danaFixedAmount}
              onChange={(e) => setDanaFixedAmount(e.target.value)}
              className="pe-input pe-input--narrow"
            />
          </label>
        )}

        {danaMode !== "none" && (
          <>
            <div className="pe-field">
              <span className="pe-field__label">Dana Step Message</span>
              <span className="pe-field__help">Shown during the donation step of registration. Use this to explain how dana supports RIM.</span>
              <DanaTemplateSelector
                value={danaMessage}
                onLoad={(v) => {
                  setDanaMessage(v);
                  setDanaEditorKey((k) => k + 1); // remount editor with new content
                  markDirty();
                }}
              />
              <RimTiptapEditor
                key={danaEditorKey}
                value={danaMessage}
                onChange={(v) => { setDanaMessage(v); markDirty(); }}
                placeholder="Describe how dana supports RIM and what participants should know…"
                variant="message"
              />
            </div>

            <label className="pe-field">
              <span className="pe-field__label">Program Page Dana Note</span>
              <span className="pe-field__help">Shown on the public program page near the registration form: a brief note about the dana model for this program.</span>
              <textarea
                value={danaText}
                onChange={(e) => setDanaText(e.target.value)}
                className="pe-textarea"
                rows={2}
              />
            </label>
          </>
        )}
      </div>
    </EditorSection>
  );
}

export default memo(DanaSection);
