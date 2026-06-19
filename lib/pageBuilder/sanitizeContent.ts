// lib/pageBuilder/sanitizeContent.ts
// SERVER ONLY. Sanitizes the rich-text HTML in a page's content before it is
// rendered, matching the app-wide render-time sanitization convention (lessons,
// hub documents). Block content is authored by ADMINs, but we never trust
// stored HTML at the render boundary.
import { sanitizeTiptapHtml } from "@/lib/renderRichContentTiptap";
import type { PageContent } from "@/lib/pageBuilder/types";

export function sanitizePageContent(content: PageContent): PageContent {
  return {
    ...content,
    sections: content.sections.map((s) => {
      const html = s.props.html;
      if (s.type === "richText" && typeof html === "string") {
        return { ...s, props: { ...s.props, html: sanitizeTiptapHtml(html, "document") } };
      }
      return s;
    }),
  };
}
