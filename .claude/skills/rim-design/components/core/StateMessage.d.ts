import * as React from "react";

/**
 * Inline feedback banner — saved, needs attention, something went wrong.
 */
export interface StateMessageProps {
  children?: React.ReactNode;
  tone?: "success" | "warning" | "error" | "alert";
  /** Bolded lead-in, e.g. "Success." */
  label?: string;
  style?: React.CSSProperties;
}

export declare function StateMessage(props: StateMessageProps): React.JSX.Element;
