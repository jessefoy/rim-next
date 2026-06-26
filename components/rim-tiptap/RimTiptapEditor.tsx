"use client";

/**
 * RimTiptapEditor — canonical RIM rich-text editor (Tiptap-based).
 *
 * One component, three variants. Storage is plain HTML.
 *
 *   minimal  — bold, italic, link. Inline form fields, member notes.
 *   message  — minimal + paragraphs, lists, blockquote, code, smart typography.
 *              No headings, no images, no tables. Used for conversations,
 *              welcome/home, support replies, banners.
 *   document — message + headings (H2/H3), tables, images, callouts, and the
 *              dharma blocks (pull quote, verse quote, practice suggestion,
 *              reflection). Used for hub documents, manual sections, program
 *              descriptions, lesson bodies.
 *
 * Chrome:
 *   Bear-style bubble menu (selection toolbar) — every variant.
 *   Floating "+" menu on empty lines — message + document.
 *
 * Image upload uses Vercel Blob client upload via /api/upload.
 */

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  Bold, Italic, Underline as UIcon, Strikethrough, Code, Link as LinkIcon,
  List, ListOrdered, Quote, Heading2, Heading3, Heading4, Highlighter,
  Image as ImageIcon, Table as TableIcon,
  CheckSquare, Footprints, BookOpen, MessageCircleQuestion, Lightbulb, CheckCircle2,
  Minus, Undo2, Redo2,
} from "lucide-react";
import { Callout } from "./extensions/Callout";
import { PullQuote } from "./extensions/PullQuote";
import { VerseQuote } from "./extensions/VerseQuote";
import { PracticeSuggestion } from "./extensions/PracticeSuggestion";
import { Reflection } from "./extensions/Reflection";

// "doc" is the hub-document surface: a contained, Simple-Editor-style page with a
// sticky toolbar (no floating bubble) and the title rendered inside the frame.
// It shares the "document" extension set (so existing callout/dharma content is
// preserved on edit) but surfaces only standard blocks in its toolbar.
export type RimTiptapVariant = "minimal" | "message" | "document" | "doc";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  variant?: RimTiptapVariant;
  /** Optional className appended to the editor wrapper. */
  className?: string;
  /** If true, the editor is read-only (still renders as Tiptap). */
  readOnly?: boolean;
  /** Title slot — rendered inside the editor frame above the body. Used by the
   *  "doc" variant so the document name lives inside the contained surface.
   *  The value is owned by the parent and saved as a separate field. */
  title?: string;
  onTitleChange?: (value: string) => void;
  titlePlaceholder?: string;
}

export default function RimTiptapEditor({
  value,
  onChange,
  placeholder = "Start writing…",
  variant = "message",
  className,
  readOnly = false,
  title,
  onTitleChange,
  titlePlaceholder = "Untitled document",
}: Props) {
  const editor = useEditor({
    extensions: buildExtensions(variant, placeholder),
    content: value || "",
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  });

  if (!editor) return null;

  return (
    <div className={`rt-wrap rt-wrap--${variant}${className ? ` ${className}` : ""}`}>
      {!readOnly && variant === "doc" && <DocToolbar editor={editor} />}
      {!readOnly && (variant === "message" || variant === "document") && (
        <Toolbar editor={editor} variant={variant} />
      )}

      {/* Title slot — the "doc" variant renders the document name inside the
          frame, above the body, so the whole document reads as one contained
          surface. The value is owned by the parent (saved as a separate field). */}
      {variant === "doc" && onTitleChange && (
        <input
          className="rt-title"
          type="text"
          value={title ?? ""}
          placeholder={titlePlaceholder}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label="Document title"
        />
      )}

      {/* Selection bubble menu — appears next to selected text. Every variant
          except "doc", which uses a sticky toolbar instead of a floating pill. */}
      {!readOnly && variant !== "doc" && (
        <BubbleMenu
          editor={editor}
          options={{ placement: "top", offset: 8 }}
          shouldShow={({ editor: ed, from, to }) => {
            if (readOnly) return false;
            if (from === to) return false;
            return ed.isEditable;
          }}
        >
          {variant === "minimal" ? (
            <MinimalBubble editor={editor} />
          ) : variant === "message" ? (
            <MessageBubble editor={editor} />
          ) : (
            <DocumentBubble editor={editor} />
          )}
        </BubbleMenu>
      )}

      <EditorContent editor={editor} className="rt-content" />
    </div>
  );
}

/* ─── Extension config per variant ──────────────────────────────────────── */

function buildExtensions(variant: RimTiptapVariant, placeholder: string) {
  // "document" and "doc" both get the full rich block set. They differ only in
  // chrome (doc = sticky toolbar, no bubble, standard blocks surfaced).
  const rich = variant === "document" || variant === "doc";
  const base = [
    StarterKit.configure({
      // We always include heading; we'll restrict levels in `message` via toolbar
      heading: rich ? { levels: [2, 3, 4] } : false,
      // Remove default codeBlock for minimal; keep otherwise
      codeBlock: variant === "minimal" ? false : {},
      // Remove default blockquote for minimal
      blockquote: variant === "minimal" ? false : {},
      bulletList: variant === "minimal" ? false : {},
      orderedList: variant === "minimal" ? false : {},
      horizontalRule: rich ? {} : false,
    }),
    Placeholder.configure({ placeholder }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      protocols: ["http", "https", "mailto", "tel"],
      HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
    }),
    Underline,
    Highlight.configure({ multicolor: false }),
  ];

  if (variant === "minimal") return base;

  // message + document
  const messageExtras = [
    Typography, // smart quotes, em-dash, ellipsis
    TaskList,
    TaskItem.configure({ nested: true }),
  ];

  if (variant === "message") return [...base, ...messageExtras];

  // document only
  const documentExtras = [
    Image.configure({
      inline: false,
      allowBase64: false,
      HTMLAttributes: { class: "rt-img" },
    }),
    Table.configure({ resizable: true, HTMLAttributes: { class: "rt-table" } }),
    TableRow,
    TableHeader,
    TableCell,
    Callout,
    PullQuote,
    VerseQuote,
    PracticeSuggestion,
    Reflection,
  ];

  return [...base, ...messageExtras, ...documentExtras];
}

/* ─── Pinned top toolbar ────────────────────────────────────────────────── */

function Toolbar({ editor, variant }: { editor: Editor; variant: RimTiptapVariant }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openMenu, setOpenMenu] = useState<null | "heading" | "callout" | "dharma">(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close any open dropdown on outside click or Escape
  useEffect(() => {
    if (!openMenu) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!toolbarRef.current?.contains(e.target as Node)) setOpenMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenu(null);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  function pickImage() { fileInputRef.current?.click(); }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const url = await uploadImage(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (err) {
      console.error("Image upload failed:", err);
      window.alert("Could not upload that image.");
    }
  }

  // Heading dropdown label reflects current state
  const headingLabel =
    editor.isActive("heading", { level: 2 }) ? "H2" :
    editor.isActive("heading", { level: 3 }) ? "H3" :
    editor.isActive("heading", { level: 4 }) ? "H4" :
    "Text";

  return (
    <div className="rt-toolbar" role="toolbar" aria-label="Editor toolbar" ref={toolbarRef}>
      {/* Heading dropdown (document only) */}
      {variant === "document" && (
        <>
          <TDropdown
            renderTrigger={(toggle, open) => (
              <button
                type="button"
                className={`rt-toolbar__btn rt-toolbar__btn--label${open ? " rt-toolbar__btn--active" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); toggle(); }}
                title="Text style"
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <span className="rt-toolbar__label">{headingLabel}</span>
                <span className="rt-toolbar__caret" aria-hidden="true">▾</span>
              </button>
            )}
            open={openMenu === "heading"}
            onOpenChange={(o) => setOpenMenu(o ? "heading" : null)}
            items={[
              { label: "Paragraph",  onClick: () => editor.chain().focus().setParagraph().run() },
              { label: "Heading 2",  onClick: () => editor.chain().focus().setHeading({ level: 2 }).run() },
              { label: "Heading 3",  onClick: () => editor.chain().focus().setHeading({ level: 3 }).run() },
              { label: "Heading 4",  onClick: () => editor.chain().focus().setHeading({ level: 4 }).run() },
            ]}
          />
          <TSep />
        </>
      )}

      {/* Block-level toggles (lists + quote). Inline marks (B/I/U/S/Code/Link)
          are handled by the selection bubble menu — keeping them out of the
          top toolbar reduces clutter and avoids duplicating discovery paths. */}
      <TBtn editor={editor} cmd={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list" icon={List} />
      <TBtn editor={editor} cmd={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list" icon={ListOrdered} />
      <TBtn editor={editor} cmd={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} title="Checklist" icon={CheckSquare} />
      <TBtn editor={editor} cmd={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Quote" icon={Quote} />

      {variant === "document" && (
        <>
          <TSep />
          <TBtn editor={editor} cmd={pickImage} active={false} title="Image" icon={ImageIcon} />
          <TBtn editor={editor} cmd={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} active={false} title="Table" icon={TableIcon} />
          <TBtn editor={editor} cmd={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Divider" icon={Minus} />

          <TSep />
          {/* Callouts dropdown */}
          <TDropdown
            renderTrigger={(toggle, open) => (
              <button
                type="button"
                className={`rt-toolbar__btn${open ? " rt-toolbar__btn--active" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); toggle(); }}
                title="Callout"
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <Lightbulb size={15} strokeWidth={2} />
                <span className="rt-toolbar__caret" aria-hidden="true">▾</span>
              </button>
            )}
            open={openMenu === "callout"}
            onOpenChange={(o) => setOpenMenu(o ? "callout" : null)}
            items={[
              { label: "Note", icon: Lightbulb, onClick: () => editor.chain().focus().setCallout({ variant: "note" }).run() },
              { label: "Decision", icon: CheckCircle2, onClick: () => editor.chain().focus().setCallout({ variant: "decision" }).run() },
            ]}
          />
          {/* Dharma blocks dropdown */}
          <TDropdown
            renderTrigger={(toggle, open) => (
              <button
                type="button"
                className={`rt-toolbar__btn${open ? " rt-toolbar__btn--active" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); toggle(); }}
                title="Dharma block"
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <BookOpen size={15} strokeWidth={2} />
                <span className="rt-toolbar__caret" aria-hidden="true">▾</span>
              </button>
            )}
            open={openMenu === "dharma"}
            onOpenChange={(o) => setOpenMenu(o ? "dharma" : null)}
            items={[
              { label: "Pull quote", icon: Quote, onClick: () => editor.chain().focus().setPullQuote().run() },
              { label: "Verse quote", icon: BookOpen, onClick: () => editor.chain().focus().setVerseQuote().run() },
              { label: "Practice suggestion", icon: Footprints, onClick: () => editor.chain().focus().setPracticeSuggestion().run() },
              { label: "Reflection", icon: MessageCircleQuestion, onClick: () => editor.chain().focus().setReflection().run() },
            ]}
          />
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onFile}
      />
    </div>
  );
}

/* ─── Doc-variant toolbar (sticky, Simple-Editor style) ─────────────────────
   The hub-document editor uses a visible, always-on sticky toolbar instead of
   the floating bubble — formatting is in plain sight, which suits writers who
   aren't power users. Standard blocks only; the dharma/callout blocks stay
   registered (so existing documents keep their content on edit) but are not
   surfaced here. */
function DocToolbar({ editor }: { editor: Editor }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [headingOpen, setHeadingOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!headingOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!toolbarRef.current?.contains(e.target as Node)) setHeadingOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setHeadingOpen(false); }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [headingOpen]);

  function pickImage() { fileInputRef.current?.click(); }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const url = await uploadImage(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (err) {
      console.error("Image upload failed:", err);
      window.alert("Could not upload that image.");
    }
  }
  function setLink() {
    const previous = editor.getAttributes("link").href;
    const url = window.prompt("URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  const headingLabel =
    editor.isActive("heading", { level: 2 }) ? "Heading 2" :
    editor.isActive("heading", { level: 3 }) ? "Heading 3" :
    editor.isActive("heading", { level: 4 }) ? "Heading 4" :
    "Normal text";

  return (
    <div className="rt-toolbar rt-toolbar--doc" role="toolbar" aria-label="Editor toolbar" ref={toolbarRef}>
      <TDropdown
        renderTrigger={(toggle, open) => (
          <button
            type="button"
            className={`rt-toolbar__btn rt-toolbar__btn--label${open ? " rt-toolbar__btn--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); toggle(); }}
            title="Text style"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <span className="rt-toolbar__label">{headingLabel}</span>
            <span className="rt-toolbar__caret" aria-hidden="true">▾</span>
          </button>
        )}
        open={headingOpen}
        onOpenChange={setHeadingOpen}
        items={[
          { label: "Normal text", onClick: () => editor.chain().focus().setParagraph().run() },
          { label: "Heading 2",   onClick: () => editor.chain().focus().setHeading({ level: 2 }).run() },
          { label: "Heading 3",   onClick: () => editor.chain().focus().setHeading({ level: 3 }).run() },
          { label: "Heading 4",   onClick: () => editor.chain().focus().setHeading({ level: 4 }).run() },
        ]}
      />
      <TSep />
      <TBtn editor={editor} cmd={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold" icon={Bold} />
      <TBtn editor={editor} cmd={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic" icon={Italic} />
      <TBtn editor={editor} cmd={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline" icon={UIcon} />
      <TBtn editor={editor} cmd={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough" icon={Strikethrough} />
      <TSep />
      <TBtn editor={editor} cmd={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list" icon={List} />
      <TBtn editor={editor} cmd={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list" icon={ListOrdered} />
      <TBtn editor={editor} cmd={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} title="Checklist" icon={CheckSquare} />
      <TSep />
      <TBtn editor={editor} cmd={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Quote" icon={Quote} />
      <TBtn editor={editor} cmd={setLink} active={editor.isActive("link")} title="Link" icon={LinkIcon} />
      <TBtn editor={editor} cmd={pickImage} active={false} title="Image" icon={ImageIcon} />
      <TBtn editor={editor} cmd={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} active={false} title="Table" icon={TableIcon} />
      <TBtn editor={editor} cmd={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Divider" icon={Minus} />
      <TSep />
      <TBtn editor={editor} cmd={() => editor.chain().focus().undo().run()} active={false} title="Undo" icon={Undo2} />
      <TBtn editor={editor} cmd={() => editor.chain().focus().redo().run()} active={false} title="Redo" icon={Redo2} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onFile}
      />
    </div>
  );
}

interface DropdownItemSpec {
  label: string;
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  onClick: () => void;
}

function TDropdown({
  open,
  onOpenChange,
  items,
  renderTrigger,
}: {
  renderTrigger: (toggle: () => void, open: boolean) => React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: DropdownItemSpec[];
}) {
  const toggle = () => onOpenChange(!open);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [flipRight, setFlipRight] = useState(false);

  // After open, measure the dropdown — if it overflows the viewport's right
  // edge, flip alignment so it opens to the left of the trigger instead.
  useEffect(() => {
    if (!open) { setFlipRight(false); return; }
    const el = dropdownRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) setFlipRight(true);
  }, [open]);

  return (
    <div className="rt-toolbar__menu">
      {renderTrigger(toggle, open)}
      {open && (
        <div
          ref={dropdownRef}
          className={`rt-toolbar__dropdown${flipRight ? " rt-toolbar__dropdown--right" : ""}`}
          role="menu"
        >
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <button
                key={it.label}
                type="button"
                className="rt-toolbar__dropdown-item"
                role="menuitem"
                onMouseDown={(e) => { e.preventDefault(); it.onClick(); onOpenChange(false); }}
              >
                {Icon ? <Icon size={14} strokeWidth={2} /> : null}
                <span>{it.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TBtn({
  editor: _editor,
  cmd,
  active,
  title,
  icon: Icon,
}: {
  editor: Editor;
  cmd: () => void;
  active: boolean;
  title: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}) {
  return (
    <button
      type="button"
      className={`rt-toolbar__btn${active ? " rt-toolbar__btn--active" : ""}`}
      onMouseDown={(e) => { e.preventDefault(); cmd(); }}
      title={title}
      aria-label={title}
      aria-pressed={active}
    >
      <Icon size={15} strokeWidth={2} />
    </button>
  );
}

function TSep() {
  return <span className="rt-toolbar__sep" aria-hidden="true" />;
}

/* ─── Minimal-variant bubble (selection toolbar) ────────────────────────
   Only used by the minimal variant — it has no top toolbar by design
   (inline form fields), so a small selection bubble is the entire UI. */

function MinimalBubble({ editor }: { editor: Editor }) {
  return (
    <div className="rt-bubble" role="toolbar" aria-label="Format">
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold" icon={Bold} />
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic" icon={Italic} />
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline" icon={UIcon} />
      <span className="rt-bubble__sep" />
      <LinkBtn editor={editor} />
    </div>
  );
}

/* Message bubble: marks + lists + highlight + link. For Hub welcome,
   conversations, replies — any place users format prose without headings. */
function MessageBubble({ editor }: { editor: Editor }) {
  return (
    <div className="rt-bubble" role="toolbar" aria-label="Format">
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold" icon={Bold} />
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic" icon={Italic} />
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline" icon={UIcon} />
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough" icon={Strikethrough} />
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline code" icon={Code} />
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} title="Highlight" icon={Highlighter} />
      <span className="rt-bubble__sep" />
      <LinkBtn editor={editor} />
    </div>
  );
}

/* Document bubble: full formatting parity with the top toolbar (minus
   insertion-only actions like image, table, hr, callouts, dharma blocks).
   Whatever a user can apply to a selection lives here. */
function DocumentBubble({ editor }: { editor: Editor }) {
  return (
    <div className="rt-bubble" role="toolbar" aria-label="Format">
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold" icon={Bold} />
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic" icon={Italic} />
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline" icon={UIcon} />
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough" icon={Strikethrough} />
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline code" icon={Code} />
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} title="Highlight" icon={Highlighter} />
      <span className="rt-bubble__sep" />
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2" icon={Heading2} />
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3" icon={Heading3} />
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} active={editor.isActive("heading", { level: 4 })} title="Heading 4" icon={Heading4} />
      <span className="rt-bubble__sep" />
      <LinkBtn editor={editor} />
    </div>
  );
}

function Btn({
  editor,
  cmd,
  active,
  title,
  icon: Icon,
}: {
  editor: Editor;
  cmd: () => void;
  active: boolean;
  title: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}) {
  return (
    <button
      type="button"
      className={`rt-bubble__btn${active ? " rt-bubble__btn--active" : ""}`}
      onMouseDown={(e) => { e.preventDefault(); cmd(); }}
      title={title}
      aria-label={title}
      aria-pressed={active}
    >
      <Icon size={15} strokeWidth={2} />
    </button>
  );
}

function LinkBtn({ editor }: { editor: Editor }) {
  function onClick() {
    const previous = editor.getAttributes("link").href;
    const url = window.prompt("URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }
  return (
    <button
      type="button"
      className={`rt-bubble__btn${editor.isActive("link") ? " rt-bubble__btn--active" : ""}`}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title="Link"
      aria-label="Link"
    >
      <LinkIcon size={15} strokeWidth={2} />
    </button>
  );
}

/* ─── Image upload (Vercel Blob client) ─────────────────────────────────── */

async function uploadImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 60);
  const uniqueName = `rim-tiptap/${Date.now()}-${safe}.${ext}`;
  const blob = await upload(uniqueName, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
  });
  return blob.url;
}
