import React from "react";

/** Calm labelled form field. Labels are plain, fields are white. */
export function TextField({ label, help, id, type = "text", placeholder, value, defaultValue, onChange, required, onDark = false, style, ...rest }) {
  const fieldId = id || `f-${(label || placeholder || "field").replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", ...style }}>
      {label ? (
        <label htmlFor={fieldId} style={{ marginBottom: 8, color: onDark ? "#fff" : "var(--rim-text)", fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", fontWeight: 700 }}>
          {label}
        </label>
      ) : null}
      <input
        id={fieldId}
        type={type}
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        required={required}
        style={{
          width: "100%",
          minHeight: 44,
          padding: onDark ? "11px 14px" : "10px 12px",
          border: onDark ? "1px solid rgba(255,255,255,0.35)" : "1px solid var(--rim-rule)",
          borderRadius: "var(--radius-sm)",
          background: onDark ? "rgba(255,255,255,0.12)" : "var(--rim-surface)",
          color: onDark ? "#fff" : "var(--rim-text)",
          fontFamily: "var(--font-sans)",
          fontSize: 16,
          outline: "none",
        }}
        {...rest}
      />
      {help ? (
        <p style={{ margin: "8px 0 0", color: "var(--rim-text-muted)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)" }}>{help}</p>
      ) : null}
    </div>
  );
}
