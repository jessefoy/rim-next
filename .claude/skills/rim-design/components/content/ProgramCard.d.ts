import * as React from "react";

/**
 * Catalog card in the /community-programs listing — whole card is one link.
 */
export interface ProgramCardProps {
  title: string;
  /** Uppercase micro-labels beside the title, e.g. ["Drop-in"] */
  tags?: string[];
  /** Middot-separated facts: day, time, format */
  meta?: string[];
  description?: string;
  /** Right-hand affordance label, default "View →" */
  action?: string;
  href?: string;
  style?: React.CSSProperties;
}

export declare function ProgramCard(props: ProgramCardProps): React.JSX.Element;
