import * as React from "react";

/**
 * Centered blue footer with the newsletter row, address, and copyright.
 */
export interface SiteFooterProps {
  /** White footer roundel, assets/logo/RIM-Website-Footer-Logo-White.png */
  logoSrc?: string;
  /** Hides the newsletter block inside the signed-in member area */
  memberArea?: boolean;
  style?: React.CSSProperties;
}

export declare function SiteFooter(props: SiteFooterProps): React.JSX.Element;
