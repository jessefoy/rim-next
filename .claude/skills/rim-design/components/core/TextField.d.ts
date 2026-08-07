import * as React from "react";

/**
 * Labelled single-line text input.
 */
export interface TextFieldProps {
  label?: string;
  /** Small helper line under the field */
  help?: string;
  id?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  required?: boolean;
  /** Translucent variant for the blue footer band */
  onDark?: boolean;
  style?: React.CSSProperties;
}

export declare function TextField(props: TextFieldProps): React.JSX.Element;
