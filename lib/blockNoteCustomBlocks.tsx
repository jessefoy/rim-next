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

// ── Note (lightweight callout) ────────────────────────────────────────────────
// The Note element: a compact titled box for observations and decisions inside
// editorial content. Two variants only — Note and Decision. Practice,
// Reflection, Verse, and Pull Quote are separate editorial elements with their
// own visual identities, not variants of this one.
//
// Container block (content: "none") — children are real blocks so the body
// supports paragraphs, lists, steps.
//
// Legacy variants (practice, reflection, question, warning, info) remain in
// the schema so existing content still loads, but the picker offers only the
// curated pair. Existing documents should be migrated to the new dedicated
// elements over time.
//
// Editor view: bn-callout  |  Rendered output: lp-callout-block

import { useState, useRef, useEffect } from "react";

export type CalloutVariant =
  | "note"
  | "decision"
  | "practice"   // legacy — migrate to PracticeSuggestion element
  | "reflection" // legacy — migrate to Reflection element
  | "question"   // legacy
  | "warning"    // legacy
  | "info";      // legacy

// Curated picker set — only Note and Decision are user-selectable.
export const CALLOUT_VARIANTS: CalloutVariant[] = [
  "note",
  "decision",
];

export const CALLOUT_ICONS: Record<CalloutVariant, string> = {
  note: "💡",
  decision: "✓",
  practice: "🌱",
  reflection: "❦",
  question: "?",
  warning: "⚠",
  info: "ℹ",
};

export const CALLOUT_LABELS: Record<CalloutVariant, string> = {
  note: "Note",
  decision: "Decision",
  practice: "Practice Note",
  reflection: "Reflection",
  question: "Question",
  warning: "Warning",
  info: "Info",
};

const calloutFactory = createReactBlockSpec(
  {
    type: "callout" as const,
    propSchema: {
      variant: {
        default: "note" as const,
        values: [
          "note",
          "decision",
          "practice",
          "reflection",
          "question",
          "warning",
          "info",
        ] as const,
      },
      title: { default: "" },
    },
    content: "none" as const,
  },
  {
    render: ({ block, editor }) => {
      const variant = block.props.variant as CalloutVariant;
      const [pickerOpen, setPickerOpen] = useState(false);
      const pickerRef = useRef<HTMLDivElement | null>(null);

      useEffect(() => {
        if (!pickerOpen) return;
        const onDocDown = (e: MouseEvent) => {
          if (!pickerRef.current?.contains(e.target as Node)) {
            setPickerOpen(false);
          }
        };
        document.addEventListener("mousedown", onDocDown);
        return () => document.removeEventListener("mousedown", onDocDown);
      }, [pickerOpen]);

      const pickVariant = (next: CalloutVariant) => {
        editor.updateBlock(block, { props: { variant: next } });
        setPickerOpen(false);
      };

      const focusBody = () => {
        const current = editor.getBlock(block.id);
        if (!current) return;
        if (current.children.length === 0) {
          editor.updateBlock(block, {
            children: [{ type: "paragraph" as never }],
          } as never);
        }
        setTimeout(() => {
          const updated = editor.getBlock(block.id);
          const firstChild = updated?.children[0];
          if (firstChild) {
            editor.setTextCursorPosition(firstChild.id, "start");
            editor.focus();
          }
        }, 0);
      };

      return (
        <div
          className={`bn-callout bn-callout--${variant}`}
          contentEditable={false}
        >
          <div className="bn-callout__header">
            <button
              type="button"
              className="bn-callout__icon"
              onClick={() => setPickerOpen((v) => !v)}
              onMouseDown={(e) => e.preventDefault()}
              title="Change callout type"
              aria-label="Change callout type"
            >
              {CALLOUT_ICONS[variant]}
            </button>
            {pickerOpen && (
              <div className="bn-callout__picker" ref={pickerRef}>
                {CALLOUT_VARIANTS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`bn-callout__picker-item${
                      v === variant ? " bn-callout__picker-item--active" : ""
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickVariant(v)}
                  >
                    <span className="bn-callout__picker-icon">
                      {CALLOUT_ICONS[v]}
                    </span>
                    <span className="bn-callout__picker-label">
                      {CALLOUT_LABELS[v]}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <input
              className="bn-callout__title"
              placeholder={CALLOUT_LABELS[variant]}
              value={block.props.title}
              onChange={(e) =>
                editor.updateBlock(block, { props: { title: e.target.value } })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "ArrowDown") {
                  e.preventDefault();
                  focusBody();
                }
              }}
            />
          </div>
        </div>
      );
    },
    toExternalHTML: ({ block }) => {
      const variant = block.props.variant as CalloutVariant;
      const title = block.props.title;
      const icon = CALLOUT_ICONS[variant] ?? CALLOUT_ICONS.note;
      return (
        <div className={`lp-callout-block lp-callout-block--${variant}`}>
          <div className="lp-callout-block__header">
            <span className="lp-callout-block__icon" aria-hidden="true">
              {icon}
            </span>
            {title ? (
              <span className="lp-callout-block__title">{title}</span>
            ) : null}
          </div>
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
