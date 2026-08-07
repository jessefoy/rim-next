import * as React from "react";

/**
 * Full-bleed hero with the copy set directly on scrimmed imagery.
 *
 * Session 169 retired the previous 95%-opaque white "paper panel" treatment.
 * See HeroPanel.jsx and RIM_Public_Pages.md for why.
 */
export interface HeroPanelProps {
  heading: string;
  children?: React.ReactNode;
  /** Quiet uppercase label above the title */
  eyebrow?: string;
  /** Primary action — renders as the white pill on the scrim */
  cta?: string;
  ctaHref?: string;
  /** Quiet arrow link beside the primary action */
  secondary?: string;
  secondaryHref?: string;
  /** Still photograph, or the poster frame when backgroundVideo is set */
  backgroundImage?: string;
  /** Looping footage — the homepage hero */
  backgroundVideo?: string;
  /**
   * "photo" (default) — directional blue→navy scrim over a still
   * "video" — flat rgba(12,18,22,0.38) scrim over footage
   */
  variant?: "photo" | "video";
  minHeight?: number;
  style?: React.CSSProperties;
}

export declare function HeroPanel(props: HeroPanelProps): React.JSX.Element;
