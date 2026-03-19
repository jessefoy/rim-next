/**
 * renderRichContent.ts — client-safe rich content utilities.
 *
 * All rich-text fields are now BlockNote JSON (array of block objects).
 * These functions are safe for client components — no JSDOM, no server-only modules.
 *
 * For server components that need accurate HTML (including nested content,
 * custom blocks, etc.), use renderRichContentServer.ts instead.
 */

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

// ── Client-safe BlockNote renderer ───────────────────────────────────────────
//
// Converts BlockNote JSON → HTML without requiring JSDOM.
// Handles common block types and inline formatting.
// Server components should use renderContentBodyAsync / renderFormattedTextAsync
// for accurate output (including custom blocks, tables, etc.).

function renderInlineContent(content: any[]): string {
  return (content || []).map((c: any) => {
    if (!c) return ""
    if (c.type === "link") {
      const href = c.href ?? "#"
      return `<a href="${href}">${renderInlineContent(c.content || [])}</a>`
    }
    let t: string = c.text ?? ""
    if (!t) return ""
    if (c.styles?.bold)      t = `<strong>${t}</strong>`
    if (c.styles?.italic)    t = `<em>${t}</em>`
    if (c.styles?.underline) t = `<u>${t}</u>`
    if (c.styles?.code)      t = `<code>${t}</code>`
    return t
  }).join("")
}

function renderBlockNode(block: any): string {
  if (!block || typeof block !== "object") return ""
  const inner    = renderInlineContent(block.content || [])
  const children = (block.children || []).map(renderBlockNode).join("")

  switch (block.type) {
    case "heading": {
      const level = block.props?.level ?? 2
      return `<h${level}>${inner}</h${level}>${children}`
    }
    case "bulletListItem":
      return `<li>${inner}</li>${children}`
    case "numberedListItem":
      return `<li>${inner}</li>${children}`
    case "checkListItem":
      return `<li>${inner}</li>${children}`
    case "quote":
      return `<blockquote>${inner}</blockquote>${children}`
    case "codeBlock":
      return `<pre><code>${inner}</code></pre>${children}`
    case "table": {
      const rows = (block.content?.rows || []).map((row: any) => {
        const cells = (row.cells || [])
          .map((cell: any) => `<td>${renderInlineContent(cell.content || [])}</td>`)
          .join("")
        return `<tr>${cells}</tr>`
      }).join("")
      return `<table>${rows}</table>`
    }
    case "paragraph":
    default:
      return inner ? `<p>${inner}</p>${children}` : (children || "")
  }
}

/**
 * Render BlockNote JSON → HTML (client-safe, no JSDOM).
 * Also handles legacy rawHtml format.
 * Returns empty string for null/non-BlockNote values.
 */
export function renderBlockNoteHtml(json: any): string {
  if (!json) return ""
  if (isRawHtml(json)) return json.html
  if (!isBlockNoteJSON(json)) return ""
  return (json as any[]).map(renderBlockNode).join("")
}

/**
 * Extract plain text from BlockNote JSON (client-safe, no JSDOM).
 * Useful for excerpts, search indexing, and length checks.
 */
export function extractBlockNoteText(json: any): string {
  if (!json) return ""
  if (!isBlockNoteJSON(json)) return ""

  function textFromInline(content: any[]): string {
    return (content || []).map((c: any) => {
      if (!c) return ""
      if (c.type === "link") return textFromInline(c.content || [])
      return c.text ?? ""
    }).join("")
  }

  function textFromBlock(block: any): string {
    const text     = textFromInline(block.content || [])
    const children = (block.children || []).map(textFromBlock).join(" ")
    return [text, children].filter(Boolean).join(" ")
  }

  return (json as any[]).map(textFromBlock).filter(Boolean).join("\n")
}
