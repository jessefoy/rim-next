import Link from "next/link";
import { db } from "@/lib/db";
import { hasConcludedOneTime } from "@/lib/programUtils";
import CareCircle from "@/components/CareCircle";

// Lineage terms live here for search, stated as RIM states them (Jesse,
// 2026-09-25): a dharma community rooted in Chan silent illumination, not an
// insight / vipassana center.
export const metadata = {
  title: "Rooted In Mindfulness - Meditation Center - Brookfield - Greater Milwaukee",
  description:
    "Rooted in Mindfulness is a meditation and dharma community in Brookfield, Wisconsin, near Milwaukee, rooted in the silent illumination tradition and open to everyone. Meditation, mindful living, and Buddhist teachings, in person and online, community-supported. Come as you are.",
};

export const dynamic = "force-dynamic";

/**
 * The home page states RIM's center first. A visitor meets, in order: hero →
 * what brings us together → practice for real life → our practice (CARE) →
 * deep roots → where to begin → taking part in something larger → dana → the
 * call. Safety first, stakes late: the shared intention and the many reasons
 * people come open the page; "It matters how we live" closes it.
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/04-community-homepage-revision-2026-09-28.md
 * (Part One). Change the words there first, then here. Implemented from the
 * brief 08-promotion-site-brief-home-2026-09-28.md. Provisional until Jesse's
 * read-aloud. Teacher-side authority for the center:
 * 1 Model/01-framework-what-rim-is.md.
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
// ends on A deeper freedom, at the bottom of the third panel.
const PRACTICE_GROUPS = [
  {
    label: "Daily life",
    items: [
      {
        title: "Body, mind, and hard seasons",
        body: "Rest that restores, and a mind that can settle when it needs to. Illness, pain, and grief met with more steadiness, supported by meditation and community, alongside whatever care we need from doctors and counselors.",
      },
      {
        title: "Enjoying the life we have",
        body: "A meal we actually taste. More room for the people and interests we care about. Pleasures enjoyed without needing to hold on to them, and a steadier contentment beneath them.",
      },
      {
        title: "Work and its pressures",
        body: "A full inbox met one message at a time. Enough steadiness in a difficult meeting to listen and speak clearly.",
      },
    ],
  },
  {
    label: "Who we are and how we live",
    items: [
      {
        title: "Knowing ourselves",
        body: "An old reaction seen while it is still happening, and met with curiosity. As we learn how the pattern takes hold, we can discover more choice in what we do next. Views and judgments held a little more lightly.",
      },
      {
        title: "The people in our lives",
        body: "Being more available to those we care about, including when we disagree. Understanding our part in a difficulty, and recognizing when repair or a boundary is needed. Friendship, and the company of others who practice.",
      },
      {
        title: "Living by what matters",
        body: "A clearer sense of what gives our lives meaning, and more of our daily choices in line with it. Words and actions we do not have to regret. Care for what supports well-being and protects what is wholesome, in ourselves and around us.",
      },
    ],
  },
  {
    label: "Beyond ourselves",
    items: [
      {
        title: "Our shared world",
        body: "Care that reaches past our own circle. Taking part in what makes our communities healthier, and looking after the living world we are part of.",
      },
      {
        title: "A deeper freedom",
        body: "For some, practice opens onto a path of awakening. As what clouds our seeing begins to clear, we come to know a clarity and warmth that do not depend on circumstances, and they gradually become the ground we live from.",
      },
    ],
  },
] as const;

// The eight words as the handout pairs them. Read aloud, each row is the two
// words; the middot between them is visual only.
const CARE_PAIRS = [
  ["Calm", "Connect"],
  ["Aware", "Attitude"],
  ["Recognize", "Remember"],
  ["Embody", "Engage"],
] as const;

export default async function HomePage() {
  // Immersion's door leads to the catalog chapter holding retreats or events,
  // found from the live taxonomy by kind rather than a hardcoded slug (the
  // s170 rule: doors come from data). The catalog only renders a chapter that
  // still has a listed program after concluded one-time programs drop out
  // (hideWhenPast), so the same rule picks the chapter here; otherwise the
  // anchor would point at a section that is not on the page. Falls back to the
  // whole catalog.
  const catalogCategories = await db.programCategory.findMany({
    where: {
      kind: { in: ["RETREAT", "EVENT", "DROP_IN", "CLASS"] },
      hideFromProgramsPage: false,
    },
    orderBy: { sortOrder: "asc" },
    select: {
      slug: true,
      kind: true,
      programs: {
        where: { archivedAt: null, hideFromProgramPageList: false },
        select: { startDatetime: true, endDatetime: true, recurrenceFreq: true, hideWhenPast: true },
      },
    },
  });
  const chapterHref = (kinds: string[]) => {
    const chapter = catalogCategories.find(
      (c) =>
        c.kind !== null &&
        kinds.includes(c.kind) &&
        c.programs.some((p) => !(p.hideWhenPast && hasConcludedOneTime(p)))
    );
    return chapter ? `/community-programs#${chapter.slug}` : "/community-programs";
  };
  const immersionHref = chapterHref(["RETREAT", "EVENT"]);
  // Learning & Practice leads to the catalog's drop-ins-and-series chapter
  // (Addendum C2: the programs page first, This Week second), found the same
  // way, never by a hardcoded slug.
  const learningHref = chapterHref(["DROP_IN", "CLASS"]);

  const PATHWAY = [
    {
      title: "Foundations",
      // Foundations will be generated from the Program Manager as a program;
      // until it exists, the door leads to the programs list (Jesse,
      // 2026-09-25). Point it at /programs/<slug> once the program is built.
      // Held in the draft: one line on where to begin before November.
      body: "Finding your footing in meditation and mindful living. This is where we encourage everyone to begin. First offered in November.",
      href: "/community-programs",
    },
    {
      title: "Learning & Practice",
      body: "Drop-in gatherings and series throughout the week, in person and online.",
      href: learningHref,
    },
    {
      title: "Immersion",
      body: "Workshops, practice days, and retreats, with time to settle more fully into the practice.",
      href: immersionHref,
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
          <p className="pp-hero__body">
            Our practice is taking care: of ourselves, of those we love, of the world, and of this
            moment.
          </p>
          <p className="pp-hero__body">
            Rooted in Mindfulness is a community meditation center in Brookfield, Wisconsin,
            serving the Greater Milwaukee area and beyond through in-person and online programs.
          </p>
          <p className="pp-hero__body">
            Together, we learn to be more awake and present in our lives, and freer of the patterns
            of mind and action that cause suffering. We practice to understand with greater wisdom,
            care with kindness and compassion, and act from both, so we can heal what hurts,
            cultivate what is healthy, and protect what matters.
          </p>
          <p className="pp-hero__body">Come as you are.</p>
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
              <h2 className="pp-intro__title">What brings us together</h2>
            </div>
            <div className="home-chapter__body">
              <p className="home-lead">
                People come to RIM for many reasons: a wish to enjoy life more fully, a difficult
                season, curiosity about meditation, or love for someone they want to care for well.
              </p>
              <p className="pp-intro__body">
                What we share is one intention. Something clear and caring is already within each
                of us. We glimpse it whenever we notice what the mind is doing and are no longer
                only caught in it, and whenever care for someone arises without being asked. We
                practice to live from it more often. This means learning to recognize what gets in
                the way and cultivating the understanding that helps us respond differently.
              </p>
              <p className="pp-intro__body">
                At RIM, meditation, teaching, and community are part of one practice. We gather for
                learning, practice, and fellowship, and the community is here to support each
                person&rsquo;s practice. Practicing together also lets us take part in something
                larger than ourselves. Everyone takes part in their own way. Some of us share
                readily and some prefer to sit and listen, and both belong. Showing up to practice
                alongside others is already taking part. People with different backgrounds and
                experience learn together, bringing the questions that arise in their own lives.
                Anyone who shares these intentions belongs here, from every walk of life, and our
                differences make us stronger.
              </p>
              <p className="pp-intro__body">
                No one can do the practice for us, and no one has to do it alone.
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
             above and below the eight particulars.
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
                Meditation gives us time to settle and see our experience clearly: what is actually
                happening in body and mind, beneath our habits of reacting to it. That clarity is
                where choice begins, and the same practice continues through the day. In an
                ordinary week, it might look like this:
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
                Most of this happens between our gatherings. A few minutes of meditation most
                mornings, with guidance and the company of other practitioners, can become a
                practice that lasts. We bring our days back to the community, including the
                difficulties and the things that are going well. Then we go home and practice
                again.
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
                Taking CARE is our approach to meditation and mindful living. It is our root
                practice, present in everything we offer, and it is also a program anyone can take
                part in, beginning with Foundations.
              </p>
              <p className="pp-intro__body">Eight words describe this practice:</p>
            </div>
          </div>

          <div className="home-care">
            <figure className="home-care-figure">
              <CareCircle />
            </figure>
            <ul className="home-care-words">
              {CARE_PAIRS.map(([first, second]) => (
                <li key={first}>
                  <span>{first}</span>
                  <span className="home-care-words__dot" aria-hidden="true">
                    ·
                  </span>
                  <span>{second}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="home-chapter home-chapter--after">
            <div className="home-chapter__body">
              <p className="pp-intro__body">
                The eight words share four letters, which spell CARE. The words mutually arise.
                They are not steps to complete, and any one can offer a way into the practice.
              </p>
              <p className="pp-intro__body">
                Each can be explored within ourselves, in relation to others, and within the vast
                web of causes and conditions we are part of. The three rings of the circle call
                these Self, Other, and Interbeing.
              </p>
              <p className="pp-intro__body">
                The words are simple enough to begin with today. There is enough in them for a
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

      {/* ── Deep roots — image right (doors, image, doors, image alternate L/R/L/R). The lineage as Jesse states it
             (2026-09-25): Chan silent illumination, the whole tradition through
             A Handful of Leaves, informed by mindfulness-based programs and
             science. Named plainly; not the threshold. ── */}
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
                  RIM is a dharma community rooted in traditional Buddhist wisdom. At the heart of
                  our practice is silent illumination: an open, settled awareness that meets what
                  arises with warmth. It comes to us through Chan, the Chinese meditation tradition
                  also known as Zen. The eight words of CARE are practiced in its spirit.
                </p>
                <p className="pp-intro__body">
                  We draw on the breadth of Buddhist teachings, gathered and organized as A Handful
                  of Leaves. We teach plainly, through practice and inquiry. Mindfulness-based
                  programs, psychology, and modern science also inform how we teach.
                </p>
                <p className="pp-intro__body">
                  You do not need to be Buddhist or hold any religious belief to practice here.
                  Secular and spiritual seekers sit side by side. Some come for a steadier way
                  through stress or for meditation and company. Others want to study the Dharma, the
                  Buddha&rsquo;s teachings, and pursue the path in depth.
                </p>
                <p className="pp-intro__body">
                  Our roots give the practice depth. They do not determine who belongs here.
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

      {/* ── Where to begin — the pathway, in Jesse's route names: the three
             ways Taking CARE is offered (Foundations · Learning & Practice ·
             Immersion), each carrying the whole practice. Outreach moved to
             "Taking part in something larger" (2026-09-28).
             Recovery Dharma's lesson: people cohere when they know both why
             they are here and what taking part involves. ── */}
      <section className="pp-section">
        <div className="rim-container">
          <div className="home-chapter">
            <div className="home-chapter__head">
              <p className="pp-intro__eyebrow">Taking part</p>
              <h2 className="pp-intro__title">Where to begin, and where it leads.</h2>
            </div>
            <div className="home-chapter__body">
              <p className="pp-intro__body">
                We practice at home in whatever way our lives allow, and come together to learn and
                practice with others.
              </p>
              <p className="pp-intro__body">
                Taking CARE is offered in three ways, and each one carries the whole practice. No
                previous experience is needed. Until Foundations begins in November, every gathering
                is open to you, and the drop-ins are the easiest way in.{" "}
                <Link href="/programs/meditation-and-dharma-talk">Meditation and Dharma Talk</Link>,
                on Saturday mornings, brings guided practice and a teaching together and makes a
                welcoming first visit. You can explore the options below or visit New to RIM for
                help getting started.
              </p>
              <p className="pp-intro__body">
                We ask the same of everyone who comes: to hold our{" "}
                <Link href="/community-care-agreements">Community Care Agreements</Link>, a few
                simple commitments to care for ourselves, one another, and RIM; to come with a
                sincere wish to practice; and to help keep RIM a safe place for everyone. The
                agreements are intentions we share, and holding them is a practice.
              </p>
              <p className="pp-intro__body">
                Signing up as a member is where each of us agrees to them. Membership is freely
                offered and takes a few minutes. It is required for online gatherings, and we ask
                everyone who practices in person to sign up as well.
              </p>
            </div>
          </div>

          <div className="home-paths">
            {PATHWAY.map((route) => (
              <Link key={route.title} href={route.href} className="pp-card home-paths__card">
                <h3 className="pp-card__title">{route.title}</h3>
                <p className="pp-card__body">{route.body}</p>
              </Link>
            ))}
          </div>

          {/* The buttons follow the three ways in, in content order
              (Addendum E), from col 1. */}
          <div className="pp-actions home-paths-actions">
            <Link href="/community-programs" className="pp-btn">
              Programs &amp; events
            </Link>
            <Link href="/new-to-rim" className="pp-btn pp-btn--ghost">
              New to RIM
            </Link>
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
                RIM is co-created by the people who practice here. Volunteers host our online
                gatherings, care for the center, and serve on our teams, and members start community
                groups of their own. Some take the path of training to share the practice:
                facilitating practice sessions, drop-ins, and programs here at RIM, and offering
                Taking CARE beyond it. Sharing the teachings is itself a form of generosity. Each of
                these is a way of caring for others and for our shared world, and a way of
                practicing too.
              </p>
              <p className="pp-intro__body">
                We also carry the practice outward. We partner with nonprofits and community
                organizations working for the well-being of people, communities, and our shared
                world. Through Taking CARE, we offer mindfulness practice to the people they serve
                and to the people who carry their work.
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
                <h2 className="pp-intro__title">A Generosity-Based Approach</h2>
                <p className="pp-intro__body">
                  The teachings here are given as a gift, and RIM is sustained by the people who
                  practice here. That support includes financial gifts, and RIM could not exist
                  without them. RIM pays rent for our center and supports our teachers&rsquo;
                  livelihood. Most of this comes from members who give each month.
                </p>
                <p className="pp-intro__body">
                  If you are able, we strongly encourage you to care for RIM with a financial gift,
                  monthly or when you take part in a program. Programs list a suggested contribution
                  so everyone can see what an offering takes to sustain. For most programs, each
                  person gives what they can, and no one is turned away for being unable to pay. A
                  few offerings, such as overnight retreats, require a minimum contribution to cover
                  charges from the places that host us.
                </p>
                <p className="pp-intro__body">
                  The tradition calls this <em>dana</em>, generosity of heart. Time, care, and sincere
                  presence are gifts too, offered alongside financial support, and practice itself
                  matters most. Dana is an old practice living in a modern economy, and we try to be
                  clear about both.
                </p>
                <p className="pp-intro__body">
                  What you receive here was given by someone. What you give helps keep the door open
                  for the next person.
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
             E: the recessed closing panel retired). ── */}
      <section className="pp-section pp-section--white pp-section--last">
        <div className="rim-container">
          <div className="home-chapter">
            <div className="home-chapter__head">
              <h2 className="pp-intro__title">It matters how we live.</h2>
            </div>
            <div className="home-chapter__body">
              <p className="home-lead">
                This life matters, and so do the people in it and the world we share.
              </p>
              <p className="pp-intro__body">
                Practice helps us care for them in our daily choices. With patience, we come to
                understand what causes suffering and what supports well-being, and we learn to act
                on that understanding. Practice does not remove every difficulty from a life. It
                clears away much of what keeps us from seeing clearly: the habits, fears, and fixed
                views that color how we meet each moment. Seeing more clearly, we can stop adding
                struggle to what is already hard, and choose more wisely what we do next. Over
                time, our care can reach a little further than it did before.
              </p>
              <p className="pp-intro__body">
                Anyone can begin here. Continuing asks for a willingness to learn and to return
                when practice becomes difficult. It is easier to keep going in good company.
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
