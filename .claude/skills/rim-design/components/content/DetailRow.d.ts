import * as React from "react";

/**
 * A single labelled fact (date, time, location, dana) in a details card.
 */
export interface DetailRowProps {
  /** Lucide icon element, 18–20px, strokeWidth 1.75 */
  icon?: React.ReactNode;
  children?: React.ReactNode;
  /** Optional trailing link label */
  link?: string;
  linkHref?: string;
  /** Drop the bottom divider */
  last?: boolean;
  style?: React.CSSProperties;
}

export declare function DetailRow(props: DetailRowProps): React.JSX.Element;
