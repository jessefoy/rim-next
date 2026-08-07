import React from "react";

/** Quiet left rail for /account/* — the authoritative member navigation. */
export function AccountSidebar({ sections = [], activeHref, collapsed = false, style, ...rest }) {
  return (
    <nav
      aria-label="Account navigation"
      style={{
        width: collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)",
        padding: "22px 12px 48px",
        borderRight: "1px solid var(--rim-rule)",
        background: "var(--rim-surface)",
        flexShrink: 0,
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {sections.map((section, si) => (
          <React.Fragment key={section.label || si}>
            {si > 0 ? <div role="separator" style={{ height: 1, margin: "14px 8px 10px", background: "var(--rim-rule)" }} /> : null}
            {section.label && !collapsed ? (
              <p style={{ margin: "0 0 6px 12px", color: "var(--rim-text-muted)", fontFamily: "var(--font-sans)", fontSize: "var(--text-xxs)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{section.label}</p>
            ) : null}
            {section.links.map((l) => {
              const active = l.href === activeHref;
              return (
                <a
                  key={l.href}
                  href={l.href}
                  style={{
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: collapsed ? "10px 0" : "10px 12px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    borderRadius: "var(--radius-md)",
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-ui)",
                    fontWeight: active ? 600 : 400,
                    color: active ? "var(--rim-blue)" : "var(--rim-text)",
                    background: active ? "var(--rim-bg)" : "transparent",
                    textDecoration: "none",
                  }}
                >
                  <span style={{ display: "inline-flex", flexShrink: 0 }}>{l.icon}</span>
                  {!collapsed ? <span>{l.label}</span> : null}
                </a>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </nav>
  );
}
