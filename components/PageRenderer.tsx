import type { PageContent } from "@/lib/pageBuilder/types";
import { blockStyleClasses } from "@/lib/pageBuilder/style";
import { BLOCK_COMPONENTS } from "@/components/page-blocks";
import { sanitizePageContent } from "@/lib/pageBuilder/sanitizeContent";

export function PageRenderer({ content }: { content: PageContent }) {
  const safe = sanitizePageContent(content);
  return (
    <>
      {safe.sections.map((section) => {
        const Block = BLOCK_COMPONENTS[section.type];
        if (!Block) return null;
        const { section: sectionCls, inner: innerCls } = blockStyleClasses(section.style);
        return (
          <section key={section.id} className={`blk ${sectionCls}`.trim()}>
            <div className={`blk__inner ${innerCls}`.trim()}>
              <Block section={section} />
            </div>
          </section>
        );
      })}
    </>
  );
}
