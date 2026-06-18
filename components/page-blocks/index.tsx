import type { ReactNode } from "react";
import type { PageSection } from "@/lib/pageBuilder/types";
import { HeroBlock } from "./Hero";
import { RichTextBlock } from "./RichText";
import { CardGridBlock } from "./CardGrid";
import { CtaBlock } from "./Cta";

// Single source of truth for block type → render component, shared by the
// server renderer (PageRenderer) and the client composer canvas (PageComposer)
// so a new block is registered in exactly one place.
export const BLOCK_COMPONENTS: Record<string, (p: { section: PageSection }) => ReactNode> = {
  hero: HeroBlock,
  richText: RichTextBlock,
  cardGrid: CardGridBlock,
  cta: CtaBlock,
};
