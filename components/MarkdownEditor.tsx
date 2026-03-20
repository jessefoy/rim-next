"use client";

/**
 * MarkdownEditor — Tiptap-based markdown editor for email templates.
 *
 * This is NOT the standard editor for the platform. For all rich text fields
 * (notes, messages, documents, descriptions), use RimBlockEditor or RimProseEditor
 * which store BlockNote JSON. See RIM_Editor_Design.md.
 *
 * This editor exists solely for email templates, where markdown → marked() → juice()
 * → Resend is the correct pipeline for email-safe HTML output.
 *
 * Toolbar groups:
 *   Text marks   — Bold, Italic, Underline
 *   Headings     — H2, H3
 *   Lists        — Bullet list, Numbered list
 *   Special      — Blockquote, Horizontal rule, Link (inline popover)
 *   Utility      — Clear formatting
 *
 * Output: markdown string via tiptap-markdown
 * Input:  markdown string
 *
 * Has a VariableNode extension for email template {{variables}}.
 *
 * CSS prefix: re-
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import LinkExt from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import { VariableNode } from "@/lib/tiptap-variable-node";
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
  /** Populated with the Tiptap Editor instance once initialised. */
  editorRef?: React.MutableRefObject<Editor | null>;
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

export default function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 5,
  className = "",
  editorRef,
}: Props) {
  // Link popover state
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl]               = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);
  const popoverRef   = useRef<HTMLDivElement>(null);

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
      VariableNode,
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

  // Expose editor instance to parent via editorRef
  useEffect(() => {
    if (editorRef) editorRef.current = editor;
  }, [editor, editorRef]);

  // Sync external value changes (e.g. draft restore sets state → prop changes)
  useEffect(() => {
    if (!editor) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = (editor.storage as unknown as any).markdown.getMarkdown() as string;
    if (current !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close link popover on outside click
  useEffect(() => {
    if (!linkPopoverOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setLinkPopoverOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [linkPopoverOpen]);

  // Open popover: pre-fill with current link href if active
  const openLinkPopover = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!editor) return;
    if (editor.isActive("link")) {
      // If already a link, remove it without opening the popover
      editor.chain().focus().unsetLink().run();
      return;
    }
    const existing = editor.getAttributes("link").href ?? "";
    setLinkUrl(existing);
    setLinkPopoverOpen(true);
    // Focus the input after render
    setTimeout(() => linkInputRef.current?.focus(), 0);
  }, [editor]);

  // Apply the link URL from the popover
  const applyLink = useCallback(() => {
    if (!editor) return;
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
    } else {
      const href = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
      editor.chain().focus().setLink({ href }).run();
    }
    setLinkPopoverOpen(false);
  }, [editor, linkUrl]);

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

        {/* Link button + inline popover */}
        <div className="re-link-wrap" ref={popoverRef}>
          <Btn
            active={editor?.isActive("link")}
            onClick={openLinkPopover}
            title={editor?.isActive("link") ? "Remove link" : "Insert link"}
          >
            <Link {...ICON} />
          </Btn>
          {linkPopoverOpen && (
            <div className="re-link-popover" onPointerDown={(e) => e.stopPropagation()}>
              <input
                ref={linkInputRef}
                className="re-link-popover__input"
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); applyLink(); }
                  if (e.key === "Escape") setLinkPopoverOpen(false);
                }}
              />
              <button
                type="button"
                className="re-link-popover__apply"
                onMouseDown={(e) => { e.preventDefault(); applyLink(); }}
              >
                Apply
              </button>
            </div>
          )}
        </div>

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
