import React, { useState } from "react";

/** Public site header — sticky white bar, logo + wordmark, hover dropdowns,
 *  red DONATE pill, hamburger below 768px. */
export function SiteNav({ logoSrc, items = [], donateHref = "/donate", activeLabel, style, ...rest }) {
  const [open, setOpen] = useState(null);
  const linkBase = {
    fontFamily: "var(--font-sans)",
    fontSize: 16,
    fontWeight: 500,
    color: "var(--rim-text)",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px 12px",
    borderRadius: "var(--radius-xs)",
    whiteSpace: "nowrap",
    textDecoration: "none",
    transition: "color var(--transition-fast), background var(--transition-fast)",
  };
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 100, background: "#fff", ...style }} {...rest}>
      <div style={{ display: "flex", alignItems: "center", maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: "var(--nav-height)", gap: 8 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", flexShrink: 0 }}>
          {logoSrc ? <img src={logoSrc} alt="Rooted In Mindfulness" height={45} /> : null}
          <span style={{ fontFamily: "var(--font-serif)", fontSize: "var(--text-h4)", fontWeight: 400, color: "var(--rim-text)", lineHeight: 1.2 }}>Rooted In Mindfulness</span>
        </a>
        <nav aria-label="Main navigation" style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: "auto" }}>
          {items.map((item) =>
            item.children ? (
              <div
                key={item.label}
                style={{ position: "relative" }}
                onMouseEnter={() => setOpen(item.label)}
                onMouseLeave={() => setOpen(null)}
              >
                <button style={{ ...linkBase, display: "flex", alignItems: "center", gap: 5, background: open === item.label ? "var(--rim-bg)" : "none", color: open === item.label ? "var(--rim-blue)" : "var(--rim-text)" }}>
                  {item.label}
                  <span aria-hidden="true" style={{ fontSize: 10, color: "var(--rim-text-muted)" }}>▾</span>
                </button>
                {open === item.label ? (
                  <div style={{ position: "absolute", top: "100%", right: 0, minWidth: 230, paddingTop: 6, zIndex: 200 }}>
                    <div style={{ background: "#fff", borderRadius: "var(--radius-sm)", padding: 8, boxShadow: "var(--card-shadow)" }}>
                      {item.children.map((c, i) => (
                        <a
                          key={c.label}
                          href={c.href}
                          style={{ display: "block", padding: "10px 12px", textDecoration: "none", color: "var(--rim-text)", borderBottom: i < item.children.length - 1 ? "1px solid var(--rim-bg-accent)" : "none" }}
                        >
                          <div style={{ fontWeight: 600, fontSize: "var(--text-ui)" }}>{c.label}</div>
                          {c.description ? <div style={{ fontSize: "var(--text-label)", color: "var(--rim-text-muted)", marginTop: 2 }}>{c.description}</div> : null}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <a key={item.label} href={item.href} style={{ ...linkBase, color: activeLabel === item.label ? "var(--rim-blue)" : "var(--rim-text)", fontWeight: activeLabel === item.label ? 600 : 500 }}>
                {item.label}
              </a>
            )
          )}
        </nav>
        <a
          href={donateHref}
          style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 700, letterSpacing: "0.08em", color: "#fff", background: "var(--rim-donate)", padding: "8px 18px", borderRadius: "var(--radius-pill)", textDecoration: "none", marginLeft: 8, flexShrink: 0 }}
        >
          DONATE
        </a>
      </div>
    </header>
  );
}
