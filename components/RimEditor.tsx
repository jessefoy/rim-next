"use client";

/**
 * RimEditor — shared rich text editor for all member-area multi-line inputs.
 *
 * Toolbar groups:
 *   Text marks   — Bold, Italic, Underline
 *   Headings     — H2, H3
 *   Lists        — Bullet list, Numbered list
 *   Special      — Blockquote, Horizontal rule, Link
 *   Utility      — Clear formatting
 *
 * Output: markdown string via tiptap-markdown
 * Input:  markdown string (restored from localStorage draft, DB, etc.)
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

import { useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import LinkExt from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import {
  Bold,
  Italic,
  Underline,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link,
  RemoveFormatting,
} from "lucide-react";

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

// Small helper to keep JSX concise
function Btn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`re-btn${active ? " re-btn--active" : ""}`}
      onMouseDown={(e) => { e.preventDefault(); onClick(e); }}
      aria-label={title}
      title={title}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="re-toolbar__sep" role="separator" />;
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
        heading: { levels: [2, 3] },
        codeBlock: false,
        code: false,
      }),
      UnderlineExt,
      LinkExt.configure({
        openOnClick: false,
        autolink: true,
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: false,
      }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate({ editor }) {
      // tiptap-markdown attaches to storage dynamically
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

  const handleLink = useCallback(() => {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("Enter URL:");
    if (!url) return;
    const href = url.startsWith("http") ? url : `https://${url}`;
    editor.chain().focus().setLink({ href }).run();
  }, [editor]);

  const ICON = { size: 15, strokeWidth: 2 };

  return (
    <div className={`re-editor ${className}`} style={{ minHeight: rowsToMinHeight(rows) }}>
      {/* ── Toolbar ── */}
      <div className="re-toolbar" role="toolbar" aria-label="Formatting">

        {/* Group 1: text marks */}
        <Btn active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()} title="Bold">
          <Bold {...ICON} />
        </Btn>
        <Btn active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()} title="Italic">
          <Italic {...ICON} />
        </Btn>
        <Btn active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()} title="Underline">
          <Underline {...ICON} />
        </Btn>

        <Sep />

        {/* Group 2: headings */}
        <Btn active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
          <Heading2 {...ICON} />
        </Btn>
        <Btn active={editor?.isActive("heading", { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
          <Heading3 {...ICON} />
        </Btn>

        <Sep />

        {/* Group 3: lists */}
        <Btn active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Bullet list">
          <List {...ICON} />
        </Btn>
        <Btn active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()} title="Numbered list">
          <ListOrdered {...ICON} />
        </Btn>

        <Sep />

        {/* Group 4: special */}
        <Btn active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()} title="Blockquote">
          <Quote {...ICON} />
        </Btn>
        <Btn onClick={() => editor?.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          <Minus {...ICON} />
        </Btn>
        <Btn active={editor?.isActive("link")} onClick={handleLink} title={editor?.isActive("link") ? "Remove link" : "Insert link"}>
          <Link {...ICON} />
        </Btn>

        <Sep />

        {/* Group 5: utility */}
        <Btn onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear formatting">
          <RemoveFormatting {...ICON} />
        </Btn>

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
