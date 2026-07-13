import Link from "next/link";

export const metadata = {
  title: "RIM Style Guide",
  robots: { index: false, follow: false },
};

export default function StyleGuidePage() {
  return (
    <div className="sg-page">
      <section className="sg-hero">
        <div className="sg-shell">
          <p className="sg-eyebrow">Rooted in Mindfulness</p>
          <h1>A quiet visual foundation</h1>
          <p>
            A working reference for the colors, type, and interface patterns that help every RIM
            page feel clear, warm, and easy to use.
          </p>
          <Link href="/" className="sg-back">← Back to RIM</Link>
        </div>
      </section>

      <div className="sg-shell sg-content">
        <section className="sg-section" aria-labelledby="sg-colors">
          <div className="sg-section__intro">
            <p className="sg-eyebrow">Foundation</p>
            <h2 id="sg-colors">Color</h2>
            <p>The page recedes into Pampas. The content people read, complete, and act on rests on white.</p>
          </div>
          <div className="sg-swatches">
            <div className="sg-swatch sg-swatch--ground"><span>Page ground</span><strong>Pampas · #F5F3F0</strong></div>
            <div className="sg-swatch sg-swatch--surface"><span>Content surface</span><strong>White · #FFFFFF</strong></div>
            <div className="sg-swatch sg-swatch--text"><span>Primary text</span><strong>Mine Shaft · #333333</strong></div>
            <div className="sg-swatch sg-swatch--action"><span>Primary action</span><strong>RIM blue</strong></div>
          </div>
        </section>

        <section className="sg-section" aria-labelledby="sg-type">
          <div className="sg-section__intro">
            <p className="sg-eyebrow">Reading</p>
            <h2 id="sg-type">Typography</h2>
          </div>
          <div className="sg-type-card">
            <h1>Clear, spacious, and human</h1>
            <h2>A heading makes the next thing visible.</h2>
            <p>
              RIM’s body text is deliberately generous: it gives the reader room to arrive, take in what matters,
              and choose their next step without feeling managed by the page.
            </p>
            <p className="sg-caption">Open Sans for interface and body text · Quincy CF for editorial headings</p>
          </div>
        </section>

        <section className="sg-section" aria-labelledby="sg-components">
          <div className="sg-section__intro">
            <p className="sg-eyebrow">Interaction</p>
            <h2 id="sg-components">Common elements</h2>
          </div>
          <div className="sg-components">
            <article className="sg-card">
              <p className="sg-eyebrow">A white surface</p>
              <h3>A bounded piece of work</h3>
              <p>Cards are for distinct things a person can understand or act on—not for wrapping every paragraph.</p>
              <div className="sg-actions">
                <button type="button" className="sg-button">Primary action</button>
                <button type="button" className="sg-button sg-button--secondary">Secondary action</button>
              </div>
            </article>
            <div className="sg-card">
              <label htmlFor="style-guide-email">A calm form field</label>
              <input id="style-guide-email" type="email" placeholder="you@example.org" />
              <p className="sg-field-help">Labels are plain, fields are white, and the next action is clear.</p>
              <button type="button" className="sg-button">Continue</button>
            </div>
            <aside className="sg-panel">
              <p className="sg-eyebrow">A receding panel</p>
              <h3>Helpful context</h3>
              <p>Use the soft Pampas panel for supporting information that should be available without competing with the main action.</p>
            </aside>
          </div>
        </section>

        <section className="sg-section" aria-labelledby="sg-states">
          <div className="sg-section__intro">
            <p className="sg-eyebrow">Feedback</p>
            <h2 id="sg-states">States stay meaningful</h2>
          </div>
          <div className="sg-states">
            <p className="sg-state sg-state--success"><strong>Success.</strong> Your changes have been saved.</p>
            <p className="sg-state sg-state--warning"><strong>Please note.</strong> This action needs your attention.</p>
            <p className="sg-state sg-state--error"><strong>Something needs fixing.</strong> Check the highlighted field and try again.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
