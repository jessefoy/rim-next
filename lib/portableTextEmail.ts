/**
 * Converts Sanity Portable Text to email-safe HTML and plain text.
 *
 * Email clients strip <style> tags, so every element uses inline styles.
 * Supports: normal paragraphs, bullet lists, bold, italic, links.
 * Headings and custom block types are intentionally excluded — they don't
 * render reliably across email clients and aren't needed for confirmation copy.
 */

import { toHTML } from "@portabletext/to-html";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PortableTextBlock = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HC = { children?: string; value?: any };

const P_STYLE =
  "margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;" +
  "font-size:16px;line-height:1.75;color:#333333;";

const LI_STYLE =
  "margin-bottom:6px;font-family:Georgia,'Times New Roman',serif;" +
  "font-size:16px;line-height:1.75;color:#333333;";

/** Convert a Portable Text array to email-safe HTML with inline styles. */
export function portableTextToEmailHtml(blocks: PortableTextBlock[]): string {
  if (!blocks?.length) return "";

  return toHTML(blocks, {
    components: {
      block: {
        normal: ({ children }: HC) =>
          `<p style="${P_STYLE}">${children ?? ""}</p>`,
        // Treat any other style (h1–h6 etc.) as a normal paragraph
        // so nothing unexpected slips through from copy-paste in Sanity.
        h1: ({ children }: HC) =>
          `<p style="${P_STYLE}"><strong>${children ?? ""}</strong></p>`,
        h2: ({ children }: HC) =>
          `<p style="${P_STYLE}"><strong>${children ?? ""}</strong></p>`,
        h3: ({ children }: HC) =>
          `<p style="${P_STYLE}"><strong>${children ?? ""}</strong></p>`,
        h4: ({ children }: HC) =>
          `<p style="${P_STYLE}"><strong>${children ?? ""}</strong></p>`,
      },
      list: {
        bullet: ({ children }: HC) =>
          `<ul style="margin:0 0 16px;padding-left:24px;">${children ?? ""}</ul>`,
        number: ({ children }: HC) =>
          `<ol style="margin:0 0 16px;padding-left:24px;">${children ?? ""}</ol>`,
      },
      listItem: {
        bullet: ({ children }: HC) =>
          `<li style="${LI_STYLE}">${children ?? ""}</li>`,
        number: ({ children }: HC) =>
          `<li style="${LI_STYLE}">${children ?? ""}</li>`,
      },
      marks: {
        strong: ({ children }: HC) =>
          `<strong style="font-weight:600;">${children ?? ""}</strong>`,
        em: ({ children }: HC) =>
          `<em>${children ?? ""}</em>`,
        link: ({ children, value }: HC) =>
          `<a href="${value?.href ?? "#"}" style="color:#39607a;">${children ?? ""}</a>`,
      },
    },
  });
}

/**
 * Convert a Portable Text array to a markdown string for use as a variable
 * in managed email templates. Formatting (bold, italic, links, lists) is
 * preserved as markdown syntax so that the template engine (marked) renders
 * it correctly when the template body is processed.
 *
 * Use this — not portableTextToEmailText — when the value will be interpolated
 * into a template body that is later converted to HTML via marked.
 */
export function portableTextToMarkdown(blocks: PortableTextBlock[]): string {
  if (!blocks?.length) return "";

  const parts: string[] = [];

  for (const block of blocks) {
    if (block._type !== "block") continue;

    const markDefs: Array<{ _key: string; _type: string; href?: string }> =
      block.markDefs ?? [];

    const text = (block.children ?? [])
      .map((span: { _type?: string; text?: string; marks?: string[] }) => {
        let t = span.text ?? "";
        const marks: string[] = span.marks ?? [];
        for (const mark of marks) {
          if (mark === "strong")   { t = `**${t}**`; continue; }
          if (mark === "em")       { t = `*${t}*`;   continue; }
          const def = markDefs.find((d) => d._key === mark);
          if (def?._type === "link" && def.href) t = `[${t}](${def.href})`;
        }
        return t;
      })
      .join("");

    if (!text.trim()) { parts.push(""); continue; }

    if (block.listItem === "bullet")      parts.push(`- ${text}`);
    else if (block.listItem === "number") parts.push(`1. ${text}`);
    else                                   parts.push(text);
  }

  return parts.join("\n\n").trim();
}

/** Convert a Portable Text array to a plain-text string for email fallback. */
export function portableTextToEmailText(blocks: PortableTextBlock[]): string {
  if (!blocks?.length) return "";

  const lines: string[] = [];

  for (const block of blocks) {
    if (block._type !== "block") continue;

    const text = (block.children ?? [])
      .map((span: { text?: string }) => span.text ?? "")
      .join("");

    if (!text.trim()) {
      lines.push("");
      continue;
    }

    lines.push(block.listItem === "bullet" ? `• ${text}` : text);
  }

  return lines.join("\n");
}
