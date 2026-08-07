import * as React from "react";

/**
 * A weekly-schedule line on the homepage "This Week at RIM" table.
 */
export interface ScheduleRowProps {
  /** "Monday", "Every day" */
  day: string;
  name: string;
  description?: string;
  time: string;
  /** "Online" / "In person & online" */
  format?: string;
  /** Emphasises the format cell in --rim-mid */
  inPerson?: boolean;
  style?: React.CSSProperties;
}

export declare function ScheduleRow(props: ScheduleRowProps): React.JSX.Element;
