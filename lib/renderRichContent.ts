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

/** Resolve a BlockNote color token to a CSS color value (a named token or a hex code; anything else is dropped). */
const HEX = /^#[0-9a-f]{3,8}$/i
function resolveTextColor(c: string): string { return BN_TEXT_COLORS[c] ?? (HEX.test(c) ? c : "inherit") }
function resolveBgColor(c: string): string { return BN_BG_COLORS[c] ?? (HEX.test(c) ? c : "transparent") }

// ── Escaping (2026-10-28) ────────────────────────────────────────────────────
// Block text is plain text: every value written into the HTML is escaped
// (an entity already written, such as &rsquo;, is kept), links and images
// take only web, mail and phone addresses, and sizes and names are checked.
// Before this, text or a link stored in the block format was written out as
// it was, so a block holding markup ran it on the page (review of the RIM
// Guide's content editing found it; the editors could store it too).
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&(?!#?[a-z0-9]+;)/gi, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
function safeUrl(v: unknown): string {
  const u = String(v ?? "").trim()
  return /^(https?:|mailto:|tel:|\/(?!\/)|#)/i.test(u) ? esc(u) : "#"
}
const word = (v: unknown, fallback: string) => (typeof v === "string" && /^[a-zA-Z]+$/.test(v) ? v : fallback)
const whole = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null
}

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

/** True when the value is a plain HTML string (new Tiptap storage format). */
export function isHtmlString(value: any): value is string {
  return typeof value === "string" && value.length > 0
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
      return `<a href="${safeUrl(c.href)}">${renderInlineContent(c.content || [])}</a>`
    }
    let t: string = esc(c.text ?? "")
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
  const align = word(block.props?.textAlignment, "left")
  if (align !== "left") styles.push(`text-align:${align}`)
  if (block.props?.textColor) styles.push(`color:${resolveTextColor(block.props.textColor)}`)
  if (block.props?.backgroundColor) styles.push(`background-color:${resolveBgColor(block.props.backgroundColor)}`)
  return styles.length > 0 ? ` style="${styles.join(";")}"` : ""
}

const CONTAINER_TYPES = new Set(["callout", "practiceSuggestion", "reflection"])

function renderSingleBlock(block: any): string {
  if (!block || typeof block !== "object") return ""
  const inner    = Array.isArray(block.content) ? renderInlineContent(block.content) : ""
  // For container blocks that manage children themselves, group children
  // through renderBlockNodes so lists get proper <ul>/<ol> wrappers.
  const childBlocks = Array.isArray(block.children) ? block.children : []
  const children =
    CONTAINER_TYPES.has(block.type)
      ? renderBlockNodes(childBlocks)
      : childBlocks.map(renderSingleBlock).join("")
  const bStyle   = blockStyleAttr(block)

  switch (block.type) {
    case "heading": {
      const level = whole(block.props?.level, 1, 6) ?? 2
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
      const alt = esc(block.props?.caption || block.props?.name || "")
      const align = word(block.props?.textAlignment, "left")
      const w = whole(block.props?.previewWidth, 1, 4000)
      const width = w ? `width="${w}"` : ""
      const alignStyle = align === "center" ? "text-align:center" : align === "right" ? "text-align:right" : ""
      const imgTag = `<img src="${safeUrl(url)}" alt="${alt}" ${width} style="max-width:100%;border-radius:4px" />`
      const caption = block.props?.caption ? `<figcaption style="font-size:14px;color:#777;margin-top:4px">${esc(block.props.caption)}</figcaption>` : ""
      return `<figure style="${alignStyle};margin:16px 0">${imgTag}${caption}</figure>${children}`
    }
    case "file": {
      const url = block.props?.url
      if (!url) return children || ""
      const name = esc(block.props?.name || "Download")
      const caption = block.props?.caption ? `<div class="rim-file__caption">${esc(block.props.caption)}</div>` : ""
      return `<div class="rim-file"><a class="rim-file__link" href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer"><span class="rim-file__icon" aria-hidden="true">📎</span><span class="rim-file__name">${name}</span></a>${caption}</div>${children}`
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
          const colspan = whole(cell.props?.colspan, 1, 100)
          const rowspan = whole(cell.props?.rowspan, 1, 100)
          if (colspan && colspan > 1) attrs.push(`colspan="${colspan}"`)
          if (rowspan && rowspan > 1) attrs.push(`rowspan="${rowspan}"`)
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
    // Custom editorial blocks
    case "pullQuote": {
      const attr = block.props?.attribution
      const body = inner
      const attrHtml = attr ? `<cite class="rim-el-pull-quote__attribution">${esc(attr)}</cite>` : ""
      return `<div class="rim-el-pull-quote"><span class="rim-el-pull-quote__mark" aria-hidden="true">&ldquo;</span><div class="rim-el-pull-quote__text">${body}</div>${attrHtml}</div>`
    }
    case "verseQuote": {
      const attr = block.props?.attribution
      const attrHtml = attr ? `<cite class="rim-el-verse__attribution">${esc(attr)}</cite>` : ""
      return `<div class="rim-el-verse lp-verse-quote"><div class="rim-el-verse__text">${inner}</div>${attrHtml}</div>${children}`
    }
    case "practiceSuggestion": {
      const title = block.props?.title ?? ""
      const titleHtml = title ? `<span class="rim-el-practice__title">${esc(title)}</span>` : ""
      // Body = container children. Legacy inline content falls back.
      const body = children || (inner ? `<p>${inner}</p>` : "")
      return `<div class="rim-el-practice"><div class="rim-el-practice__header"><span class="rim-el-practice__eyebrow">Practice</span>${titleHtml}</div><div class="rim-el-practice__body">${body}</div></div>`
    }
    case "reflection": {
      const question = block.props?.question ?? ""
      const qHtml = question ? `<div class="rim-el-reflection__question">${esc(question)}</div>` : ""
      const body = children || (inner ? `<p>${inner}</p>` : "")
      return `<div class="rim-el-reflection">${qHtml}<div class="rim-el-reflection__body">${body}</div></div>`
    }
    case "callout": {
      const variant = word(block.props?.variant, "note")
      const title   = block.props?.title ?? ""
      const body    = children || inner

      // Aside — universal shaded container. No icon, no baked-in title.
      // Author puts a heading block inside for the title. Color treatment
      // is determined by the rendered scope class on the wrapper
      // (.rim-content--document, .rim-content--lesson, .rim-content--program)
      // — not by a per-block prop. Mirrors toExternalHTML.
      if (variant === "aside") {
        return `<div class="rim-el-note rim-el-note--aside">${body}</div>`
      }

      const iconMap: Record<string, string> = {
        note: "💡", decision: "✓", practice: "🌱", reflection: "❦",
        question: "?", warning: "⚠", info: "ℹ",
      }
      const icon = iconMap[variant] ?? "💡"
      const titleHtml = title ? `<span class="lp-callout-block__title">${esc(title)}</span>` : ""
      const header = `<div class="lp-callout-block__header"><span class="lp-callout-block__icon" aria-hidden="true">${icon}</span>${titleHtml}</div>`
      return `<div class="lp-callout-block lp-callout-block--${variant} rim-el-note rim-el-note--${variant}">${header}<div class="lp-callout-block__body">${body}</div></div>`
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
  if (isHtmlString(json)) return json          // new Tiptap HTML string — pass through
  if (isRawHtml(json)) return json.html
  if (isBlockNoteJSON(json)) return renderBlockNodes(json as any[])
  if (isTiptapJSON(json)) return extractTiptapText(json)
  return ""
}

function extractTiptapText(json: any): string {
  if (!json || typeof json !== "object") return ""
  if (typeof json.text === "string") return esc(json.text)
  if (Array.isArray(json.content)) {
    const children = json.content.map(extractTiptapText).filter(Boolean).join(" ")
    const tag = json.type
    if (tag === "paragraph" || tag === "doc") return children ? `<p>${children}</p>` : ""
    if (tag === "heading") { const l = whole(json.attrs?.level, 1, 6) ?? 2; return `<h${l}>${children}</h${l}>` }
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
