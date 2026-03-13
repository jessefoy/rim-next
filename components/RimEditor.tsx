"use client";

/**
 * RimEditor — shared rich text editor for all member-area multi-line inputs.
 *
 * Toolbar: Bold · Italic · H2 · H3 · Bullet list · Numbered list · Blockquote · Link
 * Output: markdown string via tiptap-markdown
 * Input: markdown string (restored from localStorage draft, DB, etc.)
 *
 * Props mirror a controlled <textarea>:
 *   value     — current markdown string
 *   onChange  — called with updated markdown on every change
 *   rows      — approximate visible height (default 5); maps to min-height
 *   placeholder
 *   className — extra class on the outer wrapper
 *
 * CSS prefix: re-
 */

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

// Approx: each "row" ≈ 32px (comfortable line height) + 52px for toolbar + padding floor
function rowsToMinHeight(rows: number) {
  return `${Math.max(rows * 32 + 52, 120)}px`;
}

export default function RimEditor({
  value,
  onChange,
  placeholder,
  rows = 5,
  className = "",
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable heading levels we don't want
        heading: { levels: [2, 3] },
        // Disable code block (not needed in member area)
        codeBlock: false,
        code: false,
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: false,
      }),
    ],
    content: value,            // initial markdown → parsed by extension
    immediatelyRender: false,  // SSR safety
    onUpdate({ editor }) {
      // tiptap-markdown attaches to storage dynamically; use unknown intermediary
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = (editor.storage as unknown as any).markdown.getMarkdown() as string;
      onChange(md);
    },
  });

  // Sync external value changes (e.g. draft restore sets state → prop changes)
  useEffect(() => {
    if (!editor) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = (editor.storage as unknown as any).markdown.getMarkdown() as string;
    if (current !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`re-editor ${className}`} style={{ minHeight: rowsToMinHeight(rows) }}>
      {/* ── Toolbar ── */}
      <div className="re-toolbar" role="toolbar" aria-label="Formatting">
        <button
          type="button"
          className={`re-btn${editor?.isActive("bold") ? " re-btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleBold().run(); }}
          aria-label="Bold"
          title="Bold"
        >
          <strong>B</strong>
        </button>

        <button
          type="button"
          className={`re-btn${editor?.isActive("italic") ? " re-btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleItalic().run(); }}
          aria-label="Italic"
          title="Italic"
        >
          <em>I</em>
        </button>

        <div className="re-toolbar__sep" role="separator" />

        <button
          type="button"
          className={`re-btn${editor?.isActive("heading", { level: 2 }) ? " re-btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleHeading({ level: 2 }).run(); }}
          aria-label="Heading 2"
          title="Heading 2"
        >
          H2
        </button>

        <button
          type="button"
          className={`re-btn${editor?.isActive("heading", { level: 3 }) ? " re-btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleHeading({ level: 3 }).run(); }}
          aria-label="Heading 3"
          title="Heading 3"
        >
          H3
        </button>

        <div className="re-toolbar__sep" role="separator" />

        <button
          type="button"
          className={`re-btn${editor?.isActive("bulletList") ? " re-btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleBulletList().run(); }}
          aria-label="Bullet list"
          title="Bullet list"
        >
          ≡
        </button>

        <button
          type="button"
          className={`re-btn${editor?.isActive("orderedList") ? " re-btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleOrderedList().run(); }}
          aria-label="Numbered list"
          title="Numbered list"
        >
          1.
        </button>

        <div className="re-toolbar__sep" role="separator" />

        <button
          type="button"
          className={`re-btn${editor?.isActive("blockquote") ? " re-btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleBlockquote().run(); }}
          aria-label="Blockquote"
          title="Blockquote"
        >
          "
        </button>
      </div>

      {/* ── Editor area ── */}
      <EditorContent
        editor={editor}
        className="re-content"
        data-placeholder={placeholder}
      />
    </div>
  );
}
