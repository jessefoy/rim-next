import type { ReactNode } from "react";
import type { PageContent, PageSection } from "@/lib/pageBuilder/types";
import { blockStyleClasses } from "@/lib/pageBuilder/style";
import { HeroBlock } from "@/components/page-blocks/Hero";
import { RichTextBlock } from "@/components/page-blocks/RichText";
import { CardGridBlock } from "@/components/page-blocks/CardGrid";
import { CtaBlock } from "@/components/page-blocks/Cta";

const REGISTRY: Record<string, (props: { section: PageSection }) => ReactNode> = {
  hero: HeroBlock,
  richText: RichTextBlock,
  cardGrid: CardGridBlock,
  cta: CtaBlock,
};

export function PageRenderer({ content }: { content: PageContent }) {
  return (
    <>
      {content.sections.map((section) => {
        const Block = REGISTRY[section.type];
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
