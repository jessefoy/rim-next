import React from "react";

/** Catalog card for the community programs listing. Whole card is the link. */
export function ProgramCard({ title, tags = [], meta = [], description, action, href = "#", style, ...rest }) {
  return (
    <a
      href={href}
      style={{
        display: "block",
        minWidth: 0,
        overflow: "hidden",
        borderRadius: "var(--radius-xl)",
        background: "var(--rim-surface)",
        boxShadow: "var(--card-shadow)",
        color: "var(--rim-text)",
        textDecoration: "none",
        transition: "background-color var(--transition-fast) ease",
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", gap: 20, padding: "21px 24px" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "7px 12px" }}>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: "var(--text-h4)", color: "var(--rim-text)" }}>{title}</span>
            {tags.map((t) => (
              <span key={t} style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xxs)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rim-mid)" }}>{t}</span>
            ))}
          </div>
          {description ? (
            <p style={{ margin: "8px 0 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-small)", color: "var(--rim-text-quote)", lineHeight: 1.6 }}>{description}</p>
          ) : null}
          {meta.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px", margin: "14px 0 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--rim-text-muted)" }}>
              {meta.map((m, i) => (
                <React.Fragment key={m}>
                  {i > 0 ? <span aria-hidden="true" style={{ color: "var(--rim-rule)" }}>·</span> : null}
                  <span>{m}</span>
                </React.Fragment>
              ))}
            </div>
          ) : null}
        </div>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-small)", fontWeight: 600, color: "var(--rim-blue)", whiteSpace: "nowrap" }}>{action || "View →"}</span>
      </div>
    </a>
  );
}
