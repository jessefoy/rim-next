import Link from "next/link";
import { db } from "@/lib/db";
import { hasConcludedOneTime } from "@/lib/programUtils";

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
 * The home page states RIM's center first (2026-09-25). A visitor meets, in
 * order: what we are here for → the practice (CARE) → what it looks like in an
 * ordinary week → where it comes from → how to take part → dana → the call.
 * Safety first, stakes late: the ground and the many reasons people come open
 * the page; "It matters how we live" closes it.
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/04-community-website-copy-2026-09-25.md
 * Change the words there first, then here. Provisional until Jesse's
 * read-aloud. Teacher-side authority for the center:
 * 1 Model/01-framework-what-rim-is.md.
 *
 * Grounds alternate: ground, white, ground, white, ground, white, ground.
 * The CARE doors and the pathway doors are white lifted cards, so both sit on
 * the ground; "Practice for real life" is open type on white (its six items
 * are particulars, not destinations).
 */

// The eight lines are the program-description draft's compressions of the
// handout, provisional until Jesse writes his own (his critical path).
const CARE_PAIRS = [
  {
    slug: "calm-and-connect",
    title: "Calm and Connect",
    lines: [
      "Calm is an invitation to ease in body, heart, and mind.",
      "Connect is showing up to this moment as it is, through the senses.",
    ],
  },
  {
    slug: "aware-and-attitude",
    title: "Aware and Attitude",
    lines: [
      "Aware is the clear knowing that is always available.",
      "Attitude is meeting experience with warmth and curiosity.",
    ],
  },
  {
    slug: "recognize-and-remember",
    title: "Recognize and Remember",
    lines: [
      "Recognize is knowing what is here and seeing it honestly.",
      "Remember is reconnecting with our deeper nature and what matters most.",
    ],
  },
  {
    slug: "embody-and-engage",
    title: "Embody and Engage",
    lines: [
      "Embody is making the practice part of who we are.",
      "Engage is caring for ourselves, others, and the world, and acting from that place.",
    ],
  },
] as const;

// What the practice helps us meet, told as particulars (Jesse, 2026-09-25:
// "as a friend, as a truth, as a matter of fact", without dwelling).
const USES = [
  {
    title: "Enjoying the life we have",
    body: "A meal we actually taste. A walk where we see the light on the trees. Days that line up a little more with what we care about, and more room for the people and interests that make a life feel like our own.",
  },
  {
    title: "Work and its pressures",
    body: "A full inbox met one message at a time. A hard meeting where we stay steady enough to listen. A workday we can leave at work.",
  },
  {
    title: "The people we love",
    body: "Being there for a child, a partner, a parent, or a friend, and not only in the same room. A disagreement that does not have to become a fight. A repair made sooner.",
  },
  {
    title: "Knowing ourselves",
    body: "An old reaction seen while it is still happening, and met with curiosity instead of blame. Less time replaying yesterday’s conversation on the drive home.",
  },
  {
    title: "Illness and hard seasons",
    body: "Pain, a diagnosis, grief, anxiety, or depression met with more steadiness and less added struggle, alongside whatever care we need from doctors and counselors.",
  },
  {
    title: "A practice that lasts",
    body: "Sitting that stops feeling like one more thing to do. A few minutes most mornings, kept up for years, with people who keep us company in it.",
  },
] as const;

export default async function HomePage() {
  // Immersion's door leads to the catalog chapter holding retreats or events,
  // found from the live taxonomy by kind rather than a hardcoded slug (the
  // s170 rule: doors come from data). The catalog only renders a chapter that
  // still has a listed program after concluded one-time programs drop out
  // (hideWhenPast), so the same rule picks the chapter here; otherwise the
  // anchor would point at a section that is not on the page. Falls back to the
  // whole catalog.
  const immersionCategories = await db.programCategory.findMany({
    where: { kind: { in: ["RETREAT", "EVENT"] }, hideFromProgramsPage: false },
    orderBy: { sortOrder: "asc" },
    select: {
      slug: true,
      programs: {
        where: { archivedAt: null, hideFromProgramPageList: false },
        select: { startDatetime: true, endDatetime: true, recurrenceFreq: true, hideWhenPast: true },
      },
    },
  });
  const immersion = immersionCategories.find((c) =>
    c.programs.some((p) => !(p.hideWhenPast && hasConcludedOneTime(p)))
  );
  const immersionHref = immersion
    ? `/community-programs#${immersion.slug}`
    : "/community-programs";

  const PATHWAY = [
    {
      title: "Foundations",
      body: "Finding your footing in meditation and mindful living. Where we encourage everyone to begin.",
      href: "/foundations",
    },
    {
      title: "Learning & Practice",
      body: "Drop-in gatherings and series through the week, in person and online.",
      href: "/this-week",
    },
    {
      title: "Immersion",
      body: "Workshops, practice days, and retreats, with time to settle into the whole of practice.",
      href: immersionHref,
    },
    {
      title: "Outreach",
      body: "Bringing this practice to organizations that serve people in need.",
      href: "/outreach",
    },
  ];

  return (
    <div className="pp-page pp-page--spine">
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
            We are a community learning to live awake: less caught in old habits of mind, and more
            able to bring the clarity and care already within us to as many moments of our lives as
            we can. Together, in Brookfield, Wisconsin, and online, we practice to heal, promote,
            and protect well-being in ourselves, one another, and our shared world. Come as you are.
          </p>
          <div className="pp-hero__actions">
            <Link href="/your-first-visit" className="pp-btn pp-btn--onblue">
              Your first visit
            </Link>
            <Link href="/this-week" className="pp-hero__link">
              This week&rsquo;s schedule <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── What we are here for — the center, stated first. Open prose on
             the ground: nothing competes with it. Safety before stakes: the
             ground and the many doors, never the predicament first. ── */}
      <section className="pp-section">
        <div className="rim-container">
          <div className="pp-intro">
            <h2 className="pp-intro__title">What we are here for.</h2>
            <p className="pp-intro__body">
              Something clear and warm is already here in each of us. It shows up in small ways. The
              mind drifts into a worry or a plan, and something in us knows that it drifted. We are
              about to say the sharp thing, and a moment of room opens where a kinder word becomes
              possible. That clarity is not reserved for special people or distant places. Our
              practice is learning to live from it, in the middle of an ordinary day.
            </p>
            <p className="pp-intro__body">
              People come to practice for many reasons. Some want steadier footing in a hard season.
              Some want a practice that finally lasts. Some want to be more present with the people
              they love, or to find more meaning in the life they already have. Some want to walk
              the path of awakening all the way. What we share is care, for our own lives, for the
              people close to us, and for the world, and the discovery that our old ways of chasing
              happiness and bracing against difficulty often work against the very things we care
              about.
            </p>
            <p className="pp-intro__body">
              Practice helps us see what the mind is doing while it is doing it. In that seeing
              there is room: to let an old reaction pass without obeying it, to remember what
              matters, and to answer with more understanding and more care.
            </p>
          </div>
          <div className="pp-actions">
            <Link href="/why-we-practice" className="pp-link">
              Why we practice <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Practice for real life — what the practice helps us meet ── */}
      <section className="pp-section pp-section--white">
        <div className="rim-container">
          <div className="pp-intro">
            <h2 className="pp-intro__title">Practice for real life.</h2>
            <p className="pp-intro__body">
              Meditation is where the practice begins, and most of it happens everywhere else. It
              helps us enjoy what is good while it is here, and meet what is hard with more skill
              and less reactivity. In an ordinary week, it looks something like this.
            </p>
          </div>

          <ul className="pp-uses">
            {USES.map((use) => (
              <li key={use.title} className="pp-uses__item">
                <h3 className="pp-uses__title">{use.title}</h3>
                <p className="pp-uses__body">{use.body}</p>
              </li>
            ))}
          </ul>

          <div className="pp-prose">
            <p>
              Most of this happens between our gatherings, at home, at work, and with the people in
              our lives. We bring the practice into our days, and we bring our days back to the
              community, the difficulties and the successes alike. Then we go home and practice
              again.
            </p>
          </div>

          <div className="pp-actions">
            <Link href="/care" className="pp-btn pp-btn--ghost">
              How we practice
            </Link>
          </div>
        </div>
      </section>

      {/* ── Our practice is taking care — words left, the four pairs right.
             The practice is shown before it is named: the acronym arrives in
             the last line (experience before the name). ── */}
      <section className="pp-section">
        <div className="rim-container">
          <div className="pp-split pp-split--doors pp-split--doors-left">
            <div className="pp-split__body">
              <div className="pp-intro">
                <p className="pp-intro__eyebrow">Our practice</p>
                <h2 className="pp-intro__title">Our practice is taking care.</h2>
                <p className="pp-intro__body">
                  We describe that one practice with eight words in four pairs. They are not steps,
                  and they are not ideas to master. In any moment all eight are present, and any one
                  of them is a way in.
                </p>
                <p className="pp-intro__body">
                  They are simple enough to begin with today, and there is enough in them for a
                  lifetime of practice. Each can be practiced within ourselves, with one another,
                  and in the wider world we are part of. The first letters spell the word. We call
                  it CARE.
                </p>
              </div>

              <div className="pp-actions">
                <Link href="/care" className="pp-btn">
                  Taking Care: the eight words
                </Link>
              </div>
            </div>

            <div className="pp-doors">
              {CARE_PAIRS.map((pair) => (
                <Link
                  key={pair.slug}
                  href={`/care#${pair.slug}`}
                  className="pp-card pp-card--row"
                >
                  <div className="pp-card__row">
                    <div className="pp-card__main">
                      <h3 className="pp-card__title">{pair.title}</h3>
                      {pair.lines.map((line) => (
                        <p key={line} className="pp-card__body">
                          {line}
                        </p>
                      ))}
                    </div>
                    <span className="pp-card__action" aria-hidden="true">
                      →
                    </span>
                  </div>
                </Link>
              ))}
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
                  "url('/images/Looking-Up-Pine-Trees-unsplash.jpg')",
                ["--pp-split-position" as string]: "center bottom",
              }}
              aria-hidden="true"
            />
            <div className="pp-split__body">
              <div className="pp-intro">
                <p className="pp-intro__eyebrow">Where this comes from</p>
                <h2 className="pp-intro__title">Deep roots. An open door.</h2>
                <p className="pp-intro__body">
                  RIM is a dharma community and a Buddhist nonprofit. Our practice is rooted in
                  silent illumination: an open, settled awareness that meets whatever arrives with
                  warmth. It comes to us through Chan, the Chinese meditation school that later
                  became Zen. We draw on the whole Buddhist tradition, gathered and ordered as A
                  Handful of Leaves, and we teach plainly, by experience, without dogma or
                  unnecessary ritual. Mindfulness-based programs, psychology, and modern science
                  inform how we teach.
                </p>
                <p className="pp-intro__body">
                  You do not need to be Buddhist, or to hold any religious belief, to practice here.
                  Secular and spiritual seekers sit side by side. Some come for a steadier way
                  through stress, some for the meditation and the company, and some to study the
                  Dharma, the Buddha&rsquo;s teachings, and walk that path all the way. All of these
                  belong here, and no one is asked to choose a door before coming in.
                </p>
                <p className="pp-intro__body">
                  Our roots give the practice depth. They do not determine who belongs here.
                </p>
              </div>

              <div className="pp-actions">
                <Link href="/about" className="pp-btn pp-btn--ghost">
                  Our story
                </Link>
                <Link href="/what-we-practice" className="pp-link">
                  A Handful of Leaves <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Where to begin — the pathway, in Jesse's route names
             (Foundations · Learning & Practice · Immersion) plus Outreach.
             Recovery Dharma's lesson: people cohere when they know both why
             they are here and what taking part involves. ── */}
      <section className="pp-section">
        <div className="rim-container">
          <div className="pp-split pp-split--doors pp-split--doors-left">
            <div className="pp-split__body">
              <div className="pp-intro">
                <p className="pp-intro__eyebrow">Taking part</p>
                <h2 className="pp-intro__title">Where to begin, and where it leads.</h2>
                <p className="pp-intro__body">
                  Taking part is simple. We practice at home in whatever way a life allows, and we
                  come together to learn and practice with others. Most people move among four ways
                  of gathering, at their own pace. No experience is needed, and nobody will ask you
                  to explain yourself.
                </p>
              </div>

              <div className="pp-actions">
                <Link href="/community-programs" className="pp-btn">
                  All programs
                </Link>
                <Link href="/your-first-visit" className="pp-link">
                  Your first visit <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>

            <div className="pp-doors">
              {PATHWAY.map((route) => (
                <Link key={route.title} href={route.href} className="pp-card pp-card--row">
                  <div className="pp-card__row">
                    <div className="pp-card__main">
                      <h3 className="pp-card__title">{route.title}</h3>
                      <p className="pp-card__body">{route.body}</p>
                    </div>
                    <span className="pp-card__action" aria-hidden="true">
                      →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Dana — image right. The held lotus (Olga Nayda, Unsplash): an
             offered flower is the dana gesture itself. Stated as dana actually
             works at RIM (Jesse, 2026-09-25): suggested amounts, no one turned
             away, minimums only where RIM pays a host, program gifts split
             with the Teaching Fund. ── */}
      <section className="pp-section pp-section--white">
        <div className="rim-container">
          <div className="pp-split pp-split--flip">
            <div
              className="pp-split__media"
              style={{
                ["--pp-split-image" as string]: "url('/images/lotus-held-unsplash-1600.webp')",
                ["--pp-split-position" as string]: "center 42%",
              }}
              aria-hidden="true"
            />
            <div className="pp-split__body">
              <div className="pp-intro">
                <p className="pp-intro__eyebrow">Dana</p>
                <h2 className="pp-intro__title">A Generosity-Based Approach</h2>
                <p className="pp-intro__body">
                  The teachings here are given as a gift, and the people who practice here sustain
                  them. RIM could not exist without that support. Programs list a suggested amount
                  so everyone can see what an offering takes to sustain. Each person gives what
                  they can, and no one is turned away. A few offerings, such as overnight retreats,
                  carry a minimum. For those, RIM pays the places that host us.
                </p>
                <p className="pp-intro__body">
                  The tradition calls this <em>dana</em>, generosity of heart. We ask everyone to
                  give something, in whatever form is possible: money, time, care, or sincere
                  presence. Generosity is a relationship. What you receive here was given by
                  someone, and what you give keeps the door open for the next person.
                </p>
                <p className="pp-intro__body">
                  Gifts made through program sign-ups are shared equally between RIM and the
                  Teaching Fund, which supports our teachers&rsquo; livelihood.
                </p>
                <p className="pp-intro__note">RIM is a 501(c)(3) nonprofit.</p>
              </div>

              <div className="pp-actions">
                <Link href="/donate" className="pp-btn">
                  Ways to give
                </Link>
                <Link href="/volunteerism/volunteer" className="pp-link">
                  Volunteering <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── The call, last: stakes after safety. ── */}
      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <aside className="pp-closing">
            <div>
              <h2 className="pp-closing__title">It matters how we live.</h2>
              <p className="pp-closing__body">
                This life matters, and so do the people in it and the world we share. Practice does
                not promise a life without pain. It offers something we can learn: to stop adding
                suffering to what is already hard, to enjoy what is good while it is here, and to
                let our care reach a little further than it did before.
              </p>
              <p className="pp-closing__body">
                Anyone can begin here. It is for people who mean to keep going, and it asks
                something of us: patience with the long middle, honesty about our own weather, and
                showing up on the days we would rather not. It is easier to keep going in good
                company.
              </p>
            </div>
            <Link href="/this-week" className="pp-btn pp-closing__link">
              This week&rsquo;s schedule <span aria-hidden="true">→</span>
            </Link>
          </aside>
        </div>
      </section>
    </div>
  );
}
