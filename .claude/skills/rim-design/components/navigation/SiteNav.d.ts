import * as React from "react";

export interface SiteNavItem {
  label: string;
  href?: string;
  children?: { label: string; href: string; description?: string }[];
}

/**
 * Public site header with hover dropdowns and the DONATE pill.
 */
export interface SiteNavProps {
  /** Path to the RIM roundel, e.g. assets/logo/Rooted-In-Mindfulness-Logo.png */
  logoSrc?: string;
  items?: SiteNavItem[];
  donateHref?: string;
  /** Label of the current top-level item */
  activeLabel?: string;
  style?: React.CSSProperties;
}

export declare function SiteNav(props: SiteNavProps): React.JSX.Element;
