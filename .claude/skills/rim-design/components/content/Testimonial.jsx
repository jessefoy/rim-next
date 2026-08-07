import React from "react";

/** Community voice — italic body on the warm ground with a top rule. */
export function Testimonial({ children, attribution = "— Community member", style, ...rest }) {
  return (
    <blockquote
      style={{
        margin: 0,
        padding: "36px 32px",
        background: "var(--rim-bg)",
        borderTop: "3px solid var(--rim-rule)",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        ...style,
      }}
      {...rest}
    >
      <p style={{ margin: 0, flex: 1, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", lineHeight: "var(--lh-body)", fontStyle: "italic", color: "var(--rim-text)" }}>{children}</p>
      <footer style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", fontWeight: 600, fontStyle: "normal", color: "var(--rim-text-muted)" }}>{attribution}</footer>
    </blockquote>
  );
}
