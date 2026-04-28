"use client";

/**
 * /admin/banner — Site banner management (ADMIN only)
 *
 * Single-slot broadcast banner for community-wide notices.
 * CSS prefix: adm-bn-
 */

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { renderBlockNoteHtml } from "@/lib/renderRichContent";

const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div style={{ minHeight: 80 }} /> },
);

interface Banner {
  id: string;
  body: any; // HTML string or legacy BlockNote JSON
  bodyHtml: string;
  createdAt: string;
}

export default function AdminBannerPage() {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/site-banner")
      .then((r) => r.json())
      .then((data) => {
        if (data.banner) {
          setBanner({
            ...data.banner,
            bodyHtml: renderBlockNoteHtml(data.banner.body),
          });
        }
        setLoading(false);
      });
  }, []);

  /** Check if the editor has meaningful content (HTML strip + trim). */
  function hasContent(html: string): boolean {
    return html.replace(/<[^>]+>/g, "").trim().length > 0;
  }

  async function postBanner() {
    if (!hasContent(body)) return;
    setSaving(true);
    const res = await fetch("/api/admin/site-banner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      const data = await res.json();
      setBanner({
        ...data.banner,
        bodyHtml: renderBlockNoteHtml(data.banner.body),
      });
      setBody("");
    }
    setSaving(false);
  }

  async function deactivate() {
    if (!banner) return;
    const res = await fetch(`/api/admin/site-banner?id=${banner.id}`, { method: "DELETE" });
    if (res.ok) setBanner(null);
  }

  if (loading) return <div className="hub-page"><p className="hub-empty">Loading…</p></div>;

  return (
    <div className="hub-page" style={{ maxWidth: 600 }}>
      <h1 className="adm-page-title">Site Banner</h1>
      <p style={{ color: "var(--rim-text-muted)", fontSize: "var(--text-ui)", marginBottom: 24 }}>
        Post a single banner visible to all logged-in members at the top of their dashboard.
        Only one banner can be active at a time.
      </p>

      {banner ? (
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: "var(--text-xxs)", fontFamily: "var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--rim-text-muted)", marginBottom: 6 }}>
            Active Banner
          </p>
          <div className="sb-strip" style={{ borderRadius: 6 }}>
            <div
              className="sb-strip__body"
              dangerouslySetInnerHTML={{ __html: banner.bodyHtml }}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn--ghost" onClick={deactivate}>Deactivate</button>
          </div>
        </div>
      ) : (
        <p style={{ color: "var(--rim-text-muted)", fontSize: "var(--text-ui)", marginBottom: 24 }}>
          No active banner.
        </p>
      )}

      <div style={{ borderTop: "1px solid #ddd", paddingTop: 24 }}>
        <p style={{ fontSize: "var(--text-xxs)", fontFamily: "var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--rim-text-muted)", marginBottom: 6 }}>
          Post New Banner
        </p>
        <div className="fg">
          <RimTiptapEditor
            value={body}
            onChange={setBody}
            placeholder="e.g. Tonight's meditation is cancelled due to weather."
            variant="message"
          />
        </div>
        <div className="form-actions" style={{ justifyContent: "flex-end" }}>
          <button
            className="btn"
            onClick={postBanner}
            disabled={saving || !hasContent(body)}
          >
            {saving ? "Posting…" : "Post Banner"}
          </button>
        </div>
      </div>
    </div>
  );
}
