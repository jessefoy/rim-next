import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * Google Doc export-HTML → calm RIM reading HTML.
 *
 * Google's HTML export carries its formatting in a <style> block of generated
 * classes (.c0, .c1, …) plus a page-layout wrapper — none of which belongs in
 * RIM's reader. Rendering strategy (RIM_GoogleWorkspace.md, the read path):
 * keep the document's SEMANTICS (headings, paragraphs, lists, tables, links,
 * images) and its inline EMPHASIS (bold/italic/underline/strikethrough,
 * recovered from the class rules and re-applied as inline styles), and let
 * `.rim-content` supply the typography. Everything else — fonts, sizes,
 * colors, page geometry — is deliberately dropped so every document reads in
 * RIM's own voice.
 *
 * Sanitization is not optional: the HTML comes from an external system and
 * team-authored content, and it renders inside the app.
 */

/** The emphasis properties worth carrying from Google's class rules. */
function emphasisFromRule(cssProps: string): string[] {
  const kept: string[] = [];
  if (/font-weight\s*:\s*(700|800|900|bold)/i.test(cssProps)) kept.push("font-weight:700");
  if (/font-style\s*:\s*italic/i.test(cssProps)) kept.push("font-style:italic");
  if (/text-decoration\s*:\s*[^;}]*underline/i.test(cssProps)) kept.push("text-decoration:underline");
  if (/text-decoration\s*:\s*[^;}]*line-through/i.test(cssProps)) kept.push("text-decoration:line-through");
  return kept;
}

export function googleDocHtmlToRimHtml(exportHtml: string): string {
  // 1. Build class → emphasis map from the export's <style> block(s).
  const classEmphasis = new Map<string, string>();
  const styleBlocks = exportHtml.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? [];
  for (const block of styleBlocks) {
    const ruleRe = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(block))) {
      const kept = emphasisFromRule(m[2]);
      if (kept.length) classEmphasis.set(m[1], kept.join(";"));
    }
  }

  // 2. Take the body content (fall back to the whole string if no <body>).
  const body = exportHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? exportHtml;

  // 3. Sanitize down to semantic tags; re-apply recovered emphasis as the
  //    ONLY style attribute (original inline styles are discarded).
  return sanitizeHtml(body, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr", "blockquote", "div",
      "ul", "ol", "li",
      "table", "thead", "tbody", "tr", "td", "th",
      "a", "img", "span",
      "b", "strong", "i", "em", "u", "s", "sub", "sup",
    ],
    allowedAttributes: {
      a: ["href"],
      img: ["src", "alt"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
      "*": ["style"],
    },
    // Only the emphasis styles we computed survive the style allowlist.
    allowedStyles: {
      "*": {
        "font-weight": [/^700$/],
        "font-style": [/^italic$/],
        "text-decoration": [/^underline$/, /^line-through$/],
      },
    },
    allowedSchemes: ["https", "http", "mailto"],
    transformTags: {
      "*": (tagName, attribs) => {
        const next: Record<string, string> = {};
        if (attribs.href) next.href = attribs.href;
        if (attribs.src) next.src = attribs.src;
        if (attribs.alt) next.alt = attribs.alt;
        if (attribs.colspan) next.colspan = attribs.colspan;
        if (attribs.rowspan) next.rowspan = attribs.rowspan;
        const classes = (attribs.class ?? "").split(/\s+/).filter(Boolean);
        const emphasis = classes
          .map((c) => classEmphasis.get(c))
          .filter(Boolean)
          .join(";");
        if (emphasis) next.style = emphasis;
        return { tagName, attribs: next };
      },
    },
  }).trim();
}
