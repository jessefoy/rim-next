import React from "react";

/** One line of the weekly schedule table: day / program / time / format. */
export function ScheduleRow({ day, name, description, time, format, inPerson = false, style, ...rest }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "130px 1fr 130px 180px",
        alignItems: "center",
        padding: "18px 0",
        borderBottom: "1px solid var(--rim-rule)",
        ...style,
      }}
      {...rest}
    >
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xxs)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--rim-text-muted)" }}>{day}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <strong style={{ fontFamily: "var(--font-serif)", fontSize: "var(--text-h4)", fontWeight: 400, color: "var(--rim-text)" }}>{name}</strong>
        {description ? <span style={{ fontSize: "var(--text-xs)", color: "var(--rim-text-muted)" }}>{description}</span> : null}
      </span>
      <span style={{ fontSize: "var(--text-small)", color: "var(--rim-text)", fontVariantNumeric: "tabular-nums" }}>{time}</span>
      <span style={{ fontSize: "var(--text-xs)", fontWeight: inPerson ? 600 : 500, color: inPerson ? "var(--rim-mid)" : "var(--rim-text-muted)" }}>{format}</span>
    </div>
  );
}
