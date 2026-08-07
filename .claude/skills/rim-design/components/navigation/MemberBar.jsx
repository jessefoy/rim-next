import React from "react";

/** Quiet identity header for signed-in member, admin, and tool surfaces. */
export function MemberBar({ logoSrc, name = "Member", onSignOut, style, ...rest }) {
  const first = name.split(" ")[0];
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: "var(--member-bar-height)",
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--rim-rule)",
        background: "var(--rim-bg-bright)",
        ...style,
      }}
      {...rest}
    >
      <a href="/account/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "var(--rim-text)", fontFamily: "var(--font-serif)", fontSize: "var(--text-small)", textDecoration: "none" }}>
        {logoSrc ? <img src={logoSrc} alt="" height={36} style={{ display: "block", width: "auto" }} /> : null}
        <span>Rooted In Mindfulness</span>
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <a href="/account/dashboard-my-profile" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 8, color: "var(--rim-text)", fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", fontWeight: 600, textDecoration: "none" }}>
          <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--rim-bg-accent)", color: "var(--rim-blue)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
            {first.charAt(0).toUpperCase()}
          </span>
          <span>{first}</span>
        </a>
        <button onClick={onSignOut} style={{ minHeight: 44, padding: "8px 0", border: "none", background: "transparent", color: "var(--rim-text-muted)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)" }}>Sign out</button>
      </div>
    </header>
  );
}
