import React from "react";

/** White surface on the warm Pampas ground. Cards are for a distinct thing a
 *  person can understand or act on — not for wrapping every paragraph. */
export function Card({ children, padding = 32, radius = "var(--radius-lg)", elevated = true, bordered = false, style, ...rest }) {
  return (
    <div
      style={{
        background: "var(--rim-surface)",
        borderRadius: radius,
        padding,
        border: bordered ? "1px solid var(--rim-rule)" : "none",
        boxShadow: elevated ? "var(--card-shadow)" : "none",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
