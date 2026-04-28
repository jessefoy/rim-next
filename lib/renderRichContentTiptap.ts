/**
 * renderRichContentTiptap.ts — server-side HTML pass-through with sanitization.
 *
 * The new RimTiptapEditor stores plain HTML strings. This renderer sanitizes
 * them with a strict allowlist before display. The sanitizer doesn't need to
 * understand block types — it just passes known-safe elements and strips
 * everything else (attribute payloads from paste events, unknown tags, etc.).
 *
 * SERVER ONLY — never import from a client component.
 *
 * Two allowlists:
 *   message  — p, br, inline marks, links, lists, blockquote, code/pre.
 *              Used for Hub welcome/home, conversation threads + replies.
 *   document — message + headings (h2–h4), table family, img/figure,
 *              and the Dharma block divs with their CSS classes.
 *              Used for hub documents, manual sections, lesson bodies.
 *
 * The allowlist for each variant exactly mirrors what RimTiptapEditor
 * produces. When a new block is added to the editor, extend the list here.
 */

import sanitizeHtml from "sanitize-html"

// Shared inline marks used in both variants
const INLINE_TAGS = ["p", "br", "strong", "em", "u", "s", "a", "code", "pre",
  "ul", "ol", "li", "blockquote", "span", "mark"]

// Dharma block + callout class patterns allowed in document variant
const DOCUMENT_CLASSES = [
  /^rim-el-/,          // all custom block classes (rim-el-pull-quote, rim-el-verse, etc.)
  /^lp-callout-block/, // callout header/body/icon classes
  /^check-list/,       // task list items
]

const SHARED_ATTRS: sanitizeHtml.IOptions["allowedAttributes"] = {
  a:    ["href", "target", "rel"],
  span: ["style"],   // Tiptap color / highlight produces inline style on span
  mark: ["style"],
  "*":  ["class"],
}

const MESSAGE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: INLINE_TAGS,
  allowedAttributes: SHARED_ATTRS,
  allowedSchemes: ["https", "http", "mailto"],
}

const DOCUMENT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...INLINE_TAGS,
    "h2", "h3", "h4",
    "table", "thead", "tbody", "tr", "th", "td",
    "img", "figure", "figcaption",
    "div", "cite",
  ],
  allowedAttributes: {
    ...SHARED_ATTRS,
    img:  ["src", "alt", "style"],
    th:   ["colspan", "rowspan", "style"],
    td:   ["colspan", "rowspan", "style"],
    div:  ["class"],
    cite: ["class"],
  },
  allowedSchemes: ["https", "http", "mailto"],
  allowedClasses: {
    div:  DOCUMENT_CLASSES,
    cite: DOCUMENT_CLASSES,
    li:   [/^check-list/],
    ul:   [/^check-list/],
  },
}

export type TiptapSanitizeVariant = "message" | "document"

export function sanitizeTiptapHtml(
  html: string,
  variant: TiptapSanitizeVariant = "message",
): string {
  if (!html) return ""
  const opts = variant === "document" ? DOCUMENT_OPTIONS : MESSAGE_OPTIONS
  return sanitizeHtml(html, opts)
}

/** Strip all tags — for plain-text excerpts and email message bodies. */
export function stripTiptapHtml(html: string): string {
  if (!html) return ""
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim()
}
