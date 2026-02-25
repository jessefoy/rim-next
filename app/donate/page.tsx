import Script from "next/script";
import DonateAccordions from "./DonateAccordions";

export const metadata = { title: "Donate — Rooted In Mindfulness" };

export default function DonatePage() {
  return (
    <>
      <Script
        src="https://widgets.givebutter.com/latest.umd.cjs?acct=GcnXeYilkL4lWnr3&p=other"
        strategy="lazyOnload"
      />

      <div className="donation-categories-section">
        <div className="contain">
          <div className="flex-hor-left-middle">
            <div className="flex-vert-top-left">
              <div className="m-b-50">
                <div className="brush-text">Your support makes a meaningful difference.</div>
              </div>
              <a href="#Dana-at-RIM" className="cta-btn w-button">Learn More About Dana ↓</a>
            </div>
            <div className="div-block-11">

              <div id="Benefactor-Dana-Information" className="did-you-know-div w-clearfix">
                <div className="did-you-know-content-wrap">
                  <h3 className="dana-heading-blue">Donate to RIM</h3>
                  <h4 className="heading-47">&quot;RIM Dana&quot;</h4>
                  <div className="text-block-86">
                    RIM is a community refuge for learning and practicing meditation and mindful living.
                    Your caring donation makes it possible for RIM to pay its everyday operational costs.
                  </div>
                  <DonateAccordions
                    items={[
                      {
                        id: "rim-dana",
                        heading: "More about RIM Dana",
                        content: (
                          <>
                            <p>RIM is co-created through its community&apos;s goodwill, appreciation, and generosity. All participants at RIM are encouraged to contribute in a way that feels appropriate for themselves and help co-create a safe and supportive refuge for all who may benefit.</p>
                            <p>RIM is 100% supported by RIM Dana. It pays for the center&apos;s many operational obligations, such as rent, utilities, supplies, materials, legal and operating fees, technology expenses related to in-person and virtual offerings, and so much more.</p>
                            <div className="text-block-92">Consider Becoming a Monthly Benefactor:</div>
                            <p>Sustaining Members make a monthly recurring donation, which helps promote more stability and predictability for the Center.</p>
                            <p><strong><em>Important Note:</em></strong><em> RIM Dana does not provide support for RIM teachers&apos; livelihood. If you would like to support teacher livelihood, please consider giving Teacher Dana.</em></p>
                          </>
                        ),
                      },
                    ]}
                  />
                  <div className="html-embed-4 w-embed">
                    {/* @ts-expect-error custom element */}
                    <givebutter-widget id="gBBMYg"></givebutter-widget>
                  </div>
                  <a href="#Need-Help-Deciding-How-Much-To-Give" className="link-21">
                    <span className="text-span-23">Need help determining an amount to give?</span>
                  </a>
                </div>
              </div>

              <div id="teacher-dana-Information" className="did-you-know-div w-clearfix">
                <div className="did-you-know-content-wrap">
                  <h3 className="dana-heading-blue">Donate to a Teacher</h3>
                  <h4 className="heading-47">&quot;Teacher Dana&quot;</h4>
                  <div>
                    RIM teachers offer the teachings freely. Your donations support their livelihood and allow
                    them the safety of dedicating themselves to living and sharing the Dharma.
                  </div>
                  <DonateAccordions
                    items={[
                      {
                        id: "teacher-dana",
                        heading: "More about Teacher Dana...",
                        content: (
                          <>
                            <p>RIM teachers are committed to sharing the teachings and practices through the traditional approach of dāna/generosity. By sharing in this way, the teacher protects the integrity of the Dharma, keeps the teachings available to everyone, and fosters space for connection, trust, and mutual care.</p>
                            <p><strong>RIM Teachers receive no payment or compensation from RIM</strong> for offering classes, workshops, drop-ins, retreats, or any other offerings to the RIM community. Any suggested donation to RIM, including Sustaining Member donations, pay for operational costs.</p>
                            <p><strong>RIM Teacher&apos;s livelihood is supported only through voluntary donations (<em>dāna</em>).</strong> RIM Teachers have similar financial obligations as everyone else, such as family expenses, tuition repayment, food, utilities, insurance, health care, car payments, family expenses, ongoing training, retreats, etc. Voluntary Teacher Dana allows them to live and teach, knowing they are safe and supported enough to share the teachings freely.</p>
                            <p><strong>RIM Teachers elected to dedicate their lives to the practice and the sharing of the Dharma.</strong> Our teachers receive ongoing intensive training and are deeply committed to living a mindful life.</p>
                          </>
                        ),
                      },
                    ]}
                  />
                  <div className="html-embed-4 w-embed">
                    {/* @ts-expect-error custom element */}
                    <givebutter-widget id="pnbnmp"></givebutter-widget>
                  </div>
                  <div className="html-embed-4 w-embed">
                    {/* @ts-expect-error custom element */}
                    <givebutter-widget id="j2WG2L"></givebutter-widget>
                  </div>
                  <a href="#Need-Help-Deciding-How-Much-To-Give" className="link-21">
                    <span className="text-span-23">Need help determining an amount to give?</span>
                  </a>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <div id="Dana-at-RIM" className="section background-white">
        <div className="content-container">
          <div className="diversity-content-box">
            <h1 className="section-title">
              <strong className="bold-text-31">The practice of generosity (Dana) is at the Heart of all we do at RIM.</strong>
            </h1>
            <p className="section-text-2-copy">
              Dana (pronounced &quot;DAH-nuh&quot;) is a traditional Pali term that translates as &quot;generosity, gift,
              alms, donation, etc.&quot; Dana is a voluntary offering of materials, time, energy, or care to others.
              Dana is regarded as one of the most potent virtues for awakening the best within ourselves while
              benefiting the world.<br /><br />
              RIM is co-created through its community&apos;s generosity, goodwill, and appreciation. RIM is a living
              expression of generosity, and it is 100% community funded and entirely dependent on donations.<br /><br />
              <strong>Donations pay for all operating costs, contribute to teacher livelihood, and maintain its building.</strong>
              <br /><br />
              Dana challenges the conventional fee-for-service models, and instead, strengthens our intentions to give
              from a place of mutual understanding and care. <strong>RIM does not charge any &quot;fees,&quot; instead, we ask
              that all members agree to contribute an amount that feels right to them</strong>.<br /><br />
              It&apos;s beautiful to have a refuge that is co-created through the wisdom, compassion, and generosity
              of its community. Thanks for being part of it.
            </p>
            <a href="#Need-Help-Deciding-How-Much-To-Give" className="button-2 no-top-margin w-button">
              <span className="text-span-23">Need help determining an amount to give?</span>
            </a>
          </div>
        </div>
      </div>

      <div id="Need-Help-Deciding-How-Much-To-Give" className="section-timeline">
        <div className="donation-contemplation-steps">
          <div className="title-wrapper">
            <div className="title-large">The Practice Of Financial Dana (Generosity)</div>
            <h3 className="h3-heading">How do I decide how much to give?</h3>
            <div className="dana-contemplation-content-box-copy blue-bg">
              <p className="white-text align-text-left">
                Dana (Generosity) practice is deep and personal. It reflects what is alive in your heart, life, and
                the world. Ultimately, the invitation is to give what feels suitable for yourself and others rather
                than through pressure or obligation.<br /><br />
                The practice of Dana goes against the stream of our modern, transaction-base system and it can be
                challenging to know how much to give. While we can&apos;t tell you how much to give because Dana is a
                personal practice, we can offer some mindful contemplations to help you get started.
              </p>
            </div>
          </div>

          {[
            {
              num: 1,
              title: "Be mindful of your financial needs.",
              text: "Avoid giving in ways that bring unnecessary financial hardship to yourself and those who may depend on you. Generosity brings benefit to the giver and the receiver. <strong><em>Your presence is priceless and no person is turned away for financial reasons.</em></strong>",
              lineClass: "milestone-line-bottom",
              side: "right",
            },
            {
              num: 2,
              title: "Dana is an integral part of traditional practice.",
              text: "The practice of generosity challenges us to let go of attachment patterns and self-clinging, helps us appreciate our interconnectedness, and is an expression of kindness and compassion toward others. <strong><em>When deciding how much to give, consider giving in a way that opens your heart and feels truly generous.</em></strong>",
              lineClass: "milestone-line",
              side: "left",
            },
            {
              num: 3,
              title: "RIM is a living expression of generosity and is 100% community funded.",
              text: "Donations pay for the real operational obligations all organizations have, such as the center&apos;s rent, utilities, supplies, materials, legal and operating fees, technology expenses related to in-person and virtual offerings, community support, outreach programs, and so much more. <strong><em>Consider the significance of RIM. How do the teachings, practices, and community benefit your life, the lives of others, and the world?</em></strong>",
              lineClass: "milestone-line",
              side: "right",
            },
            {
              num: 4,
              title: "Teacher livelihood is supported only through voluntary donations.",
              text: "RIM Teachers receive no payment or compensation from RIM for offering classes, workshops, drop-ins, retreats, or any other offerings to the RIM community. Teachers have the same human needs for livelihood, safety, and support as everyone else. <strong><em>Consider the value of full-time teachers, who are safe and supported enough to share the teachings freely, with skill, understanding, and care — for all who may benefit.</em></strong>",
              lineClass: "milestone-line",
              side: "left",
            },
            {
              num: 5,
              title: "Dana is an altruistic practice that benefits yourself, others, and the world.",
              text: "When you offer Dana at RIM, you join other kind and generous members of the community who help ensure that RIM exists as a safe and supportive refuge for all who may benefit — even when times are financially difficult. You are not only benefiting yourself, you are also helping others who need support. <strong><em>Consider the impact of making the teachings, practices, and community support available to everyone.</em></strong>",
              lineClass: "milestone-line-top",
              side: "right",
            },
          ].map((item) => (
            <div key={item.num} className="w-layout-grid timeline-row">
              {item.side === "left" && <div className="block-empty"></div>}
              <div className="milestone-block">
                <div className={item.lineClass}></div>
                <div className="milestone-circle">
                  <div className="milestone-inner-circle"></div>
                </div>
              </div>
              <div className="card-timeline-large">
                <div className="contemplation-header">Contemplation {item.num}</div>
                <h4 className="heading-42">{item.title}</h4>
                <p
                  className="paragraph-standard"
                  dangerouslySetInnerHTML={{ __html: item.text }}
                />
              </div>
              {item.side === "right" && <div className="block-empty"></div>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
