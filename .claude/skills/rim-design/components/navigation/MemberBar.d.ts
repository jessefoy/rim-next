import * as React from "react";

/**
 * 68px identity header for every signed-in surface; the sidebar carries navigation.
 */
export interface MemberBarProps {
  logoSrc?: string;
  /** Full name; only the first name and initial are shown */
  name?: string;
  onSignOut?: React.MouseEventHandler;
  style?: React.CSSProperties;
}

export declare function MemberBar(props: MemberBarProps): React.JSX.Element;
