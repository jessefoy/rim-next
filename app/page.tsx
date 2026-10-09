import Link from "next/link";
import CareCircle from "@/components/CareCircle";

// Lineage terms live in the description for search, stated as RIM states
// them (Jesse, 2026-10-02): a dharma community grounded in traditional
// Buddhist wisdom, not an insight / vipassana center. The page body names
// the Handful and the Buddhist teachings; silent illumination is said on
// Our Roots and About (cut from home by Jesse, 2026-10-08).
export const metadata = {
  title: "Rooted In Mindfulness - Meditation Center - Brookfield - Greater Milwaukee",
  description:
    "Rooted in Mindfulness is a meditation and dharma community in Brookfield, Wisconsin, near Milwaukee, grounded in traditional Buddhist wisdom and open to everyone. Meditation, mindful living, and Buddhist teachings, in person and online, community-supported. Come as you are.",
};

// The page is static. The three program cards name what each way contains
// (its kinds), not the scheduled programs, so nothing here reads the
// database (2026-10-08, later; the live-names version lasted one afternoon,
// see RIM_Public_Pages.md, "The home page in Jesse's words").

/**
 * The home page states RIM's center first. A visitor meets, in order: hero →
 * what brings us together → practice for real life → our practice (CARE) →
 * deep roots → our programs, and where to begin → taking part in something
 * larger → dana → the call. Safety first, stakes late: the shared intention
 * and the many reasons people come open the page; "It matters how we live"
 * closes it.
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/04-community-homepage-revision-2026-09-28.md
 * (Part One, revised 2026-10-08 from Jesse's own reading of the live page,
 * with his rulings in that file's log). Change the words there first, then
 * here. Provisional until he reads the published page. Teacher-side authority
 * for the center: 1 Model/01-framework-what-rim-is.md (Appendix A carries his
 * 2026-10-08 words).
 *
 * Layout (Addendum E, the Claude Design handoff of 2026-09-28): every section
 * sits on the strategic grid's two text edges, col 1 and col 7. Headings take
 * cols 1-6 and text cols 7-12; images stagger (CARE circle left, trees right,
 * lotus left) and follow their text when stacked. One size per heading tag.
 * Grounds alternate ground / white from the statement on. See
 * RIM_Public_Pages.md, "The strategic grid".
 */

// What the practice helps us meet, told as particulars, in three groups
// whose order carries meaning: from what a reader feels first to what opens
// later (the 2026-09-28 home draft, H3; Addendum C1 of the brief). The eye
// ends on A deeper freedom, at the bottom of the third panel. The words are
// Jesse's reading of 2026-10-08.
const PRACTICE_GROUPS = [
  {
    label: "Daily life",
    items: [
      {
        title: "Calm and ease in body, heart, and mind",
        body: "Sometimes things are difficult. Rest helps us heal and restore ourselves. Meeting illness, pain, and grief with more calm, and with the support of meditation and community, is a medicine in itself, one we often do not take. And we still care for ourselves with every other kind of support we need, from friends, doctors, and counselors.",
      },
      {
        title: "Enjoying the life we have",
        body: "There is so much beauty and goodness in our life, and so much to appreciate in the simple things we often overlook: a meal we actually taste, the company of those we care about, the pleasures of a beautiful day. Awe and gratitude are possible in the moments that make up a life. We can meet them without grasping or getting caught up, and live with greater steadiness and joy, even among what distracts us.",
      },
      {
        title: "The pressures of life and work",
        body: "Sometimes life is full: a busy to-do list, time pressures, responsibilities at work and at home, money worries, someone who needs our care. Meditation and mindful living help us meet these moments with greater ease and composure, to give one thing our attention, without losing ourselves, and sometimes to recognize when we are doing too much.",
      },
    ],
  },
  {
    label: "Who we are and how we live",
    items: [
      {
        title: "Knowing ourselves",
        body: "We have been cultivating ourselves, and being cultivated, our whole lives. When we meet a moment, we are not always aware of the views and reactions we carry into it. We can come to know an old reaction while it is happening, and hold it with more understanding and care, including the habits we reach for when we are tired or hurting. We can see how we are viewing things, and as we learn the patterns of our heart and mind, we also learn that we are not bound by them. We discover more choice in how to respond rather than react. Views and judgments are held a little more lightly, and we are more able to meet ourselves and our life with understanding.",
      },
      {
        title: "The people in our lives",
        body: "Being more available to those we care about. Even when we disagree or are in difficulty, we can better understand our part in it, and recognize when there is a chance to repair what has been broken, or when a boundary is needed. We can deepen our friendships and our love for one another, and live in the company of others in ways that benefit them as well as ourselves. For many of us, that company becomes a place to belong.",
      },
      {
        title: "Living by what matters",
        body: "A clearer sense of what gives our lives meaning and purpose, and more of our moments lived in line with it. Our words and actions bring less regret: they cause less harm and more benefit. We care for what supports well-being and protect what is wholesome, in ourselves, for others, and for the world.",
      },
    ],
  },
  {
    label: "Beyond ourselves",
    items: [
      {
        title: "Steady in unsettled times",
        body: "Many people feel shaken, confused, and even helpless by the state of the world. Practice gives us greater steadiness, a clearer sense of the world, and a clearer sense of what is ours to do, instead of being lost in confusion, anxiety, and helplessness. And in the company of others we can engage and grow, where helplessness might have seemed the only option.",
      },
      {
        title: "Our shared world",
        body: "Care that reaches past ourselves and our own circle: taking part in what makes our community healthier, and looking after the living world we are part of.",
      },
      {
        title: "A deeper freedom",
        body: "For some, practice opens into a spiritual urgency, and onto a path of awakening. As what clouds our ability to see clearly and feel deeply begins to clear, we come to know a clarity and warmth that do not depend on circumstances, and we come to live from that place as an authentic way of being.",
      },
    ],
  },
] as const;

// The eight words as the handout pairs them, one row per letter of CARE. Read
// aloud, each row is its two words; the bold letter is visual (it spells CARE,
// which the text beside the list says in words).
const CARE_PAIRS = [
  ["C", "Calm", "Connect"],
  ["A", "Aware", "Attitude"],
  ["R", "Recognize", "Remember"],
  ["E", "Embody", "Engage"],
] as const;

export default function HomePage() {
  // The three ways RIM's programs are offered, each card naming what the way
  // contains (Jesse, 2026-10-08, later: a visitor must know what kinds of
  // programs RIM has; the scheduled programs live on Programs & Events and
  // This Week). The kinds are stable, so the page stays static.
  const WAYS = [
    {
      title: "Foundations",
      body: "Our introduction to Taking CARE, our way of practice. We encourage everyone to begin here.",
      href: "/foundations",
      kinds: ["Course or workshop", "Self-paced online, in time"],
    },
    {
      title: "Ongoing Learning & Practice",
      body: "The heart of our shared practice, week after week. Any of our drop-ins makes a welcoming first visit.",
      href: "/community-programs#ongoing-learning-and-practice",
      kinds: ["Drop-ins, teacher-led", "Silent meditation, hosted by volunteers", "Community groups"],
    },
    {
      title: "Immersion",
      body: "Time to go deeper into particular aspects of practice and learning.",
      href: "/community-programs#immersion",
      kinds: ["Workshops", "Courses", "Days of mindfulness", "Retreats"],
    },
  ];

  return (
    <div className="pp-page pp-page--spine home-page">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section
        className="pp-hero pp-hero--video"
        style={{
          // Also the reduced-motion fallback: when the video is hidden the
          // poster still carries the hero instead of a flat colour band.
          ["--pp-hero-image" as string]: "url('/videos/Bodhi_Leaves-poster-00001.jpg')",
        }}
      >
        <div className="pp-hero__video" aria-hidden="true">
          <video
            autoPlay
            loop
            muted
            playsInline
            poster="/videos/Bodhi_Leaves-poster-00001.jpg"
          >
            {/* MP4 (H.264) first, deliberately: both files decode clean
                frame-by-frame, but intermittent "dancing blocks" were
                appearing during WebM playback — flaky VP9 hardware decode
                (notably Safari). H.264 decode is dependable everywhere;
                browsers take the first source they support. */}
            <source src="/videos/Bodhi_Leaves-transcode.mp4" type="video/mp4" />
            <source src="/videos/Bodhi_Leaves-transcode.webm" type="video/webm" />
          </video>
        </div>
        <div className="rim-container pp-hero__inner">
          {/* Jesse's headline, kept verbatim (session 177 ruling, reaffirmed
              2026-09-25: "I do like the header"). */}
          <h1 className="pp-hero__title">
            Awaken your <span className="home-hero__gold">Mind</span>
            <br />
            Open your <span className="home-hero__gold">Heart</span>
            <br />
            Nourish your <span className="home-hero__gold">Life</span>
            <br />
            Beautify the <span className="home-hero__gold">World</span>
          </h1>
          {/* The handout's practice sentence, verbatim (ratified 2026-09-26;
              Jesse kept it on 2026-10-08 over his spoken "the world we share"). */}
          <p className="pp-hero__body">
            Our practice is taking care: of ourselves, of those we love, of the world, and of this
            moment.
          </p>
          <p className="pp-hero__body">
            Rooted in Mindfulness is a community mindfulness and meditation center in Brookfield,
            Wisconsin, serving the Greater Milwaukee area and beyond through in-person and online
            programs. It is a place where people come to learn how to be more awake and present to
            their lives, and to live in ways that are freer of the patterns of heart, mind, and
            action that can cause difficulty and even suffering.
          </p>
          <p className="pp-hero__body">
            We practice to understand and live with greater wisdom and compassion, and to act from
            both. This allows us to heal what needs to be healed, and to cultivate and protect what
            is healthy and wholesome.
          </p>
          <p className="pp-hero__body">Everyone is welcome. Please, come as you are.</p>
          <div className="pp-hero__actions">
            <Link href="/new-to-rim" className="pp-btn pp-btn--onblue">
              New to RIM?
            </Link>
            <Link href="/community-programs" className="pp-btn pp-btn--onblue-ghost">
              Programs &amp; events
            </Link>
          </div>
        </div>
      </section>

      {/* ── What brings us together — the shared intention at the front door,
             so the wide welcome has a clear center (site revision brief,
             2026-09-25; replaces "What we are here for"). Open prose on the
             ground: nothing competes with it. ── */}
      <section className="pp-section">
        <div className="rim-container">
          <div className="home-chapter home-statement">
            <div className="home-chapter__head">
              <h2 className="pp-intro__title">What brings us together.</h2>
            </div>
            <div className="home-chapter__body">
              <p className="home-lead">
                People come to RIM for all kinds of reasons: to enjoy life more fully, to find more
                strength in a difficult time, to live with greater meaning and purpose, to care for
                and cultivate healthier relationships, to know greater peace and well-being, and
                many others.
              </p>
              <p className="pp-intro__body">
                As diverse as these reasons are, they are rooted in a common intention: to meet our
                life with greater authenticity and basic human goodness, and to realize the wakeful
                nature already within each and every one of us. We find it whenever we notice what
                the mind is doing and are no longer only caught in it, and whenever care for someone
                arises without being asked. We practice to live from this more often. This means
                learning to recognize what gets in the way and cultivating the understanding that
                allows us to respond from this place.
              </p>
              <p className="pp-intro__body">
                At RIM, meditation, teachings, and community are all part of one practice. We gather
                for learning, practice, and fellowship, and the community is here to support one
                another. We do this by practicing together and by being part of something larger
                than ourselves. Everyone takes part in their own way. Some share readily, and some
                prefer to sit and listen, and both belong.
              </p>
              <p className="pp-intro__body">
                Showing up to practice alongside others is already a support, for ourselves and for
                others. People with different backgrounds and experiences come to learn and practice
                together. They bring their own lives and their differences with them, and anyone who
                comes belongs here, from every walk of life. Our similarities and our differences let
                us grow stronger together. No one can do this practice for us, but no one has to do
                it alone.
              </p>
              <div className="pp-actions">
                <Link href="/why-we-practice" className="pp-btn">
                  Why we practice
                </Link>
                <Link href="/diversity" className="pp-btn pp-btn--ghost">
                  Diverse Together
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Practice for real life — what the practice helps us meet: the
             opener and the closing line share the chapter grid's text column,
             above and below the nine particulars. The opener now carries what
             practice clears (moved up from the closing section, Jesse,
             2026-10-08).
             (The Buddha-and-lotus photo was tried beside the opener 2026-09-27
             and removed the same day: beside one short paragraph it read as an
             afterthought, Jesse.) ── */}
      <section className="pp-section pp-section--white">
        <div className="rim-container">
          <div className="home-chapter">
            <div className="home-chapter__head">
              <h2 className="pp-intro__title">Practice for real life.</h2>
            </div>
            <div className="home-chapter__body">
              <p className="pp-intro__body">
                Mindfulness and meditation give us time to settle and see our experience more
                clearly. What is actually happening in our mind and body, beneath our habits and
                reactivity? That clarity is where we have a choice. Practice does not remove every
                difficulty from life. It clears away much of what keeps us from seeing clearly: the
                habits, the fears, the fixed views that color how we meet each moment. Seeing more
                clearly, we stop adding to the struggle, and we choose more wisely what we do next.
                The practice is a continuum of formal meditation and mindful living, and it meets
                our life just as it is. In an ordinary week, it might look like this:
              </p>
            </div>
          </div>

          <div className="home-groups">
            {PRACTICE_GROUPS.map((group) => (
              <div key={group.label} className="home-group">
                <h3 className="home-group__label">{group.label}</h3>
                <ul className="home-group__items">
                  {group.items.map((use) => (
                    <li key={use.title} className="home-group__item">
                      <h4 className="home-group__title">{use.title}</h4>
                      <p className="home-group__body">{use.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="home-chapter home-chapter--after">
            <div className="home-chapter__body">
              <p className="pp-intro__body">
                This is a whole-life practice, rooted in mindfulness. RIM is where we gather to
                practice and learn together, and the rest happens between our gatherings, in
                everyday life. A few minutes of meditation most mornings, sometimes with the support
                of community, can prepare us for a day with greater clarity and peace. We apply what
                we have learned in the events that make up our life, with the people who are part of
                it and the people we meet. We bring all of this back to the community of learning
                and practice, the difficulties and the things that are going well, and then we go
                home and practice again.
              </p>
              <div className="pp-actions">
                <Link href="/why-we-practice#how-practice-benefits" className="pp-btn pp-btn--ghost">
                  How practice benefits our lives
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Our practice is taking care: the intro on the two edges, then the
             handout's CARE circle beside the eight words (Addendum E, option
             2a: every word kept), then the paragraphs and the button. The
             circle is RIM's own artwork (Jesse, 2026-09-27). Option 2c, which
             drops the word list, waits on content sign-off. ── */}
      <section className="pp-section">
        <div className="rim-container">
          <div className="home-chapter">
            <div className="home-chapter__head">
              <p className="pp-intro__eyebrow">Our practice</p>
              <h2 className="pp-intro__title">Our practice is taking care.</h2>
            </div>
            <div className="home-chapter__body">
              <p className="pp-intro__body">
                Taking CARE is our mindfulness-based approach to meditation and mindful living, true
                to the traditional teachings that arise out of Buddhist practice and wisdom. It is
                the framework that holds our practice, present in everything we offer, and it is
                also a program anyone can take part in.
              </p>
              <p className="pp-intro__body">
                Eight words describe this practice. They share four letters, which spell CARE:
              </p>
            </div>
          </div>

          <div className="home-care">
            <figure className="home-care-figure">
              <CareCircle />
            </figure>
            <ul className="home-care-words">
              {CARE_PAIRS.map(([letter, first, second]) => (
                <li key={letter}>
                  <strong className="home-care-words__letter" aria-hidden="true">
                    {letter}
                  </strong>
                  <span>
                    {first}, {second}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="home-chapter home-chapter--after">
            <div className="home-chapter__body">
              <p className="pp-intro__body">
                As simple as these eight words are, they are infinitely deep. In four letters they
                hold a complete practice. They co-arise together. They are not steps to complete;
                they are how we meet each moment. We separate them so that we can explore each one
                in ourselves, in relationship to others, and in the vast web of causes and
                conditions we are part of. The three rings of the circle call these Self, Others,
                and Interbeing.
              </p>
              <p className="pp-intro__body">
                Taking CARE is simple enough to begin with today, and there is enough in it for a
                lifetime of practice.
              </p>
              <div className="pp-actions">
                <Link href="/care" className="pp-btn">
                  Taking CARE: the eight words
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Deep roots — image right (doors, image, doors, image alternate L/R/L/R).
             The Handful and the Buddhist teachings, named plainly; the
             silent-illumination paragraph was cut from home by Jesse on
             2026-10-08 and stays on Our Roots and About. ── */}
      <section className="pp-section pp-section--white">
        <div className="rim-container">
          <div className="pp-split pp-split--flip">
            <div
              className="pp-split__media"
              style={{
                ["--pp-split-image" as string]:
                  // Casey Horner, Unsplash License (unsplash.com/photos/4rDCa5hBlCs),
                  // re-sourced 2026-09-28: the old 534px file was soft at 4:7.
                  "url('/images/Looking-Up-Pine-Trees-unsplash-1000.webp')",
                ["--pp-split-position" as string]: "center bottom",
              }}
              aria-hidden="true"
            />
            <div className="pp-split__body">
              <div className="pp-intro">
                <p className="pp-intro__eyebrow">Where this comes from</p>
                <h2 className="pp-intro__title">Deep roots. An open door.</h2>
                <p className="pp-intro__body">
                  We draw on the breadth of Buddhist teachings and practices, gathered and organized
                  as <Link href="/handful-of-leaves">A Handful of Leaves</Link>. We teach plainly,
                  through practice and inquiry. Mindfulness-based programs, psychology, and modern
                  science also inform how we learn and practice.
                </p>
                <p className="pp-intro__body">
                  You do not need to be Buddhist or hold any religious beliefs to practice here.
                  Secular and spiritual seekers sit side by side. Some come for a steadier way
                  through stress, or for meditation in company. Others want to study the Dharma, the
                  Buddhist teachings, and pursue the path in depth. Our roots give the practice
                  depth, but they do not determine who belongs here.
                </p>
              </div>

              <div className="pp-actions">
                <Link href="/our-roots" className="pp-btn">
                  Our roots
                </Link>
                <Link href="/about" className="pp-btn pp-btn--ghost">
                  About RIM
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Our programs, and where to begin — the three ways RIM's programs
             are offered (Foundations · Ongoing Learning & Practice ·
             Immersion), each card naming what the way contains, so a visitor
             learns the kinds of programs in a glance (Jesse, 2026-10-08,
             later, after the critique: the live-names rows "blended into the
             rest of the site" and were busy). One sentence in, the three
             cards, one sentence on membership, the buttons: the programs
             page first, then this week's schedule for a time. ── */}
      <section className="pp-section">
        <div className="rim-container">
          <div className="home-chapter">
            <div className="home-chapter__head">
              <p className="pp-intro__eyebrow">Programs</p>
              <h2 className="pp-intro__title">Our programs, and where to begin.</h2>
            </div>
            <div className="home-chapter__body">
              <p className="pp-intro__body">
                RIM&rsquo;s programs are offered in three ways. No experience is needed for any of
                them, and every gathering is open to you.
              </p>
            </div>
          </div>

          <div className="home-paths">
            {/* The title is the link and its ::after covers the card, so the
                whole card is clickable while the link's accessible name stays
                the way's title. */}
            {WAYS.map((way) => (
              <div key={way.title} className="pp-card home-paths__card">
                <h3 className="pp-card__title">
                  <Link href={way.href} className="home-paths__link">
                    {way.title}
                  </Link>
                </h3>
                <p className="pp-card__body">{way.body}</p>
                <ul className="home-paths__list">
                  {way.kinds.map((kind) => (
                    <li key={kind}>{kind}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="home-chapter home-chapter--after">
            <div className="home-chapter__body">
              <p className="pp-intro__body">
                Everyone who practices with us holds our{" "}
                <Link href="/community-care-agreements">Community Care Agreements</Link> and signs
                up as a member. Membership is freely offered and takes a few minutes.
              </p>
              <div className="pp-actions">
                <Link href="/community-programs" className="pp-btn">
                  Programs &amp; events
                </Link>
                <Link href="/this-week" className="pp-btn pp-btn--ghost">
                  This week&rsquo;s schedule
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Taking part in something larger — getting involved, then the
             outreach face (2026-09-28; replaces "Taking CARE, carried into the
             world."). Volunteering moved here from Dana. ── */}
      <section className="pp-section pp-section--white">
        <div className="rim-container">
          <div className="home-chapter">
            <div className="home-chapter__head">
              <p className="pp-intro__eyebrow">Get involved</p>
              <h2 className="pp-intro__title">Taking part in something larger.</h2>
            </div>
            <div className="home-chapter__body">
              <p className="pp-intro__body">
                RIM is co-created by the people who practice here. Volunteers host some of our
                gatherings, care for the center, and serve on our teams, and members start
                community groups to support themselves and others. Some take the path of training
                to share the practice: facilitating practice sessions, drop-ins, and programs here
                at RIM, and offering the Taking CARE program at RIM and beyond.
              </p>
              <p className="pp-intro__body">
                Caring for the center and sharing the teachings are themselves forms of generosity.
                Each is a way of caring for others and for our shared world, and a way of practicing
                too.
              </p>
              <p className="pp-intro__body">
                We also carry the practice outward. RIM is part of a larger community. We partner
                with other nonprofits and community organizations working for the well-being of
                people, communities, and our shared world, and through the Taking CARE program we
                offer mindfulness-based training to the people they serve and to the people who
                carry their work.
              </p>
              <div className="pp-actions">
                <Link href="/volunteerism/volunteer" className="pp-btn">
                  Volunteering
                </Link>
                <Link href="/outreach" className="pp-btn pp-btn--ghost">
                  Outreach for organizations
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Dana — image left (the page's images stagger: circle left, trees
             right, lotus left; Jesse 2026-09-27). The held lotus (Olga Nayda, Unsplash): an
             offered flower is the dana gesture itself. Stated as dana actually
             works at RIM (Jesse, 2026-09-25): suggested amounts, no one turned
             away, minimums only where RIM pays a host, program gifts split
             with the Teaching Fund. ── */}
      <section className="pp-section">
        <div className="rim-container">
          <div className="pp-split">
            <div
              className="pp-split__media"
              style={{
                ["--pp-split-image" as string]: "url('/images/lotus-held-unsplash-1600.webp')",
                ["--pp-split-position" as string]: "center 40%",
              }}
              aria-hidden="true"
            />
            <div className="pp-split__body">
              <div className="pp-intro">
                <p className="pp-intro__eyebrow">Dana</p>
                <h2 className="pp-intro__title">A generosity-based approach.</h2>
                <p className="pp-intro__body">
                  Everything offered at RIM is given as a gift, and RIM is sustained by the people
                  who learn and practice here. That support includes financial gifts, and RIM could
                  not exist without them. RIM pays for our center and the costs of running it, and
                  our teachers&rsquo; livelihood depends on dana as well.
                </p>
                <p className="pp-intro__body">
                  Most of RIM&rsquo;s support comes from the members who give each month. If you are
                  able, we strongly encourage you to care for RIM with a financial gift, monthly or
                  when you take part in a program. Programs list a suggested contribution so
                  everyone can see what an offering takes to sustain. For most programs, each person
                  gives what they can, and no one is turned away for not being able to pay. A few
                  offerings, such as overnight retreats, require a minimum contribution to cover the
                  charges from the place that hosts us.
                </p>
                <p className="pp-intro__body">
                  The tradition calls this <em>dana</em>, generosity of heart. Time, care, and
                  sincere presence are gifts too, offered alongside financial support, and so is the
                  practice itself. All of these matter. Dana is an old practice living in a modern
                  economy, and we try to be clear about both: what you receive here was given by
                  someone, and what you give helps keep the door open for the next person.
                </p>
                <p className="pp-intro__body">
                  We understand this is a somewhat radical approach, and it is a beautiful one: RIM
                  and its community are supported by the generosity and goodwill of everyone who
                  takes part.
                </p>
                <p className="pp-intro__note">RIM is a 501(c)(3) nonprofit.</p>
              </div>

              <div className="pp-actions">
                <Link href="/donate" className="pp-btn">
                  Ways to give
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── The call, last: stakes after safety. A plain chapter on white with
             a lead paragraph, like the statement that opens the page (Addendum
             E: the recessed closing panel retired). Shortened 2026-10-08: what
             practice clears now opens Practice for real life; the stakes and
             the invitation stay here, so the page does not end on Dana. ── */}
      <section className="pp-section pp-section--white pp-section--last">
        <div className="rim-container">
          <div className="home-chapter">
            <div className="home-chapter__head">
              <h2 className="pp-intro__title">It matters how we live.</h2>
            </div>
            <div className="home-chapter__body">
              <p className="home-lead">
                This life is precious, and how we live matters, and so do the people in it and the
                world we share.
              </p>
              <p className="pp-intro__body">
                With patience, we come to understand what causes suffering and what supports
                well-being, and we learn to act in line with that understanding. Over time, our care
                reaches a little further than it did before, into the depths of our own being and
                out into our lives.
              </p>
              <p className="pp-intro__body">
                Everyone can begin here. Continuing asks for a willingness to learn, and to return
                when the practice becomes difficult. It is easier to keep going with the support of
                good company.
              </p>
              <div className="pp-actions">
                <Link href="/community-programs" className="pp-btn">
                  Programs &amp; events
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
