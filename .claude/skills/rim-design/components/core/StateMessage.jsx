import React from "react";

const TONES = {
  success: { background: "var(--color-success-bg)", borderColor: "var(--color-success)" },
  warning: { background: "var(--color-warning-bg)", borderColor: "var(--color-warning)" },
  error: { background: "var(--color-error-bg)", borderColor: "var(--color-error)" },
  alert: { background: "var(--color-alert-bg)", borderColor: "var(--color-alert)" },
};

/** Inline feedback message with a left accent rule. */
export function StateMessage({ children, tone = "success", label, style, ...rest }) {
  return (
    <p
      style={{
        margin: 0,
        padding: "16px 18px",
        borderLeft: "3px solid",
        borderRadius: "var(--radius-xs)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-small)",
        color: "var(--rim-text)",
        ...TONES[tone],
        ...style,
      }}
      {...rest}
    >
      {label ? <strong>{label} </strong> : null}
      {children}
    </p>
  );
}
