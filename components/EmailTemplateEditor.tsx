"use client";

/**
 * EmailTemplateEditor — admin edit UI for a single email template.
 *
 * Sections:
 *   Header   — breadcrumb, template name, last-saved metadata
 *   Form     — subject input, body (MarkdownEditor), variables reference, enabled toggle
 *   Preview  — modal: POST /api/admin/emails/[slug]/preview → full HTML in iframe
 *   Footer   — Save + Preview buttons
 *
 * CSS prefix: em-
 */

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { type Editor } from "@tiptap/react";
import MarkdownEditor from "./MarkdownEditor";
import { SaveNote } from "@/components/FormDone";

interface TemplateData {
  id: string;
  slug: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  enabled: boolean;
  variables: string[];
  helpText: string | null;
  sanityNote: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

interface Props {
  template: TemplateData;
  userId: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function EmailTemplateEditor({ template, userId }: Props) {
  const [subject,  setSubject]  = useState(template.subject);
  const [body,     setBody]     = useState(template.body);
  const [enabled,  setEnabled]  = useState(template.enabled);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // Why a save didn't go through, kept beside the button until the next edit.
  const [saveProblem, setSaveProblem] = useState("");
  const edited = () => { if (saveState !== "saving") setSaveState("idle"); };
  const [savedMeta, setSavedMeta] = useState<{ at: string; by: string | null }>({
    at: template.updatedAt,
    by: template.updatedBy,
  });

  // Ref to the Tiptap editor instance (populated by MarkdownEditor once ready)
  const editorRef = useRef<Editor | null>(null);

  // Preview modal
  const [previewOpen,    setPreviewOpen]    = useState(false);
  const [previewHtml,    setPreviewHtml]    = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewOpenerRef = useRef<HTMLElement | null>(null);
  const previewCloseRef = useRef<HTMLButtonElement | null>(null);

  // The preview is a dialog: focus moves into it, Escape closes it, and
  // focus goes back to the Preview button.
  useEffect(() => {
    if (!previewOpen) {
      const opener = previewOpenerRef.current;
      previewOpenerRef.current = null;
      opener?.focus();
      return;
    }
    previewCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPreviewOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [previewOpen]);

  async function handleSave() {
    setSaveState("saving");
    setSaveProblem("");
    try {
      const res = await fetch(`/api/admin/emails/${template.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, enabled, userId }),
      });
      if (!res.ok) {
        // Say why, in words: the server's own codes are terse.
        const data = await res.json().catch(() => null);
        const kept = "What you wrote is still here.";
        setSaveProblem(
          res.status === 401
            ? `You've been signed out, so this wasn't saved. ${kept} Sign in again in a new tab, then press Save changes again.`
            : res.status === 403
              ? "Only an administrator can change email templates, so this wasn't saved."
              : res.status === 404
                ? "This template wasn't found, so this wasn't saved. Go back to All templates and open it again."
                : data && typeof data.error === "string" && data.error
                  ? `This wasn't saved: ${data.error} ${kept}`
                  : `The server had a problem, so this wasn't saved. ${kept} Please try again.`,
        );
        setSaveState("error");
        return;
      }
      const data = await res.json();
      setSavedMeta({ at: data.updatedAt, by: data.updatedBy });
      setSaveState("saved");
    } catch {
      setSaveProblem("Couldn't reach the server, so this wasn't saved. What you wrote is still here. Please try again.");
      setSaveState("error");
    }
  }

  async function handlePreview() {
    previewOpenerRef.current = document.activeElement as HTMLElement | null;
    setPreviewLoading(true);
    setPreviewOpen(true);
    setPreviewHtml(null);
    try {
      const res = await fetch(`/api/admin/emails/${template.slug}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, variables: template.variables }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.html) throw new Error();
      setPreviewHtml(data.html);
    } catch {
      setPreviewHtml("<p style='padding:24px;font-family:sans-serif;'>The preview couldn't be made just now. Close this and press Preview again.</p>");
    } finally {
      setPreviewLoading(false);
    }
  }

  function insertVariable(name: string) {
    editorRef.current?.commands.insertVariable(name);
  }

  const savedDate = new Date(savedMeta.at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div className="em-editor">
      {/* ── Header ── */}
      <div className="em-editor__hdr">
        <Link href="/admin/emails" className="em-editor__back">← All templates</Link>
        <h1 className="em-editor__title">{template.name}</h1>
        <p className="em-editor__desc">{template.description}</p>
        <p className="em-editor__meta">
          Last saved {savedDate}
          {savedMeta.by ? ` by ${savedMeta.by}` : ""}
        </p>
      </div>

      {/* ── Help text ── */}
      {(template.helpText || template.sanityNote) && (
        <div className="em-editor__help">
          {template.helpText && (
            <p className="em-editor__help-text">{template.helpText}</p>
          )}
          {template.sanityNote && (
            <div className="em-editor__sanity-callout">
              <span className="em-editor__sanity-callout-label">Program Manager</span>
              {template.sanityNote}
            </div>
          )}
        </div>
      )}

      {/* ── Subject ── */}
      <div className="em-editor__field">
        <label className="em-editor__label" htmlFor="em-subject">Subject line</label>
        <input
          id="em-subject"
          type="text"
          className="em-editor__input"
          value={subject}
          onChange={(e) => { setSubject(e.target.value); edited(); }}
          placeholder="Subject"
        />
      </div>

      {/* ── Body ── */}
      <div className="em-editor__field">
        <label className="em-editor__label" id="em-body-label">Body</label>
        <p className="em-editor__hint">
          Write in markdown. Use <code>{"{{variableName}}"}</code> tokens for dynamic values.
          Bold and links are supported. H2/H3 headings render as styled headings in the email.
        </p>
        {/* Static chrome bands — show what wraps this body in the real email */}
        <div className="em-chrome-band em-chrome-band--header" aria-hidden="true">
          Rooted In Mindfulness
        </div>
        <div role="group" aria-labelledby="em-body-label">
        <MarkdownEditor
          value={body}
          onChange={(v) => { setBody(v); edited(); }}
          rows={12}
          placeholder="Email body…"
          editorRef={editorRef}
        />
        </div>
        <div className="em-chrome-band em-chrome-band--footer" aria-hidden="true">
          Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org
        </div>
      </div>

      {/* ── Variables reference ── */}
      {template.variables.length > 0 && (
        <div className="em-editor__vars">
          <div className="em-editor__vars-label">
            Available variables
            <span className="em-editor__vars-hint">click to insert at cursor</span>
          </div>
          <div className="em-editor__vars-list">
            {template.variables.map((v) => (
              <button
                key={v}
                type="button"
                className="em-editor__var-btn"
                onClick={() => insertVariable(v)}
                title={`Insert {{${v}}}`}
              >
                {"{{" + v + "}}"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Enabled toggle ── */}
      <div className="em-editor__toggle-row">
        <label className="em-editor__toggle-label" htmlFor="em-enabled">
          <input
            id="em-enabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => { setEnabled(e.target.checked); edited(); }}
            className="em-editor__checkbox"
          />
          <span>
            <strong>{enabled ? "Enabled" : "Disabled"}</strong>
            {": "}
            {enabled
              ? "this email will be sent when triggered."
              : "this email is suppressed; triggers are silently skipped."}
          </span>
        </label>
      </div>

      {/* ── Actions ── */}
      <div className="em-editor__actions">
        <button
          type="button"
          className="em-editor__btn em-editor__btn--secondary"
          onClick={handlePreview}
        >
          Preview
        </button>
        <button
          type="button"
          className={`em-editor__btn em-editor__btn--primary${saveState === "saving" ? " em-editor__btn--loading" : ""}`}
          onClick={handleSave}
          disabled={saveState === "saving"}
        >
          {saveState === "saving" ? "Saving…" : "Save changes"}
        </button>
      </div>
      {/* The answer beside the button, kept until the next edit. */}
      <SaveNote
        status={saveState}
        saved={enabled
          ? "Saved. The next time this email is sent, it uses these words."
          : "Saved. This email stays off until you turn it on."}
        problem={saveProblem}
      />

      {/* ── Preview modal ── */}
      {previewOpen && (
        <div className="em-preview-overlay" onClick={() => setPreviewOpen(false)}>
          <div
            className="em-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="em-preview-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="em-preview-modal__hdr">
              <span className="em-preview-modal__title" id="em-preview-title">Email preview</span>
              <span className="em-preview-modal__hint">
                Variable tokens replaced with <code>[placeholder]</code> labels
              </span>
              <button
                type="button"
                className="em-preview-modal__close"
                ref={previewCloseRef}
                onClick={() => setPreviewOpen(false)}
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>
            <div className="em-preview-modal__body">
              {previewLoading ? (
                <div className="em-preview-modal__loading">Loading…</div>
              ) : (
                <iframe
                  title="Email preview"
                  className="em-preview-modal__iframe"
                  srcDoc={previewHtml ?? ""}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
