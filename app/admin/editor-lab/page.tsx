"use client";

/**
 * Editor Lab — /admin/editor-lab
 *
 * Demos the canonical RimTiptapEditor in all three variants side by side.
 * Storage paradigm: plain HTML strings (not BlockNote JSON).
 *
 * CSS prefix: el- (layout) + rt- (editor chrome, defined by RimTiptapEditor)
 */

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { RimTiptapVariant } from "@/components/rim-tiptap/RimTiptapEditor";

const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false },
);

const STORAGE_PREFIX = "el-tiptap-v2";

const SAMPLES: Record<RimTiptapVariant, string> = {
  minimal: `<p>A short, inline-friendly editor. <strong>Bold</strong>, <em>italic</em>, and <a href="https://rootedinmindfulness.org">links</a>. Nothing else.</p>`,
  message: `<p>This is the editor for conversations, hub welcome messages, support replies, and program emails.</p>
<p>You can <strong>emphasize</strong>, <em>shade meaning</em>, and add <a href="https://rootedinmindfulness.org">links</a>.</p>
<ul><li>Bullet lists</li><li>Numbered lists</li><li>Task lists</li></ul>
<blockquote><p>Quotes for moments worth pausing on.</p></blockquote>
<p>No headings, no images, no tables — by design.</p>`,
  document: `<h2>Document variant</h2>
<p>The full editor — for hub documents, manual sections, program descriptions, and lesson bodies.</p>
<h3>What you get</h3>
<ul><li>Headings (H2, H3, H4)</li><li>Tables</li><li>Images</li><li>The dharma blocks below</li></ul>
<div class="rim-el-pull-quote"><div class="rim-el-pull-quote__text">A line worth sitting with.</div><cite class="rim-el-pull-quote__attribution">— Attribution optional</cite></div>
<div class="rim-el-note rim-el-note--note" data-variant="note"><div class="rim-el-note__title">Note</div><div class="rim-el-note__body"><p>Aside information worth surfacing — without breaking the flow of the page.</p></div></div>
<p>Place a divider between sections:</p>
<hr>
<div class="rim-el-practice"><div class="rim-el-practice__eyebrow">Practice</div><div class="rim-el-practice__title">A short sit</div><div class="rim-el-practice__body"><p>Find a comfortable seat. Let the body settle. Three breaths.</p></div></div>`,
};

export default function EditorLabPage() {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState<RimTiptapVariant>("document");
  const [content, setContent] = useState<Record<RimTiptapVariant, string>>({
    minimal: "",
    message: "",
    document: "",
  });

  useEffect(() => {
    const next: Record<RimTiptapVariant, string> = {
      minimal: localStorage.getItem(`${STORAGE_PREFIX}-minimal`) ?? "",
      message: localStorage.getItem(`${STORAGE_PREFIX}-message`) ?? "",
      document: localStorage.getItem(`${STORAGE_PREFIX}-document`) ?? "",
    };
    setContent(next);
    setMounted(true);
  }, []);

  function update(variant: RimTiptapVariant, html: string) {
    setContent((prev) => ({ ...prev, [variant]: html }));
    localStorage.setItem(`${STORAGE_PREFIX}-${variant}`, html);
  }

  function loadSample(variant: RimTiptapVariant) {
    const sample = SAMPLES[variant];
    setContent((prev) => ({ ...prev, [variant]: sample }));
    localStorage.setItem(`${STORAGE_PREFIX}-${variant}`, sample);
  }

  function clearVariant(variant: RimTiptapVariant) {
    setContent((prev) => ({ ...prev, [variant]: "" }));
    localStorage.removeItem(`${STORAGE_PREFIX}-${variant}`);
  }

  if (!mounted) {
    return (
      <div className="el-page">
        <header className="el-header">
          <h1 className="el-title">Editor Lab</h1>
        </header>
      </div>
    );
  }

  const html = content[active];

  return (
    <div className="el-page">
      <header className="el-header">
        <h1 className="el-title">Editor Lab — Tiptap (canonical)</h1>
        <p className="el-subtitle">
          Three variants of the same editor. Storage is plain HTML.{" "}
          <code>minimal</code> for inline form fields,{" "}
          <code>message</code> for conversations and short prose,{" "}
          <code>document</code> for full pages with tables, images, and dharma blocks.
        </p>
      </header>

      <div className="el-tabs" role="tablist" aria-label="Editor variant">
        {(["minimal", "message", "document"] as RimTiptapVariant[]).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={active === v}
            className={`el-tab${active === v ? " el-tab--active" : ""}`}
            onClick={() => setActive(v)}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="el-actions">
        <button className="btn btn--sm" onClick={() => loadSample(active)}>
          Load sample content
        </button>
        <button className="btn btn--sm btn--ghost" onClick={() => clearVariant(active)}>
          Clear
        </button>
      </div>

      <div className="el-split">
        <section className="el-pane" aria-label="Editor">
          <div className="el-pane__label">Editor — variant: <code>{active}</code></div>
          <div className="el-pane__body">
            <RimTiptapEditor
              key={active}
              value={html}
              onChange={(next) => update(active, next)}
              variant={active}
              placeholder={
                active === "minimal"
                  ? "Short text…"
                  : active === "message"
                    ? "Write your message…"
                    : "Start writing. Press Enter and use the + on the left margin to add blocks."
              }
            />
          </div>
        </section>

        <section className="el-pane" aria-label="Rendered output">
          <div className="el-pane__label">
            Rendered output — wrapper: <code>rim-content rim-content--{active === "document" ? "document" : "message"}</code>
          </div>
          <div className="el-pane__body">
            {html ? (
              <div
                className={`rim-content rim-content--${active === "document" ? "document" : "message"}`}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <div className="el-placeholder">
                <p>Start writing, or click <strong>Load sample content</strong>.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="el-pane" aria-label="Raw HTML output">
        <div className="el-pane__label">Raw HTML (what would be stored)</div>
        <div className="el-pane__body">
          <pre className="el-raw">{html || "(empty)"}</pre>
        </div>
      </section>
    </div>
  );
}
