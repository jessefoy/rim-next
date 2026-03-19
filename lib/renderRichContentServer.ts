/**
 * renderRichContentServer.ts
 *
 * Async render functions for SERVER COMPONENTS ONLY.
 * Handles both Tiptap JSON (legacy) and BlockNote JSON (new).
 *
 * @blocknote/server-util is dynamically imported only when BlockNote JSON is
 * detected — this prevents Turbopack from evaluating the JSDOM-heavy module
 * at build time and keeps the server bundle clean.
 *
 * Never import this file from a client component or from lib/renderRichContent.ts.
 *
 * Format detection:
 *   BlockNote JSON — array with block objects: [{ id, type, props, content, children }]
 *   Tiptap JSON   — object with type key: { type: "doc", content: [...] }
 *   rawHtml       — legacy: { type: "rawHtml", html: "..." }
 */

import "server-only"
import { isBlockNoteJSON, isRawHtml, renderContentBody, renderFormattedText } from "./renderRichContent"

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

// ── ASYNC functions — server components only ──────────────────────────────────

/**
 * Render full editor content (lessons, manual sections).
 * Handles BlockNote JSON, Tiptap JSON, and rawHtml legacy format.
 */
export async function renderContentBodyAsync(json: any): Promise<string> {
  if (!json) return ""
  if (isRawHtml(json)) return json.html
  if (isBlockNoteJSON(json)) return blockNoteToHTML(json)
  // Tiptap JSON — delegate to sync function
  return renderContentBody(json)
}

/**
 * Render prose content (notes, announcements, conversation threads).
 * Handles BlockNote JSON and Tiptap JSON.
 */
export async function renderFormattedTextAsync(json: any): Promise<string> {
  if (!json) return ""
  if (isBlockNoteJSON(json)) return blockNoteToHTML(json)
  return renderFormattedText(json)
}

/**
 * Extract plain text from stored JSON — for email notifications.
 * Handles BlockNote JSON and Tiptap JSON.
 */
export async function extractTextAsync(json: any): Promise<string> {
  if (!json) return ""
  let html = ""
  if (isBlockNoteJSON(json)) {
    html = await blockNoteToHTML(json)
  } else {
    html = renderFormattedText(json)
  }
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}
