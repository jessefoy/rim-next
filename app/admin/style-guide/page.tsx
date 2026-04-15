"use client";

/**
 * Master Style Guide — /admin/style-guide
 * Visual reference for the RIM design system.
 * CSS prefix: sg-
 *
 * Tabs: Typography | Colors | Buttons | Forms | Editor Output
 */

import { useState } from "react";

type Tab = "typography" | "colors" | "buttons" | "forms" | "editor";

const TABS: { id: Tab; label: string }[] = [
  { id: "typography", label: "Typography" },
  { id: "colors",     label: "Colors" },
  { id: "buttons",    label: "Buttons" },
  { id: "forms",      label: "Forms" },
  { id: "editor",     label: "Editor Output" },
];

export default function StyleGuidePage() {
  const [tab, setTab] = useState<Tab>("typography");

  return (
    <div className="sg-page">
      <div className="sg-header">
        <h1 className="sg-page-title">Master Style Guide</h1>
        <p className="sg-page-subtitle">
          The visual reference for the RIM design system. What you see here is
          what every page should look like. Add to this as new components are
          built.
        </p>
      </div>

      <nav className="sg-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`sg-tab${tab === t.id ? " sg-tab--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="sg-body">
        {tab === "typography" && <TypographyTab />}
        {tab === "colors"     && <ColorsTab />}
        {tab === "buttons"    && <ButtonsTab />}
        {tab === "forms"      && <FormsTab />}
        {tab === "editor"     && <EditorTab />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   TYPOGRAPHY
───────────────────────────────────────────────────────────── */

function TypographyTab() {
  return (
    <div>
      {/* Token reference */}
      <section className="sg-section">
        <h2 className="sg-section-title">Type Scale Tokens — :root</h2>
        <p className="sg-note">
          <strong>Use these tokens for all font sizes.</strong> Do not invent px values per component. If a size you need isn't here, add it as a new token. Only named exceptions (hero, editorial long-form) may use values outside this scale.
        </p>
        <div className="sg-type-scale">
          {[
            { token: "--text-hero",  value: "clamp(2.5rem, 4vw + 1rem, 3.25rem)", use: "Hero titles only" },
            { token: "--text-h1",    value: "38px", use: "h1 — page titles, section titles" },
            { token: "--text-h2",    value: "28px", use: "h2 — content headings" },
            { token: "--text-h3",    value: "24px", use: "h3 — sub-headings" },
            { token: "--text-h4",    value: "20px", use: "h4 — minor headings, grouped labels" },
            { token: "--text-body",  value: "18px", use: "p, li, td — all body text" },
            { token: "--text-small", value: "15px", use: "Captions, timestamps, helper text" },
            { token: "--text-xs",    value: "13px", use: "Labels, badges, eyebrows" },
          ].map((row) => (
            <div key={row.token} className="sg-token-row">
              <code className="sg-token-name">{row.token}</code>
              <span className="sg-token-value">{row.value}</span>
              <span className="sg-token-use">{row.use}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Heading scale — live */}
      <section className="sg-section">
        <h2 className="sg-section-title">Heading Scale — quincy-cf (--font-serif)</h2>
        <p className="sg-note">Sizes are locked globally via tokens. Context classes may override spacing (margin) but should not reinvent sizes. <code>lp-body h2: 32px</code> is the only named exception (editorial long-form).</p>
        <div className="sg-type-scale">
          <div className="sg-type-row">
            <div className="sg-type-example">
              <h1 style={{ margin: 0 }}>H1 — Page Title</h1>
            </div>
            <code className="sg-code">var(--text-h1) · 38px · quincy-cf 400</code>
          </div>
          <div className="sg-type-row">
            <div className="sg-type-example">
              <h2 style={{ margin: 0 }}>H2 — Content Heading</h2>
            </div>
            <code className="sg-code">var(--text-h2) · 28px · quincy-cf 400</code>
          </div>
          <div className="sg-type-row">
            <div className="sg-type-example">
              <h3 style={{ margin: 0 }}>H3 — Sub-heading</h3>
            </div>
            <code className="sg-code">var(--text-h3) · 24px · quincy-cf 400</code>
          </div>
          <div className="sg-type-row">
            <div className="sg-type-example">
              <h4 style={{ margin: 0 }}>H4 — Minor Heading</h4>
            </div>
            <code className="sg-code">var(--text-h4) · 20px · quincy-cf 400</code>
          </div>
          <div className="sg-type-row">
            <div className="sg-type-example">
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--rim-text-muted)", display: "block" }}>LABEL / EYEBROW</span>
            </div>
            <code className="sg-code">var(--text-xs) · 13px · Open Sans 700 · uppercase · letter-spacing: 0.06em</code>
          </div>
        </div>
      </section>

      {/* Body text standard */}
      <section className="sg-section">
        <h2 className="sg-section-title">Body Text — Open Sans (--font-sans)</h2>
        <p className="sg-note">
          The ground truth for all readable content. <strong>p</strong> and <strong>li</strong> must match this in every way. Set once on <code>body</code> and <code>.rim-content</code>; everything inherits.
        </p>
        <div className="sg-example-block">
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", lineHeight: "var(--lh-body)", color: "var(--rim-text)", margin: 0 }}>
            Lovingkindness is a practice of deliberately offering warmth — to yourself, to people you love, and even to people you struggle with. It's simpler than it sounds, and the effects are real. Each Monday morning, we practice meditations rooted in the four immeasurables.
          </p>
        </div>
        <code className="sg-code">var(--font-sans) · var(--text-body): 18px · var(--lh-body): 1.7 · var(--rim-text)</code>
      </section>

      {/* p vs li comparison */}
      <section className="sg-section">
        <h2 className="sg-section-title">Paragraph vs. List Items — must be identical</h2>
        <p className="sg-note">
          List items are body text in a list container. Font, size, weight, line-height, and color are identical to <code>p</code>. Only indentation, bullet style, and item spacing differ. <strong>Never set a different font-size or line-height on li.</strong>
        </p>
        <div className="sg-compare">
          <div className="sg-compare-col">
            <div className="sg-compare-label">Paragraph</div>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", lineHeight: "var(--lh-body)", color: "var(--rim-text)", margin: 0 }}>
              Practice lovingkindness and compassion meditation in a supportive group setting every Monday.
            </p>
          </div>
          <div className="sg-compare-col">
            <div className="sg-compare-label">List item (ul)</div>
            <ul style={{ margin: 0, paddingLeft: "1.5em" }}>
              <li style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", lineHeight: "var(--lh-body)", color: "var(--rim-text)", marginBottom: "0.35em" }}>
                Practice lovingkindness and compassion meditation in a supportive group setting.
              </li>
              <li style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", lineHeight: "var(--lh-body)", color: "var(--rim-text)", marginBottom: 0 }}>
                Explore different ways of opening the heart, even on hard days.
              </li>
            </ul>
          </div>
        </div>
        <code className="sg-code">li &#123; font-family: inherit; font-size: inherit; line-height: inherit &#125; — inherits from body / .rim-content</code>
      </section>

      {/* Text variants */}
      <section className="sg-section">
        <h2 className="sg-section-title">Text Variants</h2>
        <div className="sg-type-scale">
          <div className="sg-type-row">
            <div className="sg-type-example">
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", lineHeight: "var(--lh-body)", color: "var(--rim-text-quote)", fontStyle: "italic", display: "block" }}>Secondary / quote text — slightly lighter for pull-quotes or supporting copy.</span>
            </div>
            <code className="sg-code">var(--rim-text-quote) · #555555 · italic · body size</code>
          </div>
          <div className="sg-type-row">
            <div className="sg-type-example">
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-small)", lineHeight: 1.5, color: "var(--rim-text-muted)", display: "block" }}>Muted / caption — labels, timestamps, metadata, helper text.</span>
            </div>
            <code className="sg-code">var(--text-small) · 15px · var(--rim-text-muted)</code>
          </div>
          <div className="sg-type-row">
            <div className="sg-type-example">
              <span style={{ fontFamily: "var(--font-serif)", fontSize: "var(--text-h3)", fontWeight: 400, fontStyle: "italic", lineHeight: 1.5, color: "var(--rim-text-quote)", borderLeft: "3px solid var(--rim-mid)", paddingLeft: 20, display: "block" }}>
                "A practice of deliberately offering warmth — to yourself, to people you love."
              </span>
            </div>
            <code className="sg-code">Blockquote — var(--font-serif) · var(--text-h3) · italic · border-left: 3px solid --rim-mid</code>
          </div>
          <div className="sg-type-row">
            <div className="sg-type-example">
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", lineHeight: "var(--lh-body)", color: "var(--rim-mid)", display: "block" }}>
                Link text — uses --rim-mid (#39607a), underline on hover
              </span>
            </div>
            <code className="sg-code">color: var(--rim-mid) · text-decoration: none · hover: underline</code>
          </div>
        </div>
      </section>

      {/* Named exceptions */}
      <section className="sg-section">
        <h2 className="sg-section-title">Named Exceptions</h2>
        <p className="sg-note">These are the <em>only</em> places that use sizes outside the token scale. Every other heading and body text element must use tokens.</p>
        <div className="sg-type-scale">
          <div className="sg-type-row">
            <div className="sg-type-example">
              <span style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2.5rem, 4vw + 1rem, 3.25rem)", fontWeight: 500, lineHeight: 1.1, color: "var(--rim-text)", display: "block" }}>Hero Title</span>
            </div>
            <code className="sg-code">var(--text-hero) · clamp(2.5rem, 4vw + 1rem, 3.25rem) · ~40–52px fluid · weight 500</code>
          </div>
          <div className="sg-type-row">
            <div className="sg-type-example">
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 400, lineHeight: 1.3, color: "var(--rim-text)", display: "block" }}>Editorial H2 (lp-body)</span>
            </div>
            <code className="sg-code">32px · long-form lesson/article content — more generous than standard --text-h2 (28px)</code>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   COLORS
───────────────────────────────────────────────────────────── */

const COLOR_TOKENS = [
  { token: "--rim-dark",         hex: "#0d2235", label: "Deep navy",         use: "Dark backgrounds, footers" },
  { token: "--rim-blue",         hex: "#135274", label: "Primary teal",      use: "Primary buttons, hero overlays, footer" },
  { token: "--rim-mid",          hex: "#39607a", label: "Mid teal",          use: "Links, accents, active states" },
  { token: "--rim-bg",           hex: "#f5f5f5", label: "Page background",   use: "Body background — cool light grey" },
  { token: "--rim-bg-accent",    hex: "#eeeeee", label: "Accent background", use: "Cards, callouts, table rows" },
  { token: "--rim-text",         hex: "#333333", label: "Primary text",      use: "All body copy, headings" },
  { token: "--rim-text-quote",   hex: "#555555", label: "Secondary text",    use: "Pull-quotes, supporting copy" },
  { token: "--rim-text-muted",   hex: "#666666", label: "Muted text",        use: "Labels, timestamps, captions" },
  { token: "--rim-rule",         hex: "#d5d5d5", label: "Rule / border",     use: "Dividers, subtle borders" },
  { token: "--color-alert",      hex: "#C8821A", label: "Alert amber",       use: "Alert banners, warning text" },
  { token: "--color-alert-bg",   hex: "#FDF6EC", label: "Alert background",  use: "Alert banner fill" },
  { token: "--color-alert-border", hex: "#F0C98A", label: "Alert border",    use: "Alert banner border" },
];

function ColorsTab() {
  return (
    <div>
      <section className="sg-section">
        <h2 className="sg-section-title">Design Tokens — all colors</h2>
        <p className="sg-note">Never use raw hex values in new CSS. Always use these tokens. If a color you need isn't here, add it as a new token in <code>:root</code> in custom.css.</p>
        <div className="sg-swatch-grid">
          {COLOR_TOKENS.map((c) => (
            <div key={c.token} className="sg-swatch">
              <div className="sg-swatch-color" style={{ background: c.hex }} />
              <div className="sg-swatch-info">
                <div className="sg-swatch-label">{c.label}</div>
                <code className="sg-swatch-token">{c.token}</code>
                <div className="sg-swatch-hex">{c.hex}</div>
                <div className="sg-swatch-use">{c.use}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="sg-section">
        <h2 className="sg-section-title">Font Tokens</h2>
        <div className="sg-font-list">
          <div className="sg-font-row">
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 400 }}>quincy-cf — Headings &amp; Pull Quotes</span>
            <code className="sg-code">--font-serif (also --font-heading)</code>
          </div>
          <div className="sg-font-row">
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 18 }}>Open Sans — Body, UI, Lists, Labels</span>
            <code className="sg-code">--font-sans</code>
          </div>
          <div className="sg-font-row">
            <span style={{ fontFamily: "var(--font-source-sans)", fontSize: 18 }}>Source Sans 3 — Legacy only (Webflow remnant)</span>
            <code className="sg-code">--font-source-sans — do not use in new CSS</code>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   BUTTONS
───────────────────────────────────────────────────────────── */

function ButtonsTab() {
  return (
    <div>
      <section className="sg-section">
        <h2 className="sg-section-title">th-btn — Primary button system</h2>
        <p className="sg-note">Use <code>th-btn</code> as the base class on every button and link-button in admin and tool UIs. Combine with a modifier for variant. All buttons: min-height 44px for touch targets.</p>
        <div className="sg-btn-grid">
          <div className="sg-btn-item">
            <button className="th-btn th-btn--primary">Primary</button>
            <code className="sg-code">th-btn th-btn--primary</code>
            <div className="sg-btn-note">Default action, form submit, confirm</div>
          </div>
          <div className="sg-btn-item">
            <button className="th-btn">Default</button>
            <code className="sg-code">th-btn</code>
            <div className="sg-btn-note">Secondary action, neutral choice</div>
          </div>
          <div className="sg-btn-item">
            <button className="th-btn th-btn--ghost">Ghost</button>
            <code className="sg-code">th-btn th-btn--ghost</code>
            <div className="sg-btn-note">Tertiary, cancel, low-emphasis</div>
          </div>
          <div className="sg-btn-item">
            <button className="th-btn th-btn--danger">Danger</button>
            <code className="sg-code">th-btn th-btn--danger</code>
            <div className="sg-btn-note">Destructive actions (delete, remove)</div>
          </div>
          <div className="sg-btn-item">
            <button className="th-btn th-btn--primary th-btn--small">Small Primary</button>
            <code className="sg-code">th-btn th-btn--primary th-btn--small</code>
            <div className="sg-btn-note">Compact rows, inline actions</div>
          </div>
          <div className="sg-btn-item">
            <button className="th-btn th-btn--ghost th-btn--small">Small Ghost</button>
            <code className="sg-code">th-btn th-btn--ghost th-btn--small</code>
            <div className="sg-btn-note">Table row actions</div>
          </div>
          <div className="sg-btn-item">
            <button className="th-btn th-btn--icon">✎</button>
            <code className="sg-code">th-btn th-btn--icon</code>
            <div className="sg-btn-note">Icon-only actions (edit, close)</div>
          </div>
          <div className="sg-btn-item">
            <button className="th-btn th-btn--primary" disabled>Disabled</button>
            <code className="sg-code">disabled attribute</code>
            <div className="sg-btn-note">Unavailable / loading state</div>
          </div>
        </div>
      </section>

      <section className="sg-section">
        <h2 className="sg-section-title">btn — Hub &amp; legacy pages</h2>
        <p className="sg-note">Used in hub pages and older components. Prefer <code>th-btn</code> for new work.</p>
        <div className="sg-btn-grid">
          <div className="sg-btn-item">
            <button className="btn">btn</button>
            <code className="sg-code">btn</code>
          </div>
          <div className="sg-btn-item">
            <button className="btn btn--sm">btn--sm</button>
            <code className="sg-code">btn btn--sm</code>
          </div>
          <div className="sg-btn-item">
            <button className="btn--ghost">btn--ghost</button>
            <code className="sg-code">btn--ghost</code>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   FORMS
───────────────────────────────────────────────────────────── */

function FormsTab() {
  return (
    <div>
      <section className="sg-section">
        <h2 className="sg-section-title">Form Elements</h2>
        <p className="sg-note">All inputs: min 16px font (prevents iOS auto-zoom), min 44px height for touch targets. Labels are muted sans-serif. Use <code>th-field</code> + <code>th-field__label</code> + <code>th-input</code> for new forms.</p>

        <div className="sg-form-examples">
          {/* Text input */}
          <div className="sg-form-group">
            <label className="th-field__label">Text Input</label>
            <input className="th-input" type="text" placeholder="Enter value…" />
            <span className="sg-form-note">th-field__label + th-input</span>
          </div>

          {/* Input with value */}
          <div className="sg-form-group">
            <label className="th-field__label">With value</label>
            <input className="th-input" type="text" defaultValue="Awakening The Heart" readOnly />
            <span className="sg-form-note">th-input with value</span>
          </div>

          {/* Select */}
          <div className="sg-form-group">
            <label className="th-field__label">Select</label>
            <select className="th-input">
              <option>Choose one…</option>
              <option>Monday</option>
              <option>Tuesday</option>
              <option>Wednesday</option>
            </select>
            <span className="sg-form-note">th-input on select</span>
          </div>

          {/* Textarea */}
          <div className="sg-form-group">
            <label className="th-field__label">Textarea</label>
            <textarea className="th-input" rows={3} placeholder="Enter longer text…" />
            <span className="sg-form-note">th-input on textarea</span>
          </div>

          {/* Disabled */}
          <div className="sg-form-group">
            <label className="th-field__label">Disabled</label>
            <input className="th-input" type="text" defaultValue="Read only value" disabled />
            <span className="sg-form-note">disabled attribute</span>
          </div>

          {/* Checkbox */}
          <div className="sg-form-group">
            <label className="sg-checkbox-label">
              <input type="checkbox" defaultChecked />
              <span>Checkbox label</span>
            </label>
            <span className="sg-form-note">native checkbox + label</span>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   EDITOR OUTPUT
───────────────────────────────────────────────────────────── */

function EditorTab() {
  const sampleHtml = `
    <h2>About This Program</h2>
    <p>Lovingkindness is a practice of deliberately offering warmth — to yourself, to people you love, and even to people you struggle with. It's simpler than it sounds, and the effects are real.</p>
    <p>Each Monday morning, we practice meditations rooted in the four immeasurables — lovingkindness, compassion, appreciative joy, and equanimity.</p>
    <h3>Who it's for</h3>
    <p><strong>Everyone.</strong> Newcomers and longtime practitioners are equally welcome.</p>
    <p>In this program, you'll be invited to:</p>
    <ul>
      <li>Practice lovingkindness and compassion meditation in a supportive group</li>
      <li>Explore different ways of opening the heart — even on hard days</li>
      <li>Discover how small shifts in attention can change how you relate to yourself and others</li>
    </ul>
    <p>Sessions are held on Zoom every Monday at 7:00 AM CT.</p>
    <ol>
      <li>Register using the button below</li>
      <li>You'll receive a confirmation email with the Zoom link</li>
      <li>Show up — no preparation needed</li>
    </ol>
    <blockquote><em>"The tone is friendly and unhurried."</em></blockquote>
    <p>Questions? Email <a href="#">hello@rim.org</a>.</p>
  `;

  return (
    <div>
      <section className="sg-section">
        <h2 className="sg-section-title">.rim-content — Universal Editor Output</h2>
        <p className="sg-note">
          Every <code>dangerouslySetInnerHTML</code> output div gets two classes: the context class (<code>prog-description</code>, <code>man-body</code>, <code>lp-body</code>, etc.) plus <code>rim-content</code>. The context class sets layout/spacing; <code>.rim-content</code> is the universal typography foundation. <strong>p and li must look identical here.</strong>
        </p>
        <div className="sg-editor-preview">
          <div
            className="prog-description rim-content"
            dangerouslySetInnerHTML={{ __html: sampleHtml }}
          />
        </div>
      </section>

      <section className="sg-section">
        <h2 className="sg-section-title">Context Classes</h2>
        <p className="sg-note">These classes wrap editor output. Each has max-width, spacing, and heading-size overrides appropriate for its context. Typography is inherited from <code>.rim-content</code>.</p>
        <div className="sg-context-list">
          {[
            { cls: "prog-description rim-content", surface: "Program detail — public + member pages" },
            { cls: "man-body rim-content",          surface: "Staff manual pages" },
            { cls: "lp-body rim-content",           surface: "Lesson pages, manual editor preview" },
            { cls: "doc-body rim-content",          surface: "Hub documents" },
            { cls: "crs-desc rim-content",          surface: "Course series page" },
            { cls: "hub-conv-post__body rim-content", surface: "Hub conversation posts" },
            { cls: "hub-welcome__body rim-content",   surface: "Hub welcome interstitial" },
            { cls: "hub-home__content-body rim-content", surface: "Hub home content" },
          ].map((row) => (
            <div key={row.cls} className="sg-context-row">
              <code className="sg-context-cls">{row.cls}</code>
              <span className="sg-context-surface">{row.surface}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
