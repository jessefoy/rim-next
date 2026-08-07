import React from "react";

/** Quiet uppercase orientation label above a heading. */
export function Eyebrow({ children, tone = "muted", style, ...rest }) {
  const colors = { muted: "var(--rim-text-muted)", blue: "var(--rim-mid)", onDark: "rgba(255,255,255,0.72)" };
  return (
    <p
      style={{
        margin: "0 0 10px",
        color: colors[tone],
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-xxs)",
        fontWeight: 700,
        letterSpacing: "var(--tracking-eyebrow)",
        lineHeight: 1.4,
        textTransform: "uppercase",
        ...style,
      }}
      {...rest}
    >
      {children}
    </p>
  );
}
