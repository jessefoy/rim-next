"use client";

/**
 * Editor Lab — /admin/editor-lab
 * Admin-only development workspace for the rich text editor system.
 * CSS prefix: el-
 *
 * Currently focused exclusively on the Document-tier editor (RimBlockEditor),
 * which is the flagship surface. Once this is perfected, the other tiers
 * (Message, Feature, Email) will inherit from it and be reintroduced.
 */

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { renderBlockNoteHtml } from "@/lib/renderRichContent";

const RimBlockEditor = dynamic(() => import("@/components/RimBlockEditor"), { ssr: false });

const STORAGE_KEY = "el-content-document";

const SAMPLE_DOCUMENT: any[] = [
  { type: "heading", props: { level: 1 }, content: [{ type: "text", text: "Volunteer onboarding guide", styles: {} }] },
  { type: "paragraph", content: [{ type: "text", text: "This document walks new volunteers through their first month. Review with your coordinator.", styles: {} }] },
  { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Week one", styles: {} }] },
  { type: "numberedListItem", content: [{ type: "text", text: "Complete the orientation video", styles: {} }] },
  { type: "numberedListItem", content: [{ type: "text", text: "Shadow an experienced volunteer at one session", styles: {} }] },
  { type: "numberedListItem", content: [{ type: "text", text: "Meet with your coordinator to set expectations", styles: {} }] },
  {
    type: "callout",
    props: { variant: "aside" },
    content: [],
    children: [
      { type: "heading", props: { level: 4 }, content: [{ type: "text", text: "A note for new volunteers", styles: {} }] },
      { type: "paragraph", content: [{ type: "text", text: "This is an Aside block — a universal shaded container for notes, caveats, or anything worth calling out. For a title, add a heading block inside. The background color is determined by where it appears (document, lesson, program).", styles: {} }] },
    ],
  },
  { type: "heading", props: { level: 3 }, content: [{ type: "text", text: "Key contacts", styles: {} }] },
  { type: "paragraph", content: [{ type: "text", text: "Example quote from the RIM charter:", styles: {} }] },
  { type: "heading", props: { level: 4 }, content: [{ type: "text", text: "Further reading", styles: {} }] },
];

export default function EditorLabPage() {
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState<any>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { setContent(JSON.parse(raw)); } catch { /* ignore */ }
    }
    setMounted(true);
  }, []);

  function update(value: any) {
    setContent(value);
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }

  function loadSample() {
    update(SAMPLE_DOCUMENT);
    window.location.reload();
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    setContent(null);
    window.location.reload();
  }

  const bodyHtml = content ? renderBlockNoteHtml(content) : "";

  if (!mounted) {
    return <div className="el-page"><div className="el-header"><h1 className="el-title">Editor Lab</h1></div></div>;
  }

  return (
    <div className="el-page">
      <header className="el-header">
        <h1 className="el-title">Editor Lab — Document</h1>
        <p className="el-subtitle">
          Focused development workspace for the Document-tier editor (RimBlockEditor).
          This is the flagship surface. Once it's perfected, Message, Feature, and Email
          tiers will inherit from it.
        </p>
      </header>

      <div className="el-actions">
        <button className="btn btn--sm" onClick={loadSample}>Load sample content</button>
        <button className="btn btn--sm btn--ghost" onClick={clear}>Clear</button>
      </div>

      <div className="el-split">
        <section className="el-pane" aria-label="Editor">
          <div className="el-pane__label">Editor</div>
          <div className="el-pane__body">
            <RimBlockEditor
              key={`document-${mounted}`}
              value={content}
              onChange={update}
              placeholder="Start typing, or press / for commands…"
              context="document"
            />
          </div>
        </section>

        <section className="el-pane" aria-label="Rendered output">
          <div className="el-pane__label">Rendered output — <code>hdoc-body rim-content</code></div>
          <div className="el-pane__body">
            {bodyHtml ? (
              <div
                className="hdoc-body rim-content rim-content--document"
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
    </div>
  );
}
