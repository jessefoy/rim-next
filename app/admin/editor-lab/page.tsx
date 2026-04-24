"use client";

/**
 * Editor Lab — /admin/editor-lab
 * TipTap prototype replacing the old BlockNote-based RimBlockEditor.
 * CSS prefix: el- (layout) + tt- (editor chrome)
 *
 * Storage is plain HTML (localStorage), not BlockNote JSON. This is the
 * paradigm we're testing: rich-text-as-HTML, Webflow-like, portable.
 */

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const TiptapEditor = dynamic(() => import("@/components/TiptapEditor"), { ssr: false });

const STORAGE_KEY = "el-tiptap-html";

const SAMPLE_HTML = `
<h1>Volunteer onboarding guide</h1>
<p>This document walks new volunteers through their first month. Review with your coordinator.</p>

<h2>Week one</h2>
<ol>
  <li>Complete the orientation video</li>
  <li>Shadow an experienced volunteer at one session</li>
  <li>Meet with your coordinator to set expectations</li>
</ol>

<p data-variant="aside" class="rim-el-aside">
  <strong>A note for new volunteers:</strong> this is an Aside — a universal shaded container for notes or caveats. It's a regular paragraph with the <code>aside</code> variant applied. CSS does the rest.
</p>

<h3>Key contacts</h3>
<p>Example quote from the RIM charter:</p>

<blockquote data-variant="body-quote" class="rim-el-body-quote">
  <p>We come here to practice clear seeing — which is the prerequisite for wise and compassionate response.</p>
</blockquote>

<h4>Further reading</h4>
<p>Check the <a href="/admin/manual">staff manual</a> or reach out to your coordinator.</p>
`.trim();

export default function EditorLabPage() {
  const [mounted, setMounted] = useState(false);
  const [html, setHtml] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setHtml(raw);
    setMounted(true);
  }, []);

  function update(value: string) {
    setHtml(value);
    localStorage.setItem(STORAGE_KEY, value);
  }

  function loadSample() {
    localStorage.setItem(STORAGE_KEY, SAMPLE_HTML);
    window.location.reload();
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    setHtml("");
    window.location.reload();
  }

  if (!mounted) {
    return (
      <div className="el-page">
        <div className="el-header">
          <h1 className="el-title">Editor Lab</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="el-page">
      <header className="el-header">
        <h1 className="el-title">Editor Lab — TipTap Prototype</h1>
        <p className="el-subtitle">
          Testing a Webflow-style rich-text paradigm: standard HTML output,
          inline formatting via bubble menu, block-level variants (Aside,
          Practice, Body Quote, etc.) applied as classes — no custom
          block types. Storage is plain HTML.
        </p>
      </header>

      <div className="el-actions">
        <button className="btn btn--sm" onClick={loadSample}>
          Load sample content
        </button>
        <button className="btn btn--sm btn--ghost" onClick={clear}>
          Clear
        </button>
      </div>

      <div className="el-split">
        <section className="el-pane" aria-label="Editor">
          <div className="el-pane__label">Editor</div>
          <div className="el-pane__body">
            <TiptapEditor
              value={html}
              onChange={update}
              placeholder="Start typing. Select text for inline formatting."
            />
          </div>
        </section>

        <section className="el-pane" aria-label="Rendered output">
          <div className="el-pane__label">
            Rendered output — <code>rim-content rim-content--document</code>
          </div>
          <div className="el-pane__body">
            {html ? (
              <div
                className="rim-content rim-content--document"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <div className="el-placeholder">
                <p>
                  Start writing, or click <strong>Load sample content</strong> to
                  populate.
                </p>
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
