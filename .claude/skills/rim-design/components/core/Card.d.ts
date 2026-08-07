import * as React from "react";

/**
 * Bounded white surface for one discrete piece of work.
 */
export interface CardProps {
  children?: React.ReactNode;
  /** px padding, default 32 */
  padding?: number | string;
  /** default var(--radius-lg) = 10px; program cards use 12px, quote cards 16px */
  radius?: string;
  /** the whisper card shadow, on by default */
  elevated?: boolean;
  /** 1px --rim-rule border instead of / alongside shadow */
  bordered?: boolean;
  style?: React.CSSProperties;
}

export declare function Card(props: CardProps): React.JSX.Element;
