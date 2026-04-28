/**
 * renderRichContentServer.ts
 *
 * Server-side render functions for SERVER COMPONENTS AND API ROUTES ONLY.
 *
 * Uses the client-safe renderBlockNoteHtml() walker from renderRichContent.ts.
 * Does NOT use @blocknote/server-util — that package depends on @blocknote/react
 * which calls React.createContext, and Turbopack's SSR bundling mangles it
 * (TypeError: tj.createContext is not a function).
 *
 * The client-safe walker handles all standard BlockNote blocks plus custom
 * Dharma blocks (verseQuote, practiceSuggestion, callout). It produces
 * correct HTML for all content currently in the database.
 *
 * Never import this file from a client component.
 */

import "server-only"
import {
  isBlockNoteJSON,
  isRawHtml,
  isHtmlString,
  renderBlockNoteHtml,
  extractBlockNoteText,
} from "./renderRichContent"
import { sanitizeTiptapHtml, stripTiptapHtml, type TiptapSanitizeVariant } from "./renderRichContentTiptap"

// ── Legacy Tiptap support ───────────────────────────────────────────────────
// Kept for any records that might not have been migrated yet.
// Uses @tiptap/html which throws at call time in Node ("use @tiptap/html/server
// instead") but @tiptap/html/server is the correct import for Node environments.

function isTiptapJSON(json: any): boolean {
  return (
    json !== null &&
    typeof json === "object" &&
    !Array.isArray(json) &&
    json.type === "doc" &&
    Array.isArray(json.content)
  )
}

let tiptapRenderContent: ((json: any) => string) | null = null
let tiptapRenderFormatted: ((json: any) => string) | null = null

async function ensureTiptapRenderers() {
  if (tiptapRenderContent) return
  try {
    const [
      { generateHTML },
      { default: StarterKit },
      { default: Link },
      { default: Underline },
      { default: TextAlign },
      { default: Image },
      { Table },
      { default: TableRow },
      { default: TableHeader },
      { default: TableCell },
    ] = await Promise.all([
      import("@tiptap/html/server"),
      import("@tiptap/starter-kit"),
      import("@tiptap/extension-link"),
      import("@tiptap/extension-underline"),
      import("@tiptap/extension-text-align"),
      import("@tiptap/extension-image"),
      import("@tiptap/extension-table"),
      import("@tiptap/extension-table-row"),
      import("@tiptap/extension-table-header"),
      import("@tiptap/extension-table-cell"),
    ])

    const contentExts = [
      StarterKit, Link, Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: false }),
      TableRow, TableHeader, TableCell,
    ]
    const formattedExts = [
      StarterKit, Link, Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image,
    ]

    tiptapRenderContent = (json: any) => generateHTML(json, contentExts)
    tiptapRenderFormatted = (json: any) => generateHTML(json, formattedExts)
  } catch (e) {
    console.error("[renderRichContentServer] Tiptap renderer init failed:", e)
    tiptapRenderContent = () => ""
    tiptapRenderFormatted = () => ""
  }
}

// ── ASYNC functions — server components / API routes only ─────────────────────

/**
 * Render full editor content (lessons, manual sections, program descriptions).
 * Handles HTML strings (new Tiptap), BlockNote JSON, legacy rawHtml, legacy Tiptap JSON.
 */
export async function renderContentBodyAsync(
  json: any,
  variant: TiptapSanitizeVariant = "document",
): Promise<string> {
  if (!json) return ""
  if (isHtmlString(json)) return sanitizeTiptapHtml(json, variant)
  if (isRawHtml(json)) return json.html
  if (isBlockNoteJSON(json)) return renderBlockNoteHtml(json)
  if (isTiptapJSON(json)) {
    await ensureTiptapRenderers()
    try { return tiptapRenderContent!(json) } catch { return "" }
  }
  return ""
}

/**
 * Render prose content (notes, announcements, hub content, etc.).
 * Handles HTML strings (new Tiptap), BlockNote JSON, legacy Tiptap JSON.
 */
export async function renderFormattedTextAsync(
  json: any,
  variant: TiptapSanitizeVariant = "message",
): Promise<string> {
  if (!json) return ""
  if (isHtmlString(json)) return sanitizeTiptapHtml(json, variant)
  if (isBlockNoteJSON(json)) return renderBlockNoteHtml(json)
  if (isTiptapJSON(json)) {
    await ensureTiptapRenderers()
    try { return tiptapRenderFormatted!(json) } catch { return "" }
  }
  return ""
}

/**
 * Extract plain text from stored content — for email notifications and excerpts.
 * Handles HTML strings (new Tiptap), BlockNote JSON, legacy Tiptap JSON.
 */
export async function extractTextAsync(json: any): Promise<string> {
  if (!json) return ""
  if (isHtmlString(json)) return stripTiptapHtml(json)
  if (isBlockNoteJSON(json)) return extractBlockNoteText(json)
  if (isTiptapJSON(json)) {
    await ensureTiptapRenderers()
    try {
      const html = tiptapRenderFormatted!(json)
      return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    } catch { return "" }
  }
  return ""
}
