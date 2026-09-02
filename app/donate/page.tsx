import Script from "next/script";

export const metadata = {
  title: "Donate — Rooted In Mindfulness",
  description:
    "RIM is 100% community funded. Give to RIM Dana for the center's operating costs, or Teacher Dana to support teacher livelihood.",
};

/** The dana contemplations. Emphasis inside each is the reflective question. */
const CONTEMPLATIONS = [
  {
    num: 1,
    title: "Be mindful of your financial needs.",
    body: (
      <>
        Avoid giving in ways that bring unnecessary financial hardship to yourself and those who may
        depend on you. Generosity brings benefit to the giver and the receiver.{" "}
        <em>Your presence is priceless and no person is turned away for financial reasons.</em>
      </>
    ),
  },
  {
    num: 2,
    title: "Dana is an integral part of traditional practice.",
    body: (
      <>
        The practice of generosity challenges us to let go of attachment patterns and self-clinging,
        helps us appreciate our interconnectedness, and is an expression of kindness and compassion
        toward others.{" "}
        <em>
          When deciding how much to give, consider giving in a way that opens your heart and feels
          truly generous.
        </em>
      </>
    ),
  },
  {
    num: 3,
    title: "RIM is a living expression of generosity and is 100% community funded.",
    body: (
      <>
        Donations pay for the real operational obligations all organizations have, such as the
        center&rsquo;s rent, utilities, supplies, materials, legal and operating fees, technology
        expenses related to in-person and virtual offerings, community support, outreach programs,
        and so much more.{" "}
        <em>
          Consider the significance of RIM. How do the teachings, practices, and community benefit
          your life, the lives of others, and the world?
        </em>
      </>
    ),
  },
  {
    num: 4,
    title: "Teacher livelihood is supported only through voluntary donations.",
    body: (
      <>
        RIM Teachers receive no payment or compensation from RIM for offering classes, workshops,
        drop-ins, retreats, or any other offerings to the RIM community. Teachers have the same human
        needs for livelihood, safety, and support as everyone else.{" "}
        <em>
          Consider the value of full-time teachers, who are safe and supported enough to share the
          teachings freely, with skill, understanding, and care, for all who may benefit.
        </em>
      </>
    ),
  },
  {
    num: 5,
    title: "Dana is an altruistic practice that benefits yourself, others, and the world.",
    body: (
      <>
        When you offer Dana at RIM, you join other kind and generous members of the community who
        help ensure that RIM exists as a safe and supportive refuge for all who may benefit, even
        when times are financially difficult. Your gift reaches past you. It helps hold the door open
        for people you will never meet.{" "}
        <em>
          Consider the impact of making the teachings, practices, and community support available to
          everyone.
        </em>
      </>
    ),
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
                Your support makes a meaningful difference.
              </h1>
              <a href="#dana-at-rim" className="pp-btn pp-btn--onblue">
                Learn more about dana ↓
              </a>
            </div>

            <div className="pp-give">
              {/* RIM Dana */}
              <div className="pp-give__card" id="rim-dana">
                <h2 className="pp-give__title">Donate to RIM</h2>
                <p className="pp-give__name">&ldquo;RIM Dana&rdquo;</p>
                <p className="pp-give__body">
                  RIM is a community refuge for learning and practicing meditation and mindful
                  living. Your caring donation makes it possible for RIM to pay its everyday
                  operational costs.
                </p>

                <details className="pp-details">
                  <summary className="pp-details__summary">More about RIM Dana</summary>
                  <div className="pp-details__body">
                    <p>
                      RIM is co-created through its community&rsquo;s goodwill, appreciation, and
                      generosity. All participants at RIM are encouraged to contribute in a way that
                      feels appropriate for themselves and help co-create a safe and supportive
                      refuge for all who may benefit.
                    </p>
                    <p>
                      RIM is 100% supported by RIM Dana. It pays for the center&rsquo;s many
                      operational obligations, such as rent, utilities, supplies, materials, legal
                      and operating fees, technology expenses related to in-person and virtual
                      offerings, and so much more.
                    </p>
                    <p>
                      <strong>Consider becoming a monthly benefactor.</strong> Sustaining Members
                      make a monthly recurring donation, which helps promote more stability and
                      predictability for the Center.
                    </p>
                    <p>
                      <strong>Important note:</strong> RIM Dana does not provide support for RIM
                      teachers&rsquo; livelihood. If you would like to support teacher livelihood,
                      please consider giving Teacher Dana.
                    </p>
                  </div>
                </details>

                <div className="pp-give__widget">
                  {/* @ts-expect-error custom element */}
                  <givebutter-widget id="gBBMYg"></givebutter-widget>
                </div>

                <a href="#how-much" className="pp-give__help">
                  Need help determining an amount to give?
                </a>
              </div>

              {/* Teacher Dana */}
              <div className="pp-give__card" id="teacher-dana">
                <h2 className="pp-give__title">Donate to a Teacher</h2>
                <p className="pp-give__name">&ldquo;Teacher Dana&rdquo;</p>
                <p className="pp-give__body">
                  RIM teachers offer the teachings freely. Your donations support their livelihood
                  and allow them the safety of dedicating themselves to living and sharing the
                  Dharma.
                </p>

                <details className="pp-details">
                  <summary className="pp-details__summary">More about Teacher Dana</summary>
                  <div className="pp-details__body">
                    <p>
                      RIM teachers are committed to sharing the teachings and practices through the
                      traditional approach of dāna/generosity. By sharing in this way, the teacher
                      protects the integrity of the Dharma, keeps the teachings available to
                      everyone, and fosters space for connection, trust, and mutual care.
                    </p>
                    <p>
                      <strong>RIM Teachers receive no payment or compensation from RIM</strong> for
                      offering classes, workshops, drop-ins, retreats, or any other offerings to the
                      RIM community. Any suggested donation to RIM, including Sustaining Member
                      donations, pay for operational costs.
                    </p>
                    <p>
                      <strong>
                        RIM Teacher&rsquo;s livelihood is supported only through voluntary donations
                        (<em>dāna</em>).
                      </strong>{" "}
                      RIM Teachers have similar financial obligations as everyone else, such as
                      family expenses, tuition repayment, food, utilities, insurance, health care,
                      car payments, ongoing training, retreats, etc. Voluntary Teacher Dana allows
                      them to live and teach, knowing they are safe and supported enough to share the
                      teachings freely.
                    </p>
                    <p>
                      <strong>
                        RIM Teachers elected to dedicate their lives to the practice and the sharing
                        of the Dharma.
                      </strong>{" "}
                      Our teachers receive ongoing intensive training and are deeply committed to
                      living a mindful life.
                    </p>
                  </div>
                </details>

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
            <h2 className="pp-statement__title">
              The practice of generosity (Dana) is at the Heart of all we do at RIM.
            </h2>

            <div className="pp-prose pp-statement__body">
              <p>
                Dana (pronounced &ldquo;DAH-nuh&rdquo;) is a traditional Pali term that translates as
                &ldquo;generosity, gift, alms, donation, etc.&rdquo; Dana is a voluntary offering of
                materials, time, energy, or care to others. Dana is regarded as one of the most
                potent virtues for awakening the best within ourselves while benefiting the world.
              </p>
              <p>
                RIM is co-created through its community&rsquo;s generosity, goodwill, and
                appreciation. RIM is a living expression of generosity, and it is 100% community
                funded and entirely dependent on donations.
              </p>
              <p>
                <strong>
                  Donations pay for all operating costs, contribute to teacher livelihood, and
                  maintain its building.
                </strong>
              </p>
              <p>
                Dana challenges the conventional fee-for-service models, and instead, strengthens our
                intentions to give from a place of mutual understanding and care.{" "}
                <strong>
                  RIM does not charge fees; we ask that all members contribute an amount that feels
                  right to them
                </strong>.
              </p>
              <p>
                It&rsquo;s beautiful to have a refuge that is co-created through the wisdom,
                compassion, and generosity of its community. Thanks for being part of it.
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
            <p className="pp-intro__eyebrow">The Practice Of Financial Dana (Generosity)</p>
            <h2 className="pp-intro__title">How do I decide how much to give?</h2>
            <div className="pp-timeline-intro__note">
              <p>
                Dana (Generosity) practice is deep and personal. It reflects what is alive in your
                heart, life, and the world. Ultimately, the invitation is to give what feels suitable
                for yourself and others rather than through pressure or obligation.
              </p>
              <p>
                The practice of Dana goes against the stream of our modern, transaction-based system
                and it can be challenging to know how much to give. While we can&rsquo;t tell you how
                much to give because Dana is a personal practice, we can offer some mindful
                contemplations to help you get started.
              </p>
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
                  <p className="pp-timeline__eyebrow">Contemplation {item.num}</p>
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
        </div>
      </section>
    </div>
  );
}
