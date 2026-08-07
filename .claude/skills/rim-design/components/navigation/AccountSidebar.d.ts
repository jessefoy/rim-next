import * as React from "react";

export interface AccountSidebarLink {
  label: string;
  href: string;
  /** Lucide icon element at size 17, strokeWidth 1.75 */
  icon?: React.ReactNode;
}

export interface AccountSidebarSection {
  /** Uppercase group label, e.g. "My RIM" */
  label?: string;
  links: AccountSidebarLink[];
}

/**
 * Collapsible left rail — the authoritative navigation for signed-in members.
 */
export interface AccountSidebarProps {
  sections?: AccountSidebarSection[];
  activeHref?: string;
  collapsed?: boolean;
  style?: React.CSSProperties;
}

export declare function AccountSidebar(props: AccountSidebarProps): React.JSX.Element;
