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
  const inner    = Array.isArray(block.content) ? renderInlineContent(block.content) : ""
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
    case "image": {
      const url = block.props?.url
      if (!url) return children || ""
      const alt = block.props?.caption || block.props?.name || ""
      const align = block.props?.textAlignment || "left"
      const width = block.props?.previewWidth ? `width="${block.props.previewWidth}"` : ""
      const alignStyle = align === "center" ? "text-align:center" : align === "right" ? "text-align:right" : ""
      const imgTag = `<img src="${url}" alt="${alt}" ${width} style="max-width:100%;border-radius:4px" />`
      const caption = block.props?.caption ? `<figcaption style="font-size:14px;color:#6b6059;margin-top:4px">${block.props.caption}</figcaption>` : ""
      return `<figure style="${alignStyle};margin:16px 0">${imgTag}${caption}</figure>${children}`
    }
    case "table": {
      const rows = (block.content?.rows || []).map((row: any) => {
        const cells = (row.cells || [])
          .map((cell: any) => `<td>${renderInlineContent(cell.content || [])}</td>`)
          .join("")
        return `<tr>${cells}</tr>`
      }).join("")
      return `<table>${rows}</table>`
    }
    // Custom Dharma blocks
    case "verseQuote": {
      const attr = block.props?.attribution
      return `<div class="lp-verse-quote">${inner}${attr ? `<cite>${attr}</cite>` : ""}</div>${children}`
    }
    case "practiceSuggestion":
      return `<div class="lp-callout">${inner}</div>${children}`
    case "callout":
      return `<div class="lp-callout-block">${inner}</div>${children}`
    case "paragraph":
    default:
      return inner ? `<p>${inner}</p>${children}` : (children || "")
  }
}

function isTiptapJSON(json: any): boolean {
  return (
    json !== null &&
    typeof json === "object" &&
    !Array.isArray(json) &&
    json.type === "doc" &&
    Array.isArray(json.content)
  )
}

/**
 * Render BlockNote JSON → HTML (client-safe, no JSDOM).
 * Also handles legacy rawHtml and Tiptap JSON formats.
 * Tiptap fallback extracts plain text when full rendering isn't available client-side.
 * Server components should use renderFormattedTextAsync for accurate output.
 */
export function renderBlockNoteHtml(json: any): string {
  if (!json) return ""
  if (isRawHtml(json)) return json.html
  if (isBlockNoteJSON(json)) return (json as any[]).map(renderBlockNode).join("")
  // Legacy Tiptap JSON — extract text content as paragraph fallback until migration
  if (isTiptapJSON(json)) {
    return extractTiptapText(json)
  }
  return ""
}

function extractTiptapText(json: any): string {
  if (!json || typeof json !== "object") return ""
  if (typeof json.text === "string") return json.text
  if (Array.isArray(json.content)) {
    const children = json.content.map(extractTiptapText).filter(Boolean).join(" ")
    const tag = json.type
    if (tag === "paragraph" || tag === "doc") return children ? `<p>${children}</p>` : ""
    if (tag === "heading") return `<h${json.attrs?.level ?? 2}>${children}</h${json.attrs?.level ?? 2}>`
    if (tag === "bulletList" || tag === "orderedList") return children
    if (tag === "listItem") return `<li>${children}</li>`
    if (tag === "blockquote") return `<blockquote>${children}</blockquote>`
    if (tag === "hardBreak") return "<br>"
    return children
  }
  return ""
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
