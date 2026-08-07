import React from "react";

/** Serif pull-quote card. On program heroes it floats up over the band. */
export function PullQuote({ children, source, floating = false, style, ...rest }) {
  return (
    <figure
      style={{
        background: "var(--rim-surface)",
        borderRadius: "var(--radius-2xl)",
        padding: "42px 44px 38px",
        margin: floating ? "-92px auto 56px" : "0 auto 56px",
        maxWidth: 720,
        textAlign: "center",
        position: "relative",
        zIndex: 2,
        boxShadow: "var(--card-shadow)",
        ...style,
      }}
      {...rest}
    >
      <blockquote style={{ margin: "0 0 10px", fontFamily: "var(--font-serif)", fontSize: "var(--text-h4)", fontWeight: 400, lineHeight: 1.6, color: "var(--rim-text)" }}>
        {children}
      </blockquote>
      {source ? <figcaption style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-small)", color: "var(--rim-text-muted)" }}>{source}</figcaption> : null}
    </figure>
  );
}
