import { generateHTML } from "@tiptap/html"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import Image from "@tiptap/extension-image"
import { Table } from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableHeader from "@tiptap/extension-table-header"
import TableCell from "@tiptap/extension-table-cell"
import { VerseQuote, PracticeSuggestion, Callout } from "./tiptap-extensions"

const contentExtensions = [
  StarterKit,
  Link,
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  VerseQuote,
  PracticeSuggestion,
  Callout,
]

const formattedExtensions = [
  StarterKit,
  Link,
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Image,
]

// ── Format helpers ────────────────────────────────────────────────────────────

export function isBlockNoteJSON(json: any): boolean {
  return (
    Array.isArray(json) &&
    json.length > 0 &&
    typeof json[0] === "object" &&
    json[0] !== null &&
    typeof json[0].type === "string" &&
    "id" in json[0]
  )
}

export function isRawHtml(json: any): boolean {
  return json && typeof json === "object" && json.type === "rawHtml" && typeof json.html === "string"
}

// ── SYNC functions — safe for client components (Tiptap JSON only) ────────────
// DO NOT make these async. Client components call them synchronously in render.
// These remain correct while the database contains Tiptap JSON.
// Phase 3/4 will migrate data and refactor client components to the async path.

export function renderContentBody(json: any): string {
  if (!json) return ""
  if (isRawHtml(json)) return json.html
  try {
    return generateHTML(json, contentExtensions)
  } catch {
    return ""
  }
}

export function renderFormattedText(json: any): string {
  if (!json) return ""
  try {
    return generateHTML(json, formattedExtensions)
  } catch {
    return ""
  }
}

/** Strip HTML tags from rendered content — useful for plain-text emails. */
export function extractText(json: any): string {
  if (!json) return ""
  try {
    const html = generateHTML(json, formattedExtensions)
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  } catch {
    return ""
  }
}
