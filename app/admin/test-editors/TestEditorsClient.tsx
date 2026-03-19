"use client";

import { useState } from "react";
import RimBlockEditor from "@/components/RimBlockEditor";
import RimProseEditor from "@/components/RimProseEditor";

export default function TestEditorsClient() {
  const [blockContent, setBlockContent] = useState<any>(null);
  const [proseContent, setProseContent] = useState<any>(null);
  const [proseMinimalContent, setProseMinimalContent] = useState<any>(null);

  return (
    <div style={{ padding: 40, maxWidth: 800, margin: "0 auto", fontFamily: "var(--font-sans)" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Editor Test — Phase 1</h1>
      <p style={{ color: "var(--rim-text-muted)", marginBottom: 40, fontSize: 13 }}>
        Delete this page before Phase 3 deploy. Verify editors render, accept input, and fire onChange.
      </p>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--rim-text-muted)", marginBottom: 12 }}>
          RimBlockEditor — Full editor (slash commands, custom blocks)
        </h2>
        <RimBlockEditor
          value={blockContent}
          onChange={setBlockContent}
          placeholder="Try / for block menu, or insert a Verse Quote…"
          minHeight={300}
        />
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 12, color: "var(--rim-text-muted)", cursor: "pointer" }}>
            View BlockNote JSON output
          </summary>
          <pre style={{ fontSize: 11, background: "#f6f3f0", padding: 12, borderRadius: 4, overflow: "auto", marginTop: 8 }}>
            {JSON.stringify(blockContent, null, 2)}
          </pre>
        </details>
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--rim-text-muted)", marginBottom: 12 }}>
          RimProseEditor — Prose only (full toolbar)
        </h2>
        <RimProseEditor
          value={proseContent}
          onChange={setProseContent}
          placeholder="Prose editor — paragraph, lists, quotes…"
          minHeight={160}
        />
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 12, color: "var(--rim-text-muted)", cursor: "pointer" }}>
            View BlockNote JSON output
          </summary>
          <pre style={{ fontSize: 11, background: "#f6f3f0", padding: 12, borderRadius: 4, overflow: "auto", marginTop: 8 }}>
            {JSON.stringify(proseContent, null, 2)}
          </pre>
        </details>
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--rim-text-muted)", marginBottom: 12 }}>
          RimProseEditor — minimal=true (Bold + Italic + Link only)
        </h2>
        <RimProseEditor
          value={proseMinimalContent}
          onChange={setProseMinimalContent}
          placeholder="Minimal prose editor…"
          minHeight={100}
          minimal
        />
      </section>
    </div>
  );
}
