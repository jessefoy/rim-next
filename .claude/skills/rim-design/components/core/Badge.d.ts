import * as React from "react";

/**
 * Small status pill for registration/session state.
 */
export interface BadgeProps {
  children?: React.ReactNode;
  tone?: "neutral" | "blue" | "success" | "warning" | "alert" | "error";
  uppercase?: boolean;
  style?: React.CSSProperties;
}

export declare function Badge(props: BadgeProps): React.JSX.Element;
