"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";

/**
 * Minimal TipTap editor — the Webflow paradigm.
 * Standard text formatting only. No custom blocks, no variants.
 * Output: plain HTML.
 */
export default function TiptapEditor({
  value,
  onChange,
  placeholder = "Start writing…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "tt-editor rim-content rim-content--document",
      },
    },
  });

  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    editor ? editor.isActive(name, attrs) : false;

  const promptLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("Link URL", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  const currentBlock = isActive("heading", { level: 1 })
    ? "h1"
    : isActive("heading", { level: 2 })
      ? "h2"
      : isActive("heading", { level: 3 })
        ? "h3"
        : isActive("heading", { level: 4 })
          ? "h4"
          : "p";

  return (
    <div className="tt-wrap">
      {editor && (
      <div className="tt-toolbar">
        <select
          className="tt-select"
          value={currentBlock}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "p") editor.chain().focus().setParagraph().run();
            else
              editor
                .chain()
                .focus()
                .toggleHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 | 4 })
                .run();
          }}
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
        </select>

        <span className="tt-sep" />

        <button
          type="button"
          className={`tt-btn${isActive("bold") ? " is-active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (⌘B)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={`tt-btn${isActive("italic") ? " is-active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (⌘I)"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={`tt-btn${isActive("underline") ? " is-active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline (⌘U)"
        >
          <u>U</u>
        </button>
        <button
          type="button"
          className={`tt-btn${isActive("strike") ? " is-active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <s>S</s>
        </button>
        <button
          type="button"
          className={`tt-btn${isActive("link") ? " is-active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={promptLink}
          title="Link"
        >
          Link
        </button>

        <span className="tt-sep" />

        <button
          type="button"
          className={`tt-btn${isActive("bulletList") ? " is-active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          • List
        </button>
        <button
          type="button"
          className={`tt-btn${isActive("orderedList") ? " is-active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          1. List
        </button>
        <button
          type="button"
          className={`tt-btn${isActive("blockquote") ? " is-active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote"
        >
          ❝ Quote
        </button>
        <button
          type="button"
          className="tt-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Divider"
        >
          ─
        </button>
      </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
