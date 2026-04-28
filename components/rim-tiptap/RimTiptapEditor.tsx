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
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
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
import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  Bold, Italic, Underline as UIcon, Strikethrough, Code, Link as LinkIcon,
  List, ListOrdered, Quote, Heading2, Heading3, Image as ImageIcon, Table as TableIcon,
  CheckSquare, Sparkles, BookOpen, MessageCircleQuestion, Lightbulb, CheckCircle2,
  Plus, Minus,
} from "lucide-react";
import { Callout } from "./extensions/Callout";
import { PullQuote } from "./extensions/PullQuote";
import { VerseQuote } from "./extensions/VerseQuote";
import { PracticeSuggestion } from "./extensions/PracticeSuggestion";
import { Reflection } from "./extensions/Reflection";

export type RimTiptapVariant = "minimal" | "message" | "document";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  variant?: RimTiptapVariant;
  /** Optional className appended to the editor wrapper. */
  className?: string;
  /** If true, the editor is read-only (still renders as Tiptap). */
  readOnly?: boolean;
}

export default function RimTiptapEditor({
  value,
  onChange,
  placeholder = "Start writing…",
  variant = "message",
  className,
  readOnly = false,
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
      {variant !== "minimal" && !readOnly && (
        <Toolbar editor={editor} variant={variant} />
      )}

      <BubbleMenu
        editor={editor}
        options={{ placement: "top", offset: 8 }}
        shouldShow={({ editor: ed, from, to }) => {
          if (readOnly) return false;
          if (from === to) return false;
          return ed.isEditable;
        }}
      >
        <BubbleToolbar editor={editor} variant={variant} />
      </BubbleMenu>

      {variant !== "minimal" && (
        <FloatingMenu
          editor={editor}
          options={{ placement: "left-start", offset: 8 }}
          shouldShow={({ editor: ed, state }) => {
            if (readOnly) return false;
            if (!ed.isEditable) return false;
            const { $from } = state.selection;
            const isEmptyParagraph =
              $from.parent.type.name === "paragraph" && $from.parent.content.size === 0;
            return isEmptyParagraph;
          }}
        >
          <FloatingPlusMenu editor={editor} variant={variant} />
        </FloatingMenu>
      )}

      <EditorContent editor={editor} className="rt-content" />
    </div>
  );
}

/* ─── Extension config per variant ──────────────────────────────────────── */

function buildExtensions(variant: RimTiptapVariant, placeholder: string) {
  const base = [
    StarterKit.configure({
      // We always include heading; we'll restrict levels in `message` via toolbar
      heading: variant === "document" ? { levels: [2, 3, 4] } : false,
      // Remove default codeBlock for minimal; keep otherwise
      codeBlock: variant === "minimal" ? false : {},
      // Remove default blockquote for minimal
      blockquote: variant === "minimal" ? false : {},
      bulletList: variant === "minimal" ? false : {},
      orderedList: variant === "minimal" ? false : {},
      horizontalRule: variant === "document" ? {} : false,
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
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="rt-toolbar" role="toolbar" aria-label="Editor toolbar">
      {/* Inline formatting */}
      <TBtn editor={editor} cmd={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold" icon={Bold} />
      <TBtn editor={editor} cmd={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic" icon={Italic} />
      <TBtn editor={editor} cmd={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline" icon={UIcon} />
      <TBtn editor={editor} cmd={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough" icon={Strikethrough} />
      <TBtn editor={editor} cmd={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline code" icon={Code} />
      <TSep />
      <TBtn editor={editor} cmd={setLink} active={editor.isActive("link")} title="Link" icon={LinkIcon} />

      {variant === "document" && (
        <>
          <TSep />
          <TBtn editor={editor} cmd={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2" icon={Heading2} />
          <TBtn editor={editor} cmd={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3" icon={Heading3} />
        </>
      )}

      <TSep />
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

/* ─── Bubble menu (selection toolbar) ───────────────────────────────────── */

function BubbleToolbar({ editor, variant }: { editor: Editor; variant: RimTiptapVariant }) {
  return (
    <div className="rt-bubble" role="toolbar" aria-label="Format">
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold" icon={Bold} />
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic" icon={Italic} />
      <Btn editor={editor} cmd={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline" icon={UIcon} />
      {variant !== "minimal" && (
        <Btn editor={editor} cmd={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough" icon={Strikethrough} />
      )}
      {variant !== "minimal" && (
        <Btn editor={editor} cmd={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline code" icon={Code} />
      )}
      <span className="rt-bubble__sep" />
      <LinkBtn editor={editor} />
      {variant === "document" && (
        <>
          <span className="rt-bubble__sep" />
          <Btn editor={editor} cmd={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2" icon={Heading2} />
          <Btn editor={editor} cmd={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3" icon={Heading3} />
        </>
      )}
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

/* ─── Floating "+" pill on empty lines ──────────────────────────────────── */

function FloatingPlusMenu({ editor, variant }: { editor: Editor; variant: RimTiptapVariant }) {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function close() { setOpen(false); }

  async function pickImage() {
    fileInputRef.current?.click();
  }

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
    close();
  }

  return (
    <div className="rt-plus">
      <button
        type="button"
        className="rt-plus__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Insert"
      >
        <Plus size={14} strokeWidth={2.5} />
      </button>
      {open && (
        <div className="rt-plus__menu" role="menu">
          <PlusItem
            label="Bullet list"
            icon={List}
            onClick={() => { editor.chain().focus().toggleBulletList().run(); close(); }}
          />
          <PlusItem
            label="Numbered list"
            icon={ListOrdered}
            onClick={() => { editor.chain().focus().toggleOrderedList().run(); close(); }}
          />
          <PlusItem
            label="Checklist"
            icon={CheckSquare}
            onClick={() => { editor.chain().focus().toggleTaskList().run(); close(); }}
          />
          <PlusItem
            label="Quote"
            icon={Quote}
            onClick={() => { editor.chain().focus().toggleBlockquote().run(); close(); }}
          />
          {variant === "document" && (
            <>
              <div className="rt-plus__sep" />
              <PlusItem
                label="Heading 2"
                icon={Heading2}
                onClick={() => { editor.chain().focus().setHeading({ level: 2 }).run(); close(); }}
              />
              <PlusItem
                label="Heading 3"
                icon={Heading3}
                onClick={() => { editor.chain().focus().setHeading({ level: 3 }).run(); close(); }}
              />
              <div className="rt-plus__sep" />
              <PlusItem
                label="Image"
                icon={ImageIcon}
                onClick={pickImage}
              />
              <PlusItem
                label="Table"
                icon={TableIcon}
                onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); close(); }}
              />
              <PlusItem
                label="Divider"
                icon={Minus}
                onClick={() => { editor.chain().focus().setHorizontalRule().run(); close(); }}
              />
              <div className="rt-plus__sep" />
              <div className="rt-plus__group-label">Callouts</div>
              <PlusItem
                label="Note"
                icon={Lightbulb}
                onClick={() => { editor.chain().focus().setCallout({ variant: "note" }).run(); close(); }}
              />
              <PlusItem
                label="Decision"
                icon={CheckCircle2}
                onClick={() => { editor.chain().focus().setCallout({ variant: "decision" }).run(); close(); }}
              />
              <div className="rt-plus__sep" />
              <div className="rt-plus__group-label">Dharma blocks</div>
              <PlusItem
                label="Pull quote"
                icon={Sparkles}
                onClick={() => { editor.chain().focus().setPullQuote().run(); close(); }}
              />
              <PlusItem
                label="Verse quote"
                icon={BookOpen}
                onClick={() => { editor.chain().focus().setVerseQuote().run(); close(); }}
              />
              <PlusItem
                label="Practice suggestion"
                icon={Sparkles}
                onClick={() => { editor.chain().focus().setPracticeSuggestion().run(); close(); }}
              />
              <PlusItem
                label="Reflection"
                icon={MessageCircleQuestion}
                onClick={() => { editor.chain().focus().setReflection().run(); close(); }}
              />
            </>
          )}
        </div>
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

function PlusItem({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  onClick: () => void;
}) {
  return (
    <button type="button" className="rt-plus__item" role="menuitem" onClick={onClick}>
      <Icon size={14} strokeWidth={2} />
      <span>{label}</span>
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
