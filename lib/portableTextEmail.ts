/**
 * Portable Text → markdown conversion utility.
 *
 * Used by sendReminderEmail() for the legacy Portable Text code path
 * (programs that had reminderMessage set before the Tiptap migration).
 * New program data uses Tiptap JSON rendered via renderFormattedText().
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PortableTextBlock = any;

/**
 * Convert a Portable Text array to a markdown string for use as a variable
 * in managed email templates. Formatting (bold, italic, links, lists) is
 * preserved as markdown syntax so that the template engine (marked) renders
 * it correctly when the template body is processed.
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
