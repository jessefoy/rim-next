import * as React from "react";

/**
 * Centered serif quote card, optionally overlapping the hero band above it.
 */
export interface PullQuoteProps {
  children?: React.ReactNode;
  /** Attribution line under the quote */
  source?: string;
  /** Pull the card up 92px so it straddles the hero seam */
  floating?: boolean;
  style?: React.CSSProperties;
}

export declare function PullQuote(props: PullQuoteProps): React.JSX.Element;
