"use client";

/**
 * /admin/banner — Site banner management (ADMIN only)
 *
 * Single-slot broadcast banner for community-wide notices.
 * CSS prefix: adm-bn-
 */

import { useState, useEffect } from "react";
import RimProseEditor from "@/components/RimProseEditor";
import { renderBlockNoteHtml, extractBlockNoteText } from "@/lib/renderRichContent";

interface Banner {
  id: string;
  body: any; // BlockNote JSON
  bodyHtml: string;
  createdAt: string;
}

export default function AdminBannerPage() {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState<any>(null);
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

  /** Check if BlockNote JSON has meaningful content */
  function hasContent(json: any): boolean {
    if (!json) return false;
    return extractBlockNoteText(json).trim().length > 0;
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
      setBody(null);
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
      <p style={{ color: "var(--rim-text-muted)", fontSize: 14, marginBottom: 24 }}>
        Post a single banner visible to all logged-in members at the top of their dashboard.
        Only one banner can be active at a time.
      </p>

      {banner ? (
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 11, fontFamily: "var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--rim-text-muted)", marginBottom: 6 }}>
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
        <p style={{ color: "var(--rim-text-muted)", fontSize: 14, marginBottom: 24 }}>
          No active banner.
        </p>
      )}

      <div style={{ borderTop: "1px solid #e8e3dd", paddingTop: 24 }}>
        <p style={{ fontSize: 11, fontFamily: "var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--rim-text-muted)", marginBottom: 6 }}>
          Post New Banner
        </p>
        <div className="fg">
          <RimProseEditor
            value={body}
            onChange={setBody}
            placeholder="e.g. Tonight's meditation is cancelled due to weather."
            variant="compact"
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
