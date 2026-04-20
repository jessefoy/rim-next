"use client";

/**
 * Custom editorial blocks for BlockNote.
 *
 * Six distinct editorial elements. Each one has its own visual identity.
 *
 *   Pull Quote          — oversized centered serif, decorative teal mark.
 *   Practice Suggestion — "PRACTICE" eyebrow, serif title, block-level body.
 *   Reflection          — italic question lead-in, block-level body.
 *   Verse Quote         — smaller centered serif, optional attribution.
 *   Note (callout)      — compact titled box; Note + Decision variants.
 *   Aside (callout)     — pure structural wrapper. Same formatting as the
 *                         main editor (paragraphs, headings, lists), just
 *                         wrapped in a shaded container. No controls, no
 *                         chrome — color is determined by the render
 *                         context (.rim-content--document, etc.) via CSS.
 *
 * Rendered output is scoped by the .rim-content--{scope} class at the
 * wrapper. Document scope gets utilitarian treatment (Open Sans, no
 * decorative flourishes, editor ≈ rendered). Lesson and program scopes
 * get full editorial treatment (Quincy CF display, teal accents).
 */

import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useState, useRef, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Pull Quote
// Inline single-line content + optional attribution. No body.
// Editor view: bn-pull-quote  |  Rendered: rim-el-pull-quote
// ─────────────────────────────────────────────────────────────────────────────

const pullQuoteFactory = createReactBlockSpec(
  {
    type: "pullQuote" as const,
    propSchema: {
      attribution: { default: "" },
    },
    content: "inline" as const,
  },
  {
    render: ({ block, editor, contentRef }) => (
      <div className="bn-pull-quote">
        <span className="bn-pull-quote__mark" aria-hidden="true">"</span>
        <div className="bn-pull-quote__text" ref={contentRef} />
        <input
          className="bn-pull-quote__attribution"
          placeholder="— Attribution (optional)"
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
        className="rim-el-pull-quote"
        data-attribution={block.props.attribution}
      >
        <div ref={contentRef} />
      </div>
    ),
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Verse Quote
// Inline single-line content + optional attribution. Reverent / external.
// Editor view: bn-verse-quote  |  Rendered: rim-el-verse (legacy: lp-verse-quote)
// ─────────────────────────────────────────────────────────────────────────────

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
        className="rim-el-verse lp-verse-quote"
        data-attribution={block.props.attribution}
      >
        <div ref={contentRef} />
      </div>
    ),
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper — focus first child in a container block (creating one if
// missing). Used on insert and when the header input receives Enter/ArrowDown.
// ─────────────────────────────────────────────────────────────────────────────

function focusContainerBody(editor: any, blockId: string) {
  const current = editor.getBlock(blockId);
  if (!current) return;
  if (!current.children || current.children.length === 0) {
    editor.updateBlock(current, {
      children: [{ type: "paragraph" as never }],
    } as never);
  }
  setTimeout(() => {
    const updated = editor.getBlock(blockId);
    const firstChild = updated?.children?.[0];
    if (firstChild) {
      editor.setTextCursorPosition(firstChild.id, "start");
      editor.focus();
    }
  }, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Practice Suggestion
// Container block — "PRACTICE" eyebrow + serif title + block-level body.
// Body supports paragraphs, lists, numbered steps.
// Editor view: bn-practice  |  Rendered: rim-el-practice
// ─────────────────────────────────────────────────────────────────────────────

const practiceSuggestionFactory = createReactBlockSpec(
  {
    type: "practiceSuggestion" as const,
    propSchema: {
      title: { default: "" },
    },
    content: "none" as const,
  },
  {
    render: ({ block, editor }) => (
      <div className="bn-practice" contentEditable={false}>
        <div className="bn-practice__header">
          <span className="bn-practice__eyebrow">Practice</span>
          <input
            className="bn-practice__title"
            placeholder="Title (optional)"
            value={block.props.title}
            onChange={(e) =>
              editor.updateBlock(block, { props: { title: e.target.value } })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "ArrowDown") {
                e.preventDefault();
                focusContainerBody(editor, block.id);
              }
            }}
          />
        </div>
      </div>
    ),
    toExternalHTML: ({ block }) => {
      const title = block.props.title;
      return (
        <div className="rim-el-practice">
          <div className="rim-el-practice__header">
            <span className="rim-el-practice__eyebrow">Practice</span>
            {title ? (
              <span className="rim-el-practice__title">{title}</span>
            ) : null}
          </div>
        </div>
      );
    },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Reflection
// Container block — italic question lead-in + block-level body.
// Editor view: bn-reflection  |  Rendered: rim-el-reflection
// ─────────────────────────────────────────────────────────────────────────────

const reflectionFactory = createReactBlockSpec(
  {
    type: "reflection" as const,
    propSchema: {
      question: { default: "" },
    },
    content: "none" as const,
  },
  {
    render: ({ block, editor }) => (
      <div className="bn-reflection" contentEditable={false}>
        <input
          className="bn-reflection__question"
          placeholder="A question worth sitting with…"
          value={block.props.question}
          onChange={(e) =>
            editor.updateBlock(block, { props: { question: e.target.value } })
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "ArrowDown") {
              e.preventDefault();
              focusContainerBody(editor, block.id);
            }
          }}
        />
      </div>
    ),
    toExternalHTML: ({ block }) => {
      const question = block.props.question;
      return (
        <div className="rim-el-reflection">
          {question ? (
            <div className="rim-el-reflection__question">{question}</div>
          ) : null}
        </div>
      );
    },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Note (callout)
// Titled box with Note / Decision / Aside variants.
// Editor view: bn-callout  |  Rendered: lp-callout-block (legacy) + rim-el-note
// ─────────────────────────────────────────────────────────────────────────────

export type CalloutVariant =
  | "note"
  | "decision"
  | "aside"
  | "practice"    // legacy — migrate to PracticeSuggestion element
  | "reflection"  // legacy — migrate to Reflection element
  | "question"    // legacy
  | "warning"     // legacy
  | "info";       // legacy

// Curated picker set — only Note and Decision are user-selectable via the icon picker.
// Aside is inserted via the block menu and has its own controls.
export const CALLOUT_VARIANTS: CalloutVariant[] = [
  "note",
  "decision",
];

export const CALLOUT_ICONS: Record<CalloutVariant, string> = {
  note: "💡",
  decision: "✓",
  aside: "",
  practice: "🌱",
  reflection: "❦",
  question: "?",
  warning: "⚠",
  info: "ℹ",
};

export const CALLOUT_LABELS: Record<CalloutVariant, string> = {
  note: "Note",
  decision: "Decision",
  aside: "Aside",
  practice: "Practice Note",
  reflection: "Reflection",
  question: "Question",
  warning: "Warning",
  info: "Info",
};

// ─────────────────────────────────────────────────────────────────────────────
// Aside editor view — pure structural wrapper, no chrome.
//
// The render function emits only a zero-height contentEditable=false marker
// so CSS (.bn-block:has(> .bn-block-content > .bn-callout--aside)) can apply
// the shaded background to the .bn-block ancestor. Children render in the
// normal BlockNote block-group sibling and behave like any other content —
// same formatting, same navigation, same keyboard shortcuts. Backspace at
// position 0 of the first child unwraps the aside (standard container
// behavior across rich text editors).
// ─────────────────────────────────────────────────────────────────────────────

function AsideEditorView() {
  return (
    <div className="bn-callout bn-callout--aside" contentEditable={false} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Callout factory
// ─────────────────────────────────────────────────────────────────────────────

const calloutFactory = createReactBlockSpec(
  {
    type: "callout" as const,
    propSchema: {
      variant: {
        default: "note" as const,
        values: [
          "note",
          "decision",
          "aside",
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

      // Aside has no controls — just a structural marker. Background
      // comes from CSS based on the render context.
      if (variant === "aside") {
        return <AsideEditorView />;
      }

      const pickVariant = (next: CalloutVariant) => {
        editor.updateBlock(block, { props: { variant: next } });
        setPickerOpen(false);
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
                  focusContainerBody(editor, block.id);
                }
              }}
            />
          </div>
        </div>
      );
    },
    toExternalHTML: ({ block }) => {
      const variant    = block.props.variant as CalloutVariant;

      // Aside — universal shaded container. No icon, no title. Color
      // determined by the context scope class on the render wrapper
      // (.rim-content--document, .rim-content--lesson, etc).
      if (variant === "aside") {
        return <div className="rim-el-note rim-el-note--aside" />;
      }

      const title = block.props.title;
      const icon  = CALLOUT_ICONS[variant] ?? CALLOUT_ICONS.note;
      return (
        <div className={`lp-callout-block lp-callout-block--${variant} rim-el-note rim-el-note--${variant}`}>
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

// ─────────────────────────────────────────────────────────────────────────────
// Exported specs
// ─────────────────────────────────────────────────────────────────────────────

export const customBlockSpecs = {
  pullQuote: pullQuoteFactory(),
  verseQuote: verseQuoteFactory(),
  practiceSuggestion: practiceSuggestionFactory(),
  reflection: reflectionFactory(),
  callout: calloutFactory(),
};

// Full editor schema: all default blocks + custom editorial blocks.
export const rimBlockSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    ...customBlockSpecs,
  },
});

// Prose schema: paragraph + lists + quote only — no headings, no custom blocks.
export const rimProseSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph:         defaultBlockSpecs.paragraph,
    bulletListItem:    defaultBlockSpecs.bulletListItem,
    numberedListItem:  defaultBlockSpecs.numberedListItem,
    quote:             defaultBlockSpecs.quote,
  },
});

/** The set of container block types (content: "none" with children). */
export const CONTAINER_BLOCK_TYPES = new Set<string>([
  "callout",
  "practiceSuggestion",
  "reflection",
]);
