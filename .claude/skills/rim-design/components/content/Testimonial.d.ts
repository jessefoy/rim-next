import * as React from "react";

/**
 * Community voice quote, used three-across on the homepage.
 */
export interface TestimonialProps {
  children?: React.ReactNode;
  /** Defaults to "— Community member"; RIM does not name quoted members */
  attribution?: string;
  style?: React.CSSProperties;
}

export declare function Testimonial(props: TestimonialProps): React.JSX.Element;
