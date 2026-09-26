import { publicPageMetadata } from "@/lib/publicMetadata";
import Link from "next/link";
import { db } from "@/lib/db";
import { hasConcludedOneTime } from "@/lib/programUtils";
import GuidedPractice from "@/components/GuidedPractice";
import { categoryDisplayName } from "@/lib/programUtils";

// Lineage terms live here for search, stated as RIM states them (Jesse,
// 2026-09-25): a dharma community rooted in Chan silent illumination, not an
// insight / vipassana center.
export const metadata = publicPageMetadata("Rooted In Mindfulness \u2014 Meditation and Mindful Living in Brookfield", "Guided meditation, classes, and community in Brookfield, Wisconsin, and online. Explore CARE: learning to care for ourselves, those we care about, and our shared world, with roots in Buddhist practice.", "/");

export const dynamic = "force-dynamic";

/**
 * The home page states RIM's center first (2026-09-25). A visitor meets, in
 * order: what brings us together → what it looks like in an ordinary week →
 * the practice (CARE) → where it comes from → how to take part → for
 * organizations → dana → the call. Safety first, stakes late: the shared
 * intention and the many reasons people come open the page; "It matters how
 * we live" closes it.
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/04-community-website-copy-2026-09-25.md
 * Change the words there first, then here. Provisional until Jesse's
 * read-aloud. Teacher-side authority for the center:
 * 1 Model/01-framework-what-rim-is.md.
 *
 * Grounds alternate: ground, white, ground, white, ground, white, ground,
 * white (the organizations section, 2026-09-26, shifted Dana to ground and
 * the closing to white).
 * The CARE doors and the pathway doors are white lifted cards, so both sit on
 * the ground; "Practice for real life" sits on white with its six items in
 * borderless Pampas insets (particulars, not destinations, so no shadow).
 */

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
  const categories = await db.programCategory.findMany({
    where: { hideFromProgramsPage: false },
    orderBy: { sortOrder: "asc" },
    select: { name: true, slug: true, programs: {
      where: { archivedAt: null, hideFromProgramPageList: false },
      select: { startDatetime: true, endDatetime: true, recurrenceFreq: true, hideWhenPast: true },
    } },
  });
  const PATHWAY = categories.filter((c) => c.programs.some((p) => !(p.hideWhenPast && hasConcludedOneTime(p))))
    .map((c) => ({ title: categoryDisplayName(c.name), href: `/community-programs#${c.slug}` }));

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
            Rooted in Mindfulness is a meditation community in Brookfield, Wisconsin, near Milwaukee,
            with gatherings at our center and online. Through CARE, our shared approach, we learn to care for ourselves, those we care
            about, and our shared world. No meditation experience or religious belief is needed
            to begin. Come as you are.
          </p>
          <div className="pp-hero__actions">
            <Link href="/new-to-rim" className="pp-btn pp-btn--onblue">
              New to RIM
            </Link>
            <Link href="/this-week" className="pp-btn pp-btn--onblue-ghost">
              This week&rsquo;s schedule
            </Link>
          </div>
        </div>
      </section>

      <section className="pp-section pp-section--white">
        <div className="rim-container">
          <div className="pp-prose">
            <h2>Your first gathering</h2>
            <p>We recommend Meditation and Dharma Talk for a first visit: guided practice and a teaching, in person or on Zoom.</p>
            <GuidedPractice />
            <p><Link href="/new-to-rim">New to RIM</Link> explains arrival, online access, and what membership means.</p>
          </div>
        </div>
      </section>

      {/* ── What brings us together — the shared intention at the front door,
             so the wide welcome has a clear center (site revision brief,
             2026-09-25; replaces "What we are here for"). Open prose on the
             ground: nothing competes with it. ── */}
      <section className="pp-section">
        <div className="rim-container">
          <div className="pp-intro">
            <h2 className="pp-intro__title">What brings us together</h2>
            <p className="pp-intro__body">
              People come for relief in a hard season, for the company of others, or to understand
              their lives more fully. We share an intention: to see more clearly, meet life with
              kindness, and let that understanding shape how we act. There is room to begin with
              one visit and to keep learning through years of practice.
            </p>
          </div>
          <div className="pp-actions">
            <Link href="/why-we-practice" className="pp-btn">
              Why we practice
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

      {/* CARE is the shared practice; the handout carries the fuller teaching. */}
      <section className="pp-section">
        <div className="rim-container">
          <div className="pp-prose">
            <h2>Our practice is taking care.</h2>
            <p>
              CARE gives us a shared way to explore meditation and mindful living. Its eight words
              describe aspects of one practice: Calm, Connect, Aware, Attitude, Recognize, Remember,
              Embody, and Engage. We learn their meaning through experience, and return to them as
              our understanding grows.
            </p>
            <p>
              In a difficult conversation, that might mean feeling our feet on the floor, recognizing
              the urge to defend ourselves, and remembering that we want to understand the other
              person. We can listen, ask a question, or set a boundary with care. When we lose touch
              with the practice, recognizing that and returning is part of learning.
            </p>
            <p>
              Guided meditation gives us time to explore this with support. Daily life gives us
              opportunities to live it, for ourselves, those we care about, and our shared world.
              The same practice can deepen throughout a lifetime.
            </p>
          </div>
          <div className="pp-actions">
            <Link href="/care" className="pp-btn">Explore CARE and its eight words</Link>
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
                  CARE draws on Buddhist meditation and wisdom. We learn through guided practice
                  and experience, with room for questions and for people of every faith and of none.
                </p>
                <p className="pp-intro__body">
                  A Handful of Leaves brings together the traditional teachings that inform CARE.
                  Our Roots explains this relationship and the silent illumination tradition at the
                  heart of our practice.
                </p>
              </div>

              <div className="pp-actions">
                <Link href="/our-roots" className="pp-btn">
                  Explore our Buddhist roots
                </Link>
                <Link href="/about" className="pp-btn pp-btn--ghost">
                  About RIM
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
                <h2 className="pp-intro__title">Ways to practice together</h2>
                <p className="pp-intro__body">
                  Explore the current offerings in our program directory. Weekly gatherings support
                  regular practice; longer offerings allow more time for study and meditation.
                  Each program explains how to take part. Foundations of Mindful Living is a planned
                  introduction to CARE; while it is being prepared, our weekly gatherings offer a
                  place to begin and continue learning.
                </p>
              </div>

              <div className="pp-actions">
                <Link href="/community-programs" className="pp-btn">
                  Programs &amp; events
                </Link>
                <Link href="/new-to-rim" className="pp-btn pp-btn--ghost">
                  New to RIM
                </Link>
              </div>
            </div>

            <div className="pp-doors">
              {PATHWAY.map((route) => (
                <Link key={route.title} href={route.href} className="pp-card pp-card--row">
                  <div className="pp-card__row">
                    <div className="pp-card__main">
                      <h3 className="pp-card__title">{route.title}</h3>

                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── For organizations — the outreach face, stated once on the home
             page (site revision brief, 2026-09-25). ── */}
      <section className="pp-section pp-section--white">
        <div className="rim-container">
          <div className="pp-intro">
            <p className="pp-intro__eyebrow">For organizations</p>
            <h2 className="pp-intro__title">Taking CARE, carried into the world.</h2>
            <p className="pp-intro__body">
              We partner with nonprofits and community organizations working for the well-being of
              people, communities, and our shared world, offering Taking CARE to the people they
              serve and to the people who carry their work.
            </p>
          </div>
          <div className="pp-actions">
            <Link href="/outreach" className="pp-btn">
              Outreach for organizations
            </Link>
          </div>
        </div>
      </section>

      {/* ── Dana — image right. The held lotus (Olga Nayda, Unsplash): an
             offered flower is the dana gesture itself. Stated as dana actually
             works at RIM (Jesse, 2026-09-25): suggested amounts, no one turned
             away, minimums only where RIM pays a host, program gifts split
             with the Teaching Fund. ── */}
      <section className="pp-section">
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
                  them. RIM could not exist without that support. Membership has no dues. Program
                  pages distinguish voluntary donations from any amount required to register.
                  Contact us before registering if a required amount is a barrier.
                </p>
                <p className="pp-intro__body">
                  The tradition calls this <em>dana</em>, generosity of heart. We ask everyone to
                  offer what is possible: money, time, care, or sincere
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
                <Link href="/volunteerism/volunteer" className="pp-btn pp-btn--ghost">
                  Volunteering
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── The call, last: stakes after safety. ── */}
      <section className="pp-section pp-section--white pp-section--last">
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
                You can begin with one gathering. Come with your questions, try the practice,
                and see what is useful. There is room to continue learning in good company.
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
