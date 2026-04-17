"use client";

/**
 * Editor Lab — /admin/editor-lab
 * Admin-only development workspace for the rich text editor system.
 * CSS prefix: el-
 *
 * Tabs: Message | Document | Feature (Contemplative) | Email Template
 * Each tab shows the editor (left) alongside its rendered output (right),
 * using the same CSS wrapper the real surface uses. Content per tab is
 * persisted in localStorage so we can iterate without losing test content.
 */

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { renderBlockNoteHtml } from "@/lib/renderRichContent";

const RimProseEditor = dynamic(() => import("@/components/RimProseEditor"), { ssr: false });
const RimBlockEditor = dynamic(() => import("@/components/RimBlockEditor"), { ssr: false });

type Tab = "message" | "document" | "feature" | "email";

const TABS: { id: Tab; label: string; blurb: string }[] = [
  { id: "message",  label: "Message",   blurb: "Conversations, announcements, tasks, support replies, notes."                  },
  { id: "document", label: "Document",  blurb: "Hub documents, program descriptions, course descriptions, manual sections."    },
  { id: "feature",  label: "Feature",   blurb: "Lessons only — contemplative blocks (VerseQuote, PracticeSuggestion, Callout)." },
  { id: "email",    label: "Email",     blurb: "Email template authoring — separate markdown system. Flagged for later."       },
];

const STORAGE_PREFIX = "el-content-";

/* ── Sample content per tier (exercises block types) ──────────────────────── */

const SAMPLE_MESSAGE: any[] = [
  { type: "paragraph", content: [{ type: "text", text: "Hi team — quick note on Friday's session.", styles: {} }] },
  { type: "bulletListItem", content: [{ type: "text", text: "Doors open at 6:45pm", styles: {} }] },
  { type: "bulletListItem", content: [{ type: "text", text: "Chairs need to come up from the basement", styles: {} }] },
  { type: "bulletListItem", content: [{ type: "text", text: "Please arrive 15 min early if you're on setup", styles: {} }] },
  { type: "paragraph", content: [{ type: "text", text: "Let me know if anything comes up. Gratitude.", styles: { italic: true } }] },
];

const SAMPLE_DOCUMENT: any[] = [
  { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Volunteer onboarding guide", styles: {} }] },
  { type: "paragraph", content: [{ type: "text", text: "This document walks new volunteers through their first month. Review with your coordinator.", styles: {} }] },
  { type: "heading", props: { level: 3 }, content: [{ type: "text", text: "Week one", styles: {} }] },
  { type: "numberedListItem", content: [{ type: "text", text: "Complete the orientation video", styles: {} }] },
  { type: "numberedListItem", content: [{ type: "text", text: "Shadow an experienced volunteer at one session", styles: {} }] },
  { type: "numberedListItem", content: [{ type: "text", text: "Meet with your coordinator to set expectations", styles: {} }] },
  { type: "heading", props: { level: 3 }, content: [{ type: "text", text: "Key contacts", styles: {} }] },
  { type: "paragraph", content: [{ type: "text", text: "Tables are used for structured reference:", styles: {} }] },
  { type: "paragraph", content: [{ type: "text", text: "Example quote from the RIM charter:", styles: {} }] },
];

const SAMPLE_FEATURE: any[] = [
  { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Attuning to your inner compass", styles: {} }] },
  { type: "paragraph", content: [{ type: "text", text: "Imagine setting out on a great ocean voyage. What's the first thing you'd need? Before provisions, before a sturdy ship, you'd need a clear destination and a reliable compass.", styles: {} }] },
  { type: "paragraph", content: [{ type: "text", text: "These aspirations are not mere wishful thinking. They are powerful intentions that shape our thoughts, words, and actions.", styles: {} }] },
];

const SAMPLES: Record<Tab, any[]> = {
  message:  SAMPLE_MESSAGE,
  document: SAMPLE_DOCUMENT,
  feature:  SAMPLE_FEATURE,
  email:    [],
};

/* ── Render wrapper classes per tier (matches real surface styling) ───────── */

const PREVIEW_WRAPPERS: Record<Tab, string> = {
  message:  "hub-conv-post__body rim-content",
  document: "hdoc-body rim-content",
  feature:  "lp-body rim-content",
  email:    "rim-content",
};

/* ── Tier specs (allowed blocks — informational, not enforced yet) ────────── */

const TIER_SPECS: Record<Tab, { allowed: string[]; excluded: string[] }> = {
  message: {
    allowed:  ["Paragraph", "Bullet list", "Ordered list", "Blockquote", "Bold", "Italic", "Underline", "Strikethrough", "Inline code", "Code block", "Link", "Table (planned)"],
    excluded: ["Headings", "Images", "Dividers", "Custom blocks"],
  },
  document: {
    allowed:  ["Everything in Message", "H2 / H3", "Tables", "Images", "Dividers", "Info callout"],
    excluded: ["H1 (reserved for page title)", "Dharma-flavored blocks"],
  },
  feature: {
    allowed:  ["Everything in Document", "VerseQuote", "PracticeSuggestion", "Dharma callout"],
    excluded: ["H1"],
  },
  email: {
    allowed:  ["Markdown — separate authoring system"],
    excluded: ["This is not BlockNote. Uses MarkdownEditor + marked + juice pipeline."],
  },
};

/* ── Main page ────────────────────────────────────────────────────────────── */

export default function EditorLabPage() {
  const [tab, setTab] = useState<Tab>("message");
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState<Record<Tab, any>>({
    message:  null,
    document: null,
    feature:  null,
    email:    null,
  });

  // Load persisted content on mount
  useEffect(() => {
    const loaded: Record<Tab, any> = { message: null, document: null, feature: null, email: null };
    for (const t of TABS) {
      const raw = localStorage.getItem(STORAGE_PREFIX + t.id);
      if (raw) {
        try { loaded[t.id] = JSON.parse(raw); } catch { /* ignore */ }
      }
    }
    setContent(loaded);
    setMounted(true);
  }, []);

  function updateContent(id: Tab, value: any) {
    setContent((prev) => ({ ...prev, [id]: value }));
    if (value) {
      localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(value));
    }
  }

  function loadSample(id: Tab) {
    updateContent(id, SAMPLES[id]);
  }

  function clear(id: Tab) {
    localStorage.removeItem(STORAGE_PREFIX + id);
    setContent((prev) => ({ ...prev, [id]: null }));
    // Force remount of editor by cycling tab
    setTab((current) => current);
    window.location.reload();
  }

  const active = TABS.find((t) => t.id === tab)!;
  const spec   = TIER_SPECS[tab];
  const bodyHtml = content[tab] ? renderBlockNoteHtml(content[tab]) : "";

  if (!mounted) {
    return <div className="el-page"><div className="el-header"><h1 className="el-title">Editor Lab</h1></div></div>;
  }

  return (
    <div className="el-page">
      <header className="el-header">
        <h1 className="el-title">Editor Lab</h1>
        <p className="el-subtitle">
          Development workspace for the rich text editor system. Each tab shows one tier mounted against the same CSS wrapper a real page would use, so we can verify WYSIWYG parity as we evolve the editors.
        </p>
      </header>

      <nav className="el-tabs" aria-label="Editor tiers">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`el-tab${tab === t.id ? " el-tab--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="el-blurb">
        <p>{active.blurb}</p>
      </div>

      <div className="el-actions">
        <button className="btn btn--sm" onClick={() => loadSample(tab)}>Load sample content</button>
        <button className="btn btn--sm btn--ghost" onClick={() => clear(tab)}>Clear</button>
      </div>

      <div className="el-split">
        <section className="el-pane" aria-label="Editor">
          <div className="el-pane__label">Editor</div>
          <div className="el-pane__body">
            {tab === "email" ? (
              <div className="el-placeholder">
                <p><strong>Email template authoring uses a separate system.</strong></p>
                <p>MarkdownEditor → marked() → juice() → Resend (inline styles for email clients).</p>
                <p>Flagged for later. When we need BlockNote → email for user-generated content (e.g., support replies), we&apos;ll add a thin renderer here.</p>
              </div>
            ) : tab === "message" ? (
              <RimProseEditor
                key={`message-${mounted}`}
                value={content.message}
                onChange={(v) => updateContent("message", v)}
                placeholder="Write a message…"
                variant="compact"
              />
            ) : tab === "document" ? (
              <RimBlockEditor
                key={`document-${mounted}`}
                value={content.document}
                onChange={(v) => updateContent("document", v)}
                placeholder="Start typing, or press / for commands…"
                context="document"
              />
            ) : (
              <RimBlockEditor
                key={`feature-${mounted}`}
                value={content.feature}
                onChange={(v) => updateContent("feature", v)}
                placeholder="Begin a lesson…"
                context="lesson"
              />
            )}
          </div>
        </section>

        <section className="el-pane" aria-label="Rendered output">
          <div className="el-pane__label">Rendered output — <code>{PREVIEW_WRAPPERS[tab]}</code></div>
          <div className="el-pane__body">
            {tab === "email" ? (
              <div className="el-placeholder">
                <p>(Email preview will render inlined HTML via juice when this tier is built out.)</p>
              </div>
            ) : bodyHtml ? (
              <div
                className={PREVIEW_WRAPPERS[tab]}
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            ) : (
              <div className="el-placeholder">
                <p>Start writing, or click <strong>Load sample content</strong> to populate.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="el-spec">
        <h2 className="el-spec__title">Tier spec — {active.label}</h2>
        <div className="el-spec__grid">
          <div className="el-spec__col">
            <h3 className="el-spec__heading">Allowed</h3>
            <ul>
              {spec.allowed.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </div>
          <div className="el-spec__col">
            <h3 className="el-spec__heading">Excluded</h3>
            <ul>
              {spec.excluded.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </div>
        </div>
        <p className="el-spec__note">
          Spec is informational until Phase 1 writes it into <code>RIM_Editor_Design.md</code> as the contract, then Phase 3+ enforces it in the editor configs.
        </p>
      </section>
    </div>
  );
}
