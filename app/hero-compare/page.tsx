import Link from "next/link";

/**
 * TEMPORARY — home hero A/B, for Jesse to pick between the two treatments.
 * Lives only on the claude/public-pages-rim-style branch; delete once the
 * choice is made. Not linked from anywhere and not indexed.
 */
export const metadata = {
  title: "Home hero — A/B",
  robots: { index: false, follow: false },
};

const HEADLINE = (
  <>
    Awaken your Mind,
    <br />
    Open your Heart,
    <br />
    Nourish your Life,
    <br />
    Beautify the World.
  </>
);

const BODY = `RIM is a modern, welcoming Dharma center grounded in traditional Buddhist wisdom. We offer meditation and mindful living practices in a safe and supportive community — to help one another heal, grow, awaken, and live in ways that benefit yourself, those you love, and our shared world.`;

function HeroVideo() {
  return (
    <div className="pp-hero__video" aria-hidden="true">
      <video autoPlay loop muted playsInline poster="/videos/Bodhi_Leaves-poster-00001.jpg">
        <source src="/videos/Bodhi_Leaves-transcode.webm" type="video/webm" />
        <source src="/videos/Bodhi_Leaves-transcode.mp4" type="video/mp4" />
      </video>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="pp-section pp-section--tight" style={{ background: "var(--rim-bg-accent)" }}>
      <div className="rim-container">
        <p className="pp-intro__eyebrow" style={{ margin: 0 }}>
          {children}
        </p>
      </div>
    </div>
  );
}

export default function HeroComparePage() {
  return (
    <div className="pp-page">
      <Label>Option A — dark (the version you saw and liked)</Label>

      <section className="pp-hero pp-hero--video">
        <HeroVideo />
        <div className="rim-container pp-hero__inner">
          <h1 className="pp-hero__title">{HEADLINE}</h1>
          <p className="pp-hero__body">{BODY}</p>
          <div className="pp-hero__actions">
            <Link href="/join" className="pp-btn pp-btn--onblue">
              Join us&ndash;today
            </Link>
            <Link href="/this-week" className="pp-hero__link">
              See what&rsquo;s happening this week <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <Label>Option B — light (matches the live site)</Label>

      <section className="pp-hero pp-hero--video pp-hero--light">
        <HeroVideo />
        <div className="rim-container pp-hero__inner">
          <h1 className="pp-hero__title">{HEADLINE}</h1>
          <p className="pp-hero__body">{BODY}</p>
          <div className="pp-hero__actions">
            <Link href="/join" className="pp-btn">
              Join us&ndash;today
            </Link>
            <Link href="/this-week" className="pp-hero__link">
              See what&rsquo;s happening this week <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <Label>Both sit above this ground — the first section follows here</Label>
    </div>
  );
}
