/**
 * renderRichContentServer.ts
 *
 * Async render functions for SERVER COMPONENTS AND API ROUTES ONLY.
 *
 * Handles both BlockNote JSON (new format) and Tiptap JSON (legacy — present
 * in the database until the migration script has been run).
 *
 * @blocknote/server-util is dynamically imported to prevent Turbopack from
 * evaluating the JSDOM-heavy module at build time.
 *
 * Never import this file from a client component.
 *
 * TODO: Remove the Tiptap fallback after running prisma/migrate-to-blocknote.ts
 * and confirming all records are converted.
 */

import "server-only"
import { isBlockNoteJSON, isRawHtml } from "./renderRichContent"
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

const contentExtensions = [
  StarterKit, Link, Underline,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Table.configure({ resizable: false }),
  TableRow, TableHeader, TableCell,
]

const formattedExtensions = [
  StarterKit, Link, Underline,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Image,
]

function isTiptapJSON(json: any): boolean {
  return (
    json !== null &&
    typeof json === "object" &&
    !Array.isArray(json) &&
    json.type === "doc" &&
    Array.isArray(json.content)
  )
}

// ── BlockNote server renderer — lazy-loaded ───────────────────────────────────

async function blockNoteToHTML(json: any[]): Promise<string> {
  try {
    const { ServerBlockNoteEditor } = await import("@blocknote/server-util")
    const editor = ServerBlockNoteEditor.create()
    return await editor.blocksToHTMLLossy(json)
  } catch (e) {
    console.error("[renderRichContentServer] BlockNote render failed:", e)
    return ""
  }
}

// ── ASYNC functions — server components / API routes only ─────────────────────

/**
 * Render full editor content (lessons, manual sections, program descriptions).
 * Handles BlockNote JSON, legacy rawHtml, and legacy Tiptap JSON.
 */
export async function renderContentBodyAsync(json: any): Promise<string> {
  if (!json) return ""
  if (isRawHtml(json)) return json.html
  if (isBlockNoteJSON(json)) return blockNoteToHTML(json)
  // Legacy Tiptap JSON — present until migration script is run
  if (isTiptapJSON(json)) {
    try { return generateHTML(json, contentExtensions) } catch { return "" }
  }
  return ""
}

/**
 * Render prose content (notes, announcements, confirmationMessage, etc.).
 * Handles BlockNote JSON and legacy Tiptap JSON.
 */
export async function renderFormattedTextAsync(json: any): Promise<string> {
  if (!json) return ""
  if (isBlockNoteJSON(json)) return blockNoteToHTML(json)
  // Legacy Tiptap JSON — present until migration script is run
  if (isTiptapJSON(json)) {
    try { return generateHTML(json, formattedExtensions) } catch { return "" }
  }
  return ""
}

/**
 * Extract plain text from stored JSON — for email notifications.
 */
export async function extractTextAsync(json: any): Promise<string> {
  if (!json) return ""
  let html = ""
  if (isBlockNoteJSON(json)) {
    html = await blockNoteToHTML(json)
  } else if (isTiptapJSON(json)) {
    try { html = generateHTML(json, formattedExtensions) } catch { return "" }
  }
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}
