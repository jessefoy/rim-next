import React from "react";
import { Button } from "../core/Button.jsx";

/** Universal list row — community programs, dashboard Zoom links, My Library,
 *  course lessons. White card, name + schedule on the left, one action right. */
export function ListRow({ name, badge, schedule, note, announcement, actionLabel, actionHref, actionDisabled = false, onAction, style, ...rest }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        background: "var(--rim-surface)",
        borderRadius: "var(--radius-sm)",
        padding: "20px 24px",
        ...style,
      }}
      {...rest}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 2px", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--rim-text)", lineHeight: 1.3 }}>
          {name}
          {badge ? <span style={{ marginLeft: 4, fontSize: "var(--text-small)", fontWeight: 400, color: "var(--rim-text-muted)" }}>{badge}</span> : null}
        </p>
        {schedule ? <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-small)", color: "var(--rim-mid)", lineHeight: 1.5 }}>{schedule}</p> : null}
        {note ? <p style={{ margin: "6px 0 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-small)", fontStyle: "italic", color: "var(--rim-mid)" }}>{note}</p> : null}
        {announcement ? (
          <p style={{ margin: "8px 0 0", padding: "6px 12px", fontFamily: "var(--font-sans)", fontSize: "var(--text-small)", color: "var(--color-warning)", background: "var(--color-warning-bg)", lineHeight: 1.5 }}>{announcement}</p>
        ) : null}
      </div>
      {actionLabel ? (
        <div style={{ flexShrink: 0 }}>
          <Button size="sm" href={actionHref} disabled={actionDisabled} onClick={onAction} style={actionDisabled ? { background: "var(--rim-mid)", borderColor: "var(--rim-mid)" } : undefined}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
