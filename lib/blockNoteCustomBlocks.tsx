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
// Titled callout box with a variant icon and an editable title.
// Body is inline-content (single paragraph with marks). Path B — full container
// with lists inside — is backlogged (see data/backlog.json 2026-04-17-002).
//
// Editor view: bn-callout  |  Rendered output: lp-callout-block
//
// Variants:
//   note     — 💡 amber, general notes / tips
//   decision — ✓  green, recorded decisions
//   info     — ℹ  blue  (legacy — kept in schema for existing content)
//   warning  — ⚠  red   (legacy)
//
// The icon button cycles note ⇄ decision on click. Legacy variants stay
// rendered but aren't part of the cycle.

type CalloutVariant = "info" | "note" | "warning" | "decision";

const CALLOUT_ICONS: Record<CalloutVariant, string> = {
  info: "ℹ",
  note: "💡",
  warning: "⚠",
  decision: "✓",
};

const CALLOUT_PLACEHOLDERS: Record<CalloutVariant, string> = {
  info: "Info",
  note: "Note",
  warning: "Warning",
  decision: "Decision",
};

const calloutFactory = createReactBlockSpec(
  {
    type: "callout" as const,
    propSchema: {
      variant: {
        default: "note" as const,
        values: ["info", "note", "warning", "decision"] as const,
      },
      title: { default: "" },
    },
    content: "inline" as const,
  },
  {
    render: ({ block, editor, contentRef }) => {
      const variant = block.props.variant as CalloutVariant;
      const cycleVariant = () => {
        const next: CalloutVariant = variant === "note" ? "decision" : "note";
        editor.updateBlock(block, { props: { variant: next } });
      };
      return (
        <div className={`bn-callout bn-callout--${variant}`}>
          <div className="bn-callout__header" contentEditable={false}>
            <button
              type="button"
              className="bn-callout__icon"
              onClick={cycleVariant}
              title="Change callout type"
              aria-label="Change callout type"
            >
              {CALLOUT_ICONS[variant]}
            </button>
            <input
              className="bn-callout__title"
              placeholder={CALLOUT_PLACEHOLDERS[variant]}
              value={block.props.title}
              onChange={(e) =>
                editor.updateBlock(block, { props: { title: e.target.value } })
              }
            />
          </div>
          <div className="bn-callout__body" ref={contentRef} />
        </div>
      );
    },
    toExternalHTML: ({ block, contentRef }) => {
      const variant = block.props.variant as CalloutVariant;
      const title = block.props.title;
      return (
        <div className={`lp-callout-block lp-callout-block--${variant}`}>
          <div className="lp-callout-block__header">
            <span className="lp-callout-block__icon" aria-hidden="true">
              {CALLOUT_ICONS[variant]}
            </span>
            {title ? (
              <span className="lp-callout-block__title">{title}</span>
            ) : null}
          </div>
          <div className="lp-callout-block__body" ref={contentRef} />
        </div>
      );
    },
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
