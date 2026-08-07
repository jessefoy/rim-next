import * as React from "react";

/**
 * Receding warm panel for supporting context (never the primary surface).
 */
export interface PanelProps {
  children?: React.ReactNode;
  padding?: number | string;
  radius?: string;
  style?: React.CSSProperties;
}

export declare function Panel(props: PanelProps): React.JSX.Element;
