import React from "react";

/** Receding Pampas-accent panel — supporting context that should be available
 *  without competing with the main action. */
export function Panel({ children, padding = 32, radius = "var(--radius-lg)", style, ...rest }) {
  return (
    <div style={{ background: "var(--rim-bg-accent)", borderRadius: radius, padding, ...style }} {...rest}>
      {children}
    </div>
  );
}
