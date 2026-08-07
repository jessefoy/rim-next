import React from "react";

const TONES = {
  neutral: { background: "var(--rim-bg-accent)", color: "var(--rim-text-muted)" },
  blue: { background: "var(--rim-bg-accent)", color: "var(--rim-blue)" },
  success: { background: "var(--color-success-bg)", color: "var(--color-success)" },
  warning: { background: "var(--color-warning-bg)", color: "var(--color-warning)" },
  alert: { background: "var(--color-alert-bg)", color: "var(--color-alert)" },
  error: { background: "var(--color-error-bg)", color: "var(--color-error)" },
};

/** Small status pill — registration state, live indicators, dana chips. */
export function Badge({ children, tone = "neutral", uppercase = false, style, ...rest }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 9px",
        borderRadius: "var(--radius-pill)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-xxs)",
        fontWeight: 600,
        letterSpacing: uppercase ? "0.05em" : undefined,
        textTransform: uppercase ? "uppercase" : "none",
        ...TONES[tone],
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
