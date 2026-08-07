import * as React from "react";

/**
 * White list row: a named offering plus one action.
 */
export interface ListRowProps {
  name: string;
  /** Small qualifier appended to the name, e.g. "(online)" */
  badge?: string;
  /** Schedule line, rendered in --rim-mid */
  schedule?: string;
  /** Italic aside under the schedule */
  note?: string;
  /** Warm banner inside the row for time-sensitive news */
  announcement?: string;
  actionLabel?: string;
  actionHref?: string;
  actionDisabled?: boolean;
  onAction?: React.MouseEventHandler;
  style?: React.CSSProperties;
}

export declare function ListRow(props: ListRowProps): React.JSX.Element;
