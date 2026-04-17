"use client";

/**
 * Custom Dharma block types for BlockNote.
 * These replace VerseQuote, PracticeSuggestion, and Callout from lib/tiptap-extensions.ts.
 *
 * Each block's toExternalHTML maps to the existing lp- CSS classes so rendered
 * output matches the existing lesson page design.
 */

import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";

// ── Verse Quote ──────────────────────────────────────────────────────────────
// Inline-content block with an optional attribution line.
// Editor view: bn-verse-quote  |  Rendered output: lp-verse-quote

const verseQuoteFactory = createReactBlockSpec(
  {
    type: "verseQuote" as const,
    propSchema: {
      attribution: { default: "" },
    },
    content: "inline" as const,
  },
  {
    render: ({ block, editor, contentRef }) => (
      <div className="bn-verse-quote">
        <div className="bn-verse-quote__text" ref={contentRef} />
        <input
          className="bn-verse-quote__attribution"
          placeholder="Attribution (optional)"
          value={block.props.attribution}
          onChange={(e) =>
            editor.updateBlock(block, {
              props: { attribution: e.target.value },
            })
          }
        />
      </div>
    ),
    toExternalHTML: ({ block, contentRef }) => (
      <div
        className="lp-verse-quote"
        data-attribution={block.props.attribution}
      >
        <div ref={contentRef} />
      </div>
    ),
  }
);

// ── Practice Suggestion ───────────────────────────────────────────────────────
// Inline-content block with a "Practice" label badge.
// Editor view: bn-practice-suggestion  |  Rendered output: lp-callout

const practiceSuggestionFactory = createReactBlockSpec(
  {
    type: "practiceSuggestion" as const,
    propSchema: {},
    content: "inline" as const,
  },
  {
    render: ({ contentRef }) => (
      <div className="bn-practice-suggestion">
        <span className="bn-practice-suggestion__label">Practice</span>
        <div ref={contentRef} />
      </div>
    ),
    toExternalHTML: ({ contentRef }) => (
      <div className="lp-callout">
        <div ref={contentRef} />
      </div>
    ),
  }
);

// ── Callout ───────────────────────────────────────────────────────────────────
// Inline-content block with a variant (info | note | warning).
// Editor view: bn-callout  |  Rendered output: lp-callout-block

const calloutFactory = createReactBlockSpec(
  {
    type: "callout" as const,
    propSchema: {
      variant: {
        default: "info" as const,
        values: ["info", "note", "warning", "decision"] as const,
      },
    },
    content: "inline" as const,
  },
  {
    render: ({ block, contentRef }) => (
      <div
        className={`bn-callout bn-callout--${block.props.variant}`}
        ref={contentRef}
      />
    ),
    toExternalHTML: ({ block, contentRef }) => (
      <div
        className={`lp-callout-block lp-callout-block--${block.props.variant}`}
        ref={contentRef}
      />
    ),
  }
);

// ── Exported specs (pre-called factories) ────────────────────────────────────

export const customBlockSpecs = {
  verseQuote: verseQuoteFactory(),
  practiceSuggestion: practiceSuggestionFactory(),
  callout: calloutFactory(),
};

// Full editor schema: all default blocks + custom Dharma blocks
export const rimBlockSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    ...customBlockSpecs,
  },
});

// Prose schema: paragraph + lists + quote only — no headings, no custom blocks
export const rimProseSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph:         defaultBlockSpecs.paragraph,
    bulletListItem:    defaultBlockSpecs.bulletListItem,
    numberedListItem:  defaultBlockSpecs.numberedListItem,
    quote:             defaultBlockSpecs.quote,
  },
});
