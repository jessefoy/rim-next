import React from "react";

/** Blue site footer — newsletter row, logo, address, contact, copyright. */
export function SiteFooter({ logoSrc, memberArea = false, style, ...rest }) {
  return (
    <footer style={{ background: "var(--rim-blue)", padding: "100px 24px 40px", textAlign: "center", ...style }} {...rest}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {!memberArea ? (
          <>
            <div style={{ marginBottom: 8 }}>
              <h3 style={{ margin: "0 0 8px", color: "#fff", fontFamily: "var(--font-serif)", fontSize: "var(--text-h3)", fontWeight: 400 }}>Stay Connected</h3>
              <p style={{ margin: "0 0 20px", color: "rgba(255,255,255,0.75)", fontFamily: "var(--font-sans)", fontSize: "var(--text-small)" }}>Sign up for programs, events, and community news.</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <input placeholder="First name" style={inputStyle} />
                <input placeholder="Email address" style={inputStyle} />
                <button style={{ padding: "11px 22px", background: "var(--rim-surface)", color: "var(--rim-blue)", border: "none", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-sans)", fontSize: "var(--text-small)", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Subscribe</button>
              </div>
            </div>
            <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.18)", margin: "36px 0" }} />
          </>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          {logoSrc ? <img src={logoSrc} alt="Rooted In Mindfulness" width={65} style={{ marginBottom: 4 }} /> : null}
          <div style={{ color: "#fff", fontFamily: "var(--font-serif)", fontSize: 16 }}>Rooted In Mindfulness</div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontFamily: "var(--font-sans)", fontSize: "var(--text-ui)" }}>4040 N. Calhoun Rd., Brookfield, WI 53005</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center", fontFamily: "var(--font-sans)", fontSize: "var(--text-ui)" }}>
            <a href="tel:4148828932" style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none" }}>(414) 882-8932</a>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>·</span>
            <a href="mailto:support@rootedinmindfulness.org" style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none" }}>support@rootedinmindfulness.org</a>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 680, margin: "36px auto 0", paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.18)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: "var(--text-label)" }}>
        <span>©2020 Rooted In Mindfulness | 501(c)(3) Non-Profit | <a href="/donate" style={{ color: "rgba(255,255,255,0.5)" }}>Donate</a></span>
        <span>Powered by Kind People :) <a href="/volunteerism/volunteer" style={{ color: "rgba(255,255,255,0.5)" }}>Volunteer</a></span>
      </div>
    </footer>
  );
}

const inputStyle = {
  flex: 1,
  maxWidth: 210,
  padding: "11px 14px",
  border: "1px solid rgba(255,255,255,0.35)",
  borderRadius: "var(--radius-sm)",
  background: "rgba(255,255,255,0.12)",
  color: "#fff",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-small)",
  outline: "none",
};
