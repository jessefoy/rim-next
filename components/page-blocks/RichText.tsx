import type { PageSection } from "@/lib/pageBuilder/types";

interface RichTextProps {
  html?: string;
}

// Prototype: fixture HTML is trusted. DB-stored content will route through the
// existing sanitizer (lib/renderRichContentTiptap.ts) when the composer lands.
export function RichTextBlock({ section }: { section: PageSection }) {
  const p = section.props as RichTextProps;
  return (
    <div
      className="blk-richtext rim-content rim-content--page"
      dangerouslySetInnerHTML={{ __html: p.html ?? "" }}
    />
  );
}
