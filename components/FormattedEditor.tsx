"use client"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import Typography from "@tiptap/extension-typography"
import CharacterCount from "@tiptap/extension-character-count"
import { Markdown } from "tiptap-markdown"

interface Props {
  value: any           // Tiptap JSON or null
  onChange: (json: any) => void
  placeholder?: string
  minHeight?: number
  maxChars?: number
}

export default function FormattedEditor({
  value,
  onChange,
  placeholder = "Write here…",
  minHeight = 200,
  maxChars,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Typography,
      CharacterCount.configure({ limit: maxChars ?? undefined }),
    ],
    content: value ?? "",
    onUpdate({ editor }) {
      onChange(editor.getJSON())
    },
  })

  if (!editor) return null

  return (
    <div className="rte-editor">
      <div className="rte-editor__toolbar">
        <button type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? "rte-btn rte-btn--active" : "rte-btn"}
        ><strong>B</strong></button>

        <button type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? "rte-btn rte-btn--active" : "rte-btn"}
        ><em>I</em></button>

        <button type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive("underline") ? "rte-btn rte-btn--active" : "rte-btn"}
          title="Underline"
        ><u>U</u></button>

        <button type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive("heading", { level: 2 }) ? "rte-btn rte-btn--active" : "rte-btn"}
        >H2</button>

        <button type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive("heading", { level: 3 }) ? "rte-btn rte-btn--active" : "rte-btn"}
        >H3</button>

        <div className="rte-divider" />

        <button type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive("bulletList") ? "rte-btn rte-btn--active" : "rte-btn"}
        >UL</button>

        <button type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive("orderedList") ? "rte-btn rte-btn--active" : "rte-btn"}
        >OL</button>

        <button type="button"
          onClick={() => {
            const url = window.prompt("URL")
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
          className={editor.isActive("link") ? "rte-btn rte-btn--active" : "rte-btn"}
        >Link</button>

        <div className="rte-divider" />

        <button type="button"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={editor.isActive({ textAlign: "left" }) ? "rte-btn rte-btn--active" : "rte-btn"}
          title="Align left"
        >L</button>

        <button type="button"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={editor.isActive({ textAlign: "center" }) ? "rte-btn rte-btn--active" : "rte-btn"}
          title="Align center"
        >C</button>

        <button type="button"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={editor.isActive({ textAlign: "right" }) ? "rte-btn rte-btn--active" : "rte-btn"}
          title="Align right"
        >R</button>
      </div>

      <EditorContent
        editor={editor}
        className="rte-editor__content"
        style={{ minHeight }}
      />

      <div className="rte-editor__footer">
        {maxChars ? (
          <span className={
            editor.storage.characterCount.characters() > maxChars * 0.9
              ? "rte-char-count rte-char-count--warning"
              : "rte-char-count"
          }>
            {editor.storage.characterCount.characters()} / {maxChars} characters
          </span>
        ) : (
          <span className="rte-char-count">
            {editor.storage.characterCount.words()} words
          </span>
        )}
      </div>
    </div>
  )
}
