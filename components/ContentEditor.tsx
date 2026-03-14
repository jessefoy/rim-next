"use client"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import { Markdown } from "tiptap-markdown"
import { VerseQuote, PracticeSuggestion, Callout } from "@/lib/tiptap-extensions"

interface Props {
  value: any
  onChange: (json: any) => void
  placeholder?: string
  minHeight?: number
}

export default function ContentEditor({
  value,
  onChange,
  placeholder = "Begin writing…",
  minHeight = 420,
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
      VerseQuote,
      PracticeSuggestion,
      Callout,
    ],
    content: value ?? "",
    onUpdate({ editor }) {
      onChange(editor.getJSON())
    },
  })

  if (!editor) return null

  const insertBlock = (type: "verseQuote" | "practiceSuggestion" | "callout") => {
    editor.chain().focus().insertContent({ type, content: [] }).run()
  }

  return (
    <div className="rte-editor rte-editor--content">
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
          onClick={() => insertBlock("verseQuote")}
          className="rte-btn rte-btn--block"
        >+ Verse</button>

        <button type="button"
          onClick={() => insertBlock("practiceSuggestion")}
          className="rte-btn rte-btn--block"
        >+ Practice</button>

        <button type="button"
          onClick={() => insertBlock("callout")}
          className="rte-btn rte-btn--block"
        >+ Callout</button>
      </div>

      <EditorContent
        editor={editor}
        className="rte-editor__content"
        style={{ minHeight }}
      />
    </div>
  )
}
