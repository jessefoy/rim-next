/**
 * renderRichContentServer.ts
 *
 * Async render functions for SERVER COMPONENTS AND API ROUTES ONLY.
 * All rich-text fields are now BlockNote JSON — Tiptap fallback removed.
 *
 * @blocknote/server-util is dynamically imported to prevent Turbopack from
 * evaluating the JSDOM-heavy module at build time.
 *
 * Never import this file from a client component.
 */

import "server-only"
import { isBlockNoteJSON, isRawHtml } from "./renderRichContent"

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
 * Handles BlockNote JSON and legacy rawHtml format.
 */
export async function renderContentBodyAsync(json: any): Promise<string> {
  if (!json) return ""
  if (isRawHtml(json)) return json.html
  if (isBlockNoteJSON(json)) return blockNoteToHTML(json)
  return ""
}

/**
 * Render prose content (notes, announcements, confirmationMessage, etc.).
 * Handles BlockNote JSON.
 */
export async function renderFormattedTextAsync(json: any): Promise<string> {
  if (!json) return ""
  if (isBlockNoteJSON(json)) return blockNoteToHTML(json)
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
  }
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}
