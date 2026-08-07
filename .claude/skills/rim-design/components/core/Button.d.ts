import * as React from "react";

/**
 * Pill-shaped action button — the single action affordance across RIM.
 */
export interface ButtonProps {
  children?: React.ReactNode;
  /** primary = filled blue, secondary = white/blue outline, ghost = bare, donate = warm red */
  variant?: "primary" | "secondary" | "ghost" | "donate";
  size?: "sm" | "md" | "lg";
  /** Renders an <a> instead of a <button> */
  href?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: React.MouseEventHandler;
  type?: "button" | "submit" | "reset";
  style?: React.CSSProperties;
}

export declare function Button(props: ButtonProps): React.JSX.Element;
