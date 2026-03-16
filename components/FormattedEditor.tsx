"use client"
import { useRef, useEffect } from "react"
import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import Typography from "@tiptap/extension-typography"
import CharacterCount from "@tiptap/extension-character-count"
import Image from "@tiptap/extension-image"
import { Markdown } from "tiptap-markdown"
import { upload } from "@vercel/blob/client"

interface Props {
  value: any           // Tiptap JSON or null
  onChange: (json: any) => void
  placeholder?: string
  minHeight?: number
  maxChars?: number
  context?: string     // "support-reply" enables image insert button
  editorRef?: React.MutableRefObject<Editor | null>
}

export default function FormattedEditor({
  value,
  onChange,
  placeholder = "Write here…",
  minHeight = 200,
  maxChars,
  context,
  editorRef,
}: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const showImageButton = context === "support-reply"

  const extensions = [
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
    ...(showImageButton ? [Image.configure({ inline: false })] : []),
  ]

  const editor = useEditor({
    extensions,
    content: value ?? "",
    onUpdate({ editor }) {
      onChange(editor.getJSON())
    },
  })

  // Expose editor instance to parent via ref
  useEffect(() => {
    if (editorRef && editor) {
      editorRef.current = editor
    }
  }, [editor, editorRef])

  const handleImageInsert = async (files: FileList | null) => {
    if (!files || !files[0] || !editor) return
    const file = files[0]
    if (!file.type.startsWith("image/")) return
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      })
      editor.chain().focus().setImage({ src: blob.url, alt: file.name }).run()
    } catch {
      // silently fail — user can try again
    }
    if (imageInputRef.current) imageInputRef.current.value = ""
  }

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

        {showImageButton && (
          <>
            <div className="rte-divider" />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => handleImageInsert(e.target.files)}
            />
            <button type="button"
              onClick={() => imageInputRef.current?.click()}
              className="rte-btn"
              title="Insert image"
            >🖼</button>
          </>
        )}
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
