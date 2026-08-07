import React from "react";

const SIZES = {
  sm: { minHeight: 36, padding: "0 18px", fontSize: "var(--text-small)" },
  md: { minHeight: 44, padding: "0 22px", fontSize: "var(--text-ui)" },
  lg: { minHeight: 50, padding: "0 30px", fontSize: "16px" },
};

/** RIM pill button. Primary = filled blue; secondary = white with blue rule;
 *  ghost = bare; donate = the one warm red in the system. */
export function Button({
  children,
  variant = "primary",
  size = "md",
  href,
  disabled = false,
  fullWidth = false,
  onClick,
  type = "button",
  style,
  ...rest
}) {
  const base = {
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: fullWidth ? "100%" : undefined,
    borderRadius: "var(--radius-pill)",
    fontFamily: "var(--font-sans)",
    fontWeight: 600,
    lineHeight: 1.2,
    textDecoration: "none",
    whiteSpace: "nowrap",
    cursor: disabled ? "default" : "pointer",
    transition: "background var(--transition-fast), opacity var(--transition-fast), color var(--transition-fast)",
    opacity: disabled ? 0.45 : 1,
    ...SIZES[size],
  };
  const variants = {
    primary: { background: "var(--rim-blue)", color: "#fff", border: "1px solid var(--rim-blue)" },
    secondary: { background: "var(--rim-surface)", color: "var(--rim-blue)", border: "1px solid var(--rim-blue)" },
    ghost: { background: "transparent", color: "var(--rim-blue)", border: "1px solid transparent" },
    donate: { background: "var(--rim-donate)", color: "#fff", border: "1px solid var(--rim-donate)", letterSpacing: "0.08em", fontWeight: 700, fontSize: "var(--text-label)", minHeight: 36, padding: "0 18px" },
  };
  const merged = { ...base, ...variants[variant], ...style };
  const Tag = href && !disabled ? "a" : "button";
  return (
    <Tag
      href={href}
      type={Tag === "button" ? type : undefined}
      disabled={Tag === "button" ? disabled : undefined}
      onClick={disabled ? undefined : onClick}
      style={merged}
      {...rest}
    >
      {children}
    </Tag>
  );
}
