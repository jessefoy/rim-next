"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { Extension } from "@tiptap/core";

/**
 * A minimal TipTap extension that lets us apply a class/variant to block-level
 * nodes (paragraph, blockquote) without introducing new node types. This is
 * the mechanism for "turn this paragraph into an Aside/Practice/etc." —
 * matches Webflow's class-on-element model.
 */
const BlockVariant = Extension.create({
  name: "blockVariant",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "blockquote", "heading"],
        attributes: {
          variant: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-variant"),
            renderHTML: (attrs) => {
              if (!attrs.variant) return {};
              return {
                "data-variant": attrs.variant,
                class: `rim-el-${attrs.variant}`,
              };
            },
          },
        },
      },
    ];
  },
});

const VARIANTS = [
  { id: "aside", label: "Aside" },
  { id: "practice", label: "Practice" },
  { id: "body-quote", label: "Body Quote" },
  { id: "verse", label: "Verse" },
  { id: "pull", label: "Pull Quote" },
];

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
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        horizontalRule: {},
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
      BlockVariant,
    ],
    content: value || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "tt-editor rim-content rim-content--document",
      },
    },
  });

  if (!editor) return <div className="tt-loading">Loading editor…</div>;

  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    editor.isActive(name, attrs);

  const setVariant = (variant: string | null) => {
    if (!variant) {
      editor.chain().focus().updateAttributes("paragraph", { variant: null }).run();
      editor.chain().focus().updateAttributes("blockquote", { variant: null }).run();
      return;
    }
    const type = editor.isActive("blockquote") ? "blockquote" : "paragraph";
    editor.chain().focus().updateAttributes(type, { variant }).run();
  };

  const promptLink = () => {
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("Link URL", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  return (
    <div className="tt-wrap">
      <div className="tt-toolbar">
        <select
          className="tt-select"
          value={
            isActive("heading", { level: 2 })
              ? "h2"
              : isActive("heading", { level: 3 })
                ? "h3"
                : isActive("heading", { level: 4 })
                  ? "h4"
                  : "p"
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v === "p") editor.chain().focus().setParagraph().run();
            else
              editor
                .chain()
                .focus()
                .toggleHeading({ level: Number(v.slice(1)) as 2 | 3 | 4 })
                .run();
          }}
        >
          <option value="p">Paragraph</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
        </select>

        <span className="tt-sep" />

        <button
          type="button"
          className={`tt-btn${isActive("bold") ? " is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (⌘B)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={`tt-btn${isActive("italic") ? " is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (⌘I)"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={`tt-btn${isActive("underline") ? " is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline (⌘U)"
        >
          <u>U</u>
        </button>
        <button
          type="button"
          className={`tt-btn${isActive("strike") ? " is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <s>S</s>
        </button>
        <button
          type="button"
          className={`tt-btn${isActive("link") ? " is-active" : ""}`}
          onClick={promptLink}
          title="Link"
        >
          Link
        </button>

        <span className="tt-sep" />

        <button
          type="button"
          className={`tt-btn${isActive("bulletList") ? " is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          • List
        </button>
        <button
          type="button"
          className={`tt-btn${isActive("orderedList") ? " is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          1. List
        </button>
        <button
          type="button"
          className={`tt-btn${isActive("blockquote") ? " is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote"
        >
          ❝ Quote
        </button>
        <button
          type="button"
          className="tt-btn"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Divider"
        >
          ─
        </button>

        <span className="tt-sep" />

        <span className="tt-group-label">Variant:</span>
        <button
          type="button"
          className="tt-btn tt-btn--ghost"
          onClick={() => setVariant(null)}
          title="Clear variant"
        >
          None
        </button>
        {VARIANTS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`tt-btn${
              isActive("paragraph", { variant: v.id }) ||
              isActive("blockquote", { variant: v.id })
                ? " is-active"
                : ""
            }`}
            onClick={() => setVariant(v.id)}
            title={`Apply ${v.label} variant`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {editor && (
        <BubbleMenu editor={editor} className="tt-bubble">
          <button
            type="button"
            className={`tt-btn${isActive("bold") ? " is-active" : ""}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className={`tt-btn${isActive("italic") ? " is-active" : ""}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            className={`tt-btn${isActive("link") ? " is-active" : ""}`}
            onClick={promptLink}
          >
            Link
          </button>
        </BubbleMenu>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
