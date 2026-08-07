import React from "react";

/** Icon + fact row inside a program details card. Divider between rows. */
export function DetailRow({ icon, children, link, linkHref, last = false, style, ...rest }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "15px 5px 15px 0",
        borderBottom: last ? "none" : "1px solid var(--rim-rule)",
        ...style,
      }}
      {...rest}
    >
      {icon ? <span style={{ flexShrink: 0, color: "var(--rim-text-muted)", display: "flex", alignItems: "center" }}>{icon}</span> : null}
      <span style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 17, color: "var(--rim-text)", lineHeight: 1.77 }}>{children}</span>
      {link ? (
        <a href={linkHref} style={{ color: "var(--rim-mid)", fontSize: "var(--text-ui)", textDecoration: "none", whiteSpace: "nowrap" }}>{link}</a>
      ) : null}
    </div>
  );
}
