/**
 * renderRichContent.ts — client-safe rich content utilities.
 *
 * All rich-text fields are now BlockNote JSON (array of block objects).
 * These functions are safe for client components — no JSDOM, no server-only modules.
 *
 * For server components that need accurate HTML (including nested content,
 * custom blocks, etc.), use renderRichContentServer.ts instead.
 */

// ── BlockNote color palette ──────────────────────────────────────────────────
// BlockNote stores colors as named tokens ("red", "blue", etc.) not CSS values.
// These maps match @blocknote/core/src/editor/defaultColors.ts (light mode).

const BN_TEXT_COLORS: Record<string, string> = {
  gray: "#9b9a97", brown: "#64473a", red: "#e03e3e", orange: "#d9730d",
  yellow: "#dfab01", green: "#4d6461", blue: "#0b6e99", purple: "#6940a5", pink: "#ad1a72",
}

const BN_BG_COLORS: Record<string, string> = {
  gray: "#ebeced", brown: "#e9e5e3", red: "#fbe4e4", orange: "#f6e9d9",
  yellow: "#fbf3db", green: "#ddedea", blue: "#ddebf1", purple: "#eae4f2", pink: "#f4dfeb",
}

/** Resolve a BlockNote color token to a CSS color value. */
function resolveTextColor(c: string): string { return BN_TEXT_COLORS[c] ?? c }
function resolveBgColor(c: string): string { return BN_BG_COLORS[c] ?? c }

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
    if (c.styles?.bold)          t = `<strong>${t}</strong>`
    if (c.styles?.italic)        t = `<em>${t}</em>`
    if (c.styles?.underline)     t = `<u>${t}</u>`
    if (c.styles?.strike)        t = `<s>${t}</s>`
    if (c.styles?.code)          t = `<code>${t}</code>`
    // Inline text color / background color
    const inlineStyles: string[] = []
    if (c.styles?.textColor)       inlineStyles.push(`color:${resolveTextColor(c.styles.textColor)}`)
    if (c.styles?.backgroundColor) inlineStyles.push(`background-color:${resolveBgColor(c.styles.backgroundColor)}`)
    if (inlineStyles.length > 0)   t = `<span style="${inlineStyles.join(";")}">${t}</span>`
    return t
  }).join("")
}

function blockStyleAttr(block: any): string {
  const styles: string[] = []
  const align = block.props?.textAlignment
  if (align && align !== "left") styles.push(`text-align:${align}`)
  if (block.props?.textColor) styles.push(`color:${resolveTextColor(block.props.textColor)}`)
  if (block.props?.backgroundColor) styles.push(`background-color:${resolveBgColor(block.props.backgroundColor)}`)
  return styles.length > 0 ? ` style="${styles.join(";")}"` : ""
}

function renderSingleBlock(block: any): string {
  if (!block || typeof block !== "object") return ""
  const inner    = Array.isArray(block.content) ? renderInlineContent(block.content) : ""
  // For container blocks that manage children themselves (callout), group
  // children through renderBlockNodes so lists get proper <ul>/<ol> wrappers.
  const childBlocks = Array.isArray(block.children) ? block.children : []
  const children =
    block.type === "callout"
      ? renderBlockNodes(childBlocks)
      : childBlocks.map(renderSingleBlock).join("")
  const bStyle   = blockStyleAttr(block)

  switch (block.type) {
    case "heading": {
      const level = block.props?.level ?? 2
      return `<h${level}${bStyle}>${inner}</h${level}>${children}`
    }
    case "bulletListItem":
      return `<li${bStyle}>${inner}${children}</li>`
    case "numberedListItem":
      return `<li${bStyle}>${inner}${children}</li>`
    case "checkListItem": {
      const checked = (block.props as any)?.checked === true
      const checkbox = `<span class="check-list__box${checked ? " check-list__box--checked" : ""}"></span>`
      return `<li class="check-list__item${checked ? " check-list__item--checked" : ""}"${bStyle}>${checkbox}${inner}${children}</li>`
    }
    case "quote":
      return `<blockquote${bStyle}>${inner}</blockquote>${children}`
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
      const caption = block.props?.caption ? `<figcaption style="font-size:14px;color:#777;margin-top:4px">${block.props.caption}</figcaption>` : ""
      return `<figure style="${alignStyle};margin:16px 0">${imgTag}${caption}</figure>${children}`
    }
    case "file": {
      const url = block.props?.url
      if (!url) return children || ""
      const name = block.props?.name || "Download"
      const caption = block.props?.caption ? `<div class="rim-file__caption">${block.props.caption}</div>` : ""
      return `<div class="rim-file"><a class="rim-file__link" href="${url}" target="_blank" rel="noopener noreferrer"><span class="rim-file__icon" aria-hidden="true">📎</span><span class="rim-file__name">${name}</span></a>${caption}</div>${children}`
    }
    case "table": {
      const rows = block.content?.rows || []
      const headerRows = block.content?.headerRows ?? 0
      let html = ""
      rows.forEach((row: any, i: number) => {
        const isHeader = i < headerRows
        const tag = isHeader ? "th" : "td"
        const cells = (row.cells || []).map((cell: any) => {
          const cellContent = Array.isArray(cell.content)
            ? renderInlineContent(cell.content)
            : (cell.content ? renderInlineContent(cell.content) : "")
          const attrs: string[] = []
          if (cell.props?.colspan && cell.props.colspan > 1) attrs.push(`colspan="${cell.props.colspan}"`)
          if (cell.props?.rowspan && cell.props.rowspan > 1) attrs.push(`rowspan="${cell.props.rowspan}"`)
          // Cell-level background and text colors from advanced tables
          const cellStyles: string[] = []
          if (cell.props?.backgroundColor) cellStyles.push(`background-color:${resolveBgColor(cell.props.backgroundColor)}`)
          if (cell.props?.textColor)       cellStyles.push(`color:${resolveTextColor(cell.props.textColor)}`)
          if (cellStyles.length > 0) attrs.push(`style="${cellStyles.join(";")}"`)
          return `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}>${cellContent}</${tag}>`
        }).join("")
        html += `<tr>${cells}</tr>`
      })
      if (headerRows > 0) {
        const headRows = html.split("</tr>").slice(0, headerRows).join("</tr>") + "</tr>"
        const bodyRows = html.split("</tr>").slice(headerRows).filter(Boolean).join("</tr>")
        return `<table><thead>${headRows}</thead><tbody>${bodyRows}</tbody></table>${children}`
      }
      return `<table><tbody>${html}</tbody></table>${children}`
    }
    // Custom Dharma blocks
    case "verseQuote": {
      const attr = block.props?.attribution
      return `<div class="lp-verse-quote">${inner}${attr ? `<cite>${attr}</cite>` : ""}</div>${children}`
    }
    case "practiceSuggestion":
      return `<div class="lp-callout">${inner}</div>${children}`
    case "callout": {
      const variant = block.props?.variant ?? "note"
      const title   = block.props?.title ?? ""
      const iconMap: Record<string, string> = {
        note: "💡", decision: "✓", practice: "🌱", reflection: "❦",
        question: "?", warning: "⚠", info: "ℹ",
      }
      const icon = iconMap[variant] ?? "💡"
      const titleHtml = title ? `<span class="lp-callout-block__title">${title}</span>` : ""
      const header = `<div class="lp-callout-block__header"><span class="lp-callout-block__icon" aria-hidden="true">${icon}</span>${titleHtml}</div>`
      // Body = children (block-level). Legacy inline content falls back into
      // the body if any is still stored that way.
      const body = children || inner
      return `<div class="lp-callout-block lp-callout-block--${variant}">${header}<div class="lp-callout-block__body">${body}</div></div>`
    }
    case "paragraph":
    default:
      return inner ? `<p${bStyle}>${inner}</p>${children}` : (children || "")
  }
}

/**
 * Render an array of BlockNote blocks to HTML, grouping consecutive
 * list items into proper <ul>/<ol> wrappers.
 */
function renderBlockNodes(blocks: any[]): string {
  let html = ""
  let i = 0
  while (i < blocks.length) {
    const block = blocks[i]
    if (block.type === "bulletListItem") {
      let items = ""
      while (i < blocks.length && blocks[i].type === "bulletListItem") {
        items += renderSingleBlock(blocks[i])
        i++
      }
      html += `<ul>${items}</ul>`
    } else if (block.type === "numberedListItem") {
      let items = ""
      while (i < blocks.length && blocks[i].type === "numberedListItem") {
        items += renderSingleBlock(blocks[i])
        i++
      }
      html += `<ol>${items}</ol>`
    } else if (block.type === "checkListItem") {
      let items = ""
      while (i < blocks.length && blocks[i].type === "checkListItem") {
        items += renderSingleBlock(blocks[i])
        i++
      }
      html += `<ul class="check-list">${items}</ul>`
    } else {
      html += renderSingleBlock(block)
      i++
    }
  }
  return html
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
  if (isBlockNoteJSON(json)) return renderBlockNodes(json as any[])
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
