import * as React from "react";

/**
 * Uppercase orientation label that sits above a heading.
 */
export interface EyebrowProps {
  children?: React.ReactNode;
  tone?: "muted" | "blue" | "onDark";
  style?: React.CSSProperties;
}

export declare function Eyebrow(props: EyebrowProps): React.JSX.Element;
