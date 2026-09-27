import Script from "next/script";

export const metadata = {
  title: "Donate — Rooted In Mindfulness",
  description:
    "Rooted in Mindfulness is supported entirely by its community's generosity. Give to RIM for the center's operating costs, or to the Teaching Fund to support teacher livelihood.",
};

/**
 * /donate — body rewritten 2026-09-26 from the site revision brief so it says
 * how dana actually works at RIM: suggested amounts, no one turned away,
 * minimums only where RIM pays a host, program gifts split 50/50 with the
 * Teaching Fund. The three Givebutter widgets and their placement are
 * unchanged. The fund is the Teaching Fund in headings; the quoted campaign
 * names ("RIM Dana", "Teacher Dana") stay so donors can match them to the
 * widgets (Jesse, 2026-09-26).
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/04-community-website-copy-2026-09-25.md
 * Provisional until Jesse's read-aloud.
 */

/** The reflections on how much to give. Each title leads into its body. */
const CONTEMPLATIONS = [
  {
    num: 1,
    title: "Care for your own needs.",
    body: "Give in a way that does not bring hardship to you or to those who depend on you. Your presence is priceless.",
  },
  {
    num: 2,
    title: "Let it be generous.",
    body: "Giving is itself a practice: of letting go, and of care.",
  },
  {
    num: 3,
    title: "Consider what RIM makes possible,",
    body: "in your life and in the lives of others.",
  },
  {
    num: 4,
    title: "Consider your teachers,",
    body: "and what it means for them to be supported well enough to teach freely.",
  },
  {
    num: 5,
    title: "Remember who else it reaches:",
    body: "people you will never meet, for whom the door stays open.",
  },
];

export default function DonatePage() {
  return (
    <div className="pp-page">
      <Script
        src="https://widgets.givebutter.com/latest.umd.cjs?acct=GcnXeYilkL4lWnr3&p=other"
        strategy="lazyOnload"
      />

      {/* ── Hero: headline beside the two donation cards ──── */}
      <section
        className="pp-hero pp-hero--donate"
        style={{
          ["--pp-hero-image" as string]: "url('/images/Sky-Heavenly.jpg')",
        }}
      >
        <div className="rim-container pp-hero__inner">
          <div className="pp-donate-hero">
            <div className="pp-donate-hero__lead">
              <h1 className="pp-hero__title pp-hero__title--display">
                Your generosity keeps the door open.
              </h1>
              <p className="pp-hero__body">
                Our teachings are offered through dana, the practice of generosity. RIM is supported
                entirely by the people who practice here, and no one is ever turned away for
                financial reasons.
              </p>
              <a href="#dana-at-rim" className="pp-btn pp-btn--onblue">
                Learn more about dana ↓
              </a>
            </div>

            <div className="pp-give">
              {/* RIM Dana */}
              <div className="pp-give__card" id="rim-dana">
                <h2 className="pp-give__title">Give to RIM</h2>
                <p className="pp-give__name">&ldquo;RIM Dana&rdquo;</p>
                <p className="pp-give__body">
                  Gifts to RIM pay for everything that keeps the center open: rent, utilities,
                  supplies, the technology behind our online gatherings, outreach, and more. Monthly
                  gifts, as a Sustaining Member, give the center steadiness it can plan around.
                </p>

                <div className="pp-give__widget">
                  {/* @ts-expect-error custom element */}
                  <givebutter-widget id="gBBMYg"></givebutter-widget>
                </div>

                <a href="#how-much" className="pp-give__help">
                  Need help determining an amount to give?
                </a>
              </div>

              {/* Teaching Fund (Givebutter campaign "Teacher Dana") */}
              <div className="pp-give__card" id="teacher-dana">
                <h2 className="pp-give__title">Give to the Teaching Fund</h2>
                <p className="pp-give__name">&ldquo;Teacher Dana&rdquo;</p>
                <p className="pp-give__body">
                  Our teachers offer the teachings freely and are supported by the community&rsquo;s
                  generosity. Gifts to the Teaching Fund support their livelihood, so they can give
                  their lives to practicing and sharing the teachings.
                </p>

                <div className="pp-give__widget">
                  {/* @ts-expect-error custom element */}
                  <givebutter-widget id="pnbnmp"></givebutter-widget>
                </div>
                <div className="pp-give__widget">
                  {/* @ts-expect-error custom element */}
                  <givebutter-widget id="j2WG2L"></givebutter-widget>
                </div>

                <a href="#how-much" className="pp-give__help">
                  Need help determining an amount to give?
                </a>
              </div>

              {/* Inside the card column, not a third child of the hero grid —
                  it belongs under the forms it refers to. */}
              <p className="pp-give__assist">
                <noscript>
                  The donation forms need JavaScript.{" "}
                </noscript>
                Trouble with the donation form? Some browser extensions block it.
                You can also give by phone at{" "}
                <a href="tel:4148828932">(414) 882-8932</a> or email{" "}
                <a href="mailto:support@rootedinmindfulness.org?subject=Donating%20to%20RIM">
                  support@rootedinmindfulness.org
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Dana at RIM ───────────────────────────────────── */}
      <section id="dana-at-rim" className="pp-section pp-section--airy">
        <div className="rim-container">
          <div className="pp-statement">
            <h2 className="pp-statement__title">What is dana?</h2>

            <div className="pp-prose pp-statement__body">
              <p>
                Dana (DAH-nuh) is a Pali word for generosity: a gift freely given. It is a
                relationship, not a fee for a service. What you receive here was given by someone,
                and what you give keeps the door open for the next person. Time, care, and presence
                are gifts too.
              </p>
              <h3>How program gifts work</h3>
              <p>
                Programs list a suggested amount so everyone can see what an offering takes to
                sustain. You give what you can. Half of every program gift goes to the Teaching Fund
                and half to RIM. A few offerings, such as overnight retreats, carry a minimum because
                RIM pays the places that host us.
              </p>
            </div>

            <div className="pp-actions pp-actions--center">
              <a href="#how-much" className="pp-btn">
                Need help determining an amount to give?
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── How much to give ──────────────────────────────── */}
      <section id="how-much" className="pp-section pp-section--white pp-section--airiest">
        <div className="rim-container">
          <div className="pp-timeline-intro">
            <h2 className="pp-intro__title">How much should I give?</h2>
            <div className="pp-timeline-intro__note">
              <p>Dana is personal, and nobody will tell you an amount. A few reflections can help.</p>
            </div>
          </div>

          <div className="pp-timeline">
            {CONTEMPLATIONS.map((item, i) => {
              // The live page opens the sequence on the right.
              const onRight = i % 2 === 0;
              const rowClass = [
                "pp-timeline__row",
                i === 0 ? "pp-timeline__row--first" : "",
                i === CONTEMPLATIONS.length - 1 ? "pp-timeline__row--last" : "",
              ]
                .filter(Boolean)
                .join(" ");

              const card = (
                <div className="pp-timeline__card">
                  <p className="pp-timeline__eyebrow">Reflection {item.num}</p>
                  <h3 className="pp-timeline__title">{item.title}</h3>
                  <p className="pp-timeline__body">{item.body}</p>
                </div>
              );

              return (
                <div key={item.num} className={rowClass}>
                  {onRight ? <div className="pp-timeline__gap" aria-hidden="true" /> : card}
                  <div className="pp-timeline__spine" aria-hidden="true">
                    <span className="pp-timeline__node" />
                  </div>
                  {onRight ? card : <div className="pp-timeline__gap" aria-hidden="true" />}
                </div>
              );
            })}
          </div>

          <div className="pp-actions pp-actions--center">
            <p className="pp-intro__note">
              RIM is a 501(c)(3) nonprofit. Questions about giving? Email{" "}
              <a href="mailto:support@rootedinmindfulness.org?subject=Donating%20to%20RIM">
                support@rootedinmindfulness.org
              </a>{" "}
              or call <a href="tel:4148828932">(414) 882-8932</a>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
