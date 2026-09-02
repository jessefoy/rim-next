import Link from "next/link";
import { db } from "@/lib/db";
import { categoryDisplayName } from "@/lib/programUtils";

// The searchable lineage terms ("insight meditation", "vipassana") live here,
// in metadata, and deliberately not in the welcome prose — a seeker still finds
// the door, and a first-time visitor isn't met with vocabulary.
export const metadata = {
  title: "Rooted In Mindfulness - Meditation Center - Brookfield - Greater Milwaukee",
  description:
    "Rooted in Mindfulness is a Buddhist meditation community in Brookfield, Wisconsin, near Milwaukee. Insight meditation, mindfulness practice, and dharma teachings, freely offered and community-supported. In person and online. Come as you are.",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // The doors into the catalog are the real, editorial taxonomy — the same
  // categories Program Manager maintains and /community-programs renders —
  // never a hardcoded list. Each door deep-links to its category's anchor on
  // the listing page. Filter empty categories in the database; the homepage
  // needs only the identity of each door, not program rows or aggregate counts.
  const doors = await db.programCategory.findMany({
    where: {
      hideFromProgramsPage: false,
      programs: {
        some: {
          archivedAt: null,
          hideFromProgramPageList: false,
          slug: { not: "dummy-test-program" },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  return (
    <div className="pp-page">
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
            Rooted in Mindfulness is a Buddhist meditation community in Brookfield, Wisconsin. We
            sit together, learn together, and help one another live with more clarity, kindness,
            and steadiness. Everything here is freely offered and community-supported, and open to
            everyone. Come as you are.
          </p>
          <div className="pp-hero__actions">
            <Link href="/your-first-visit" className="pp-btn pp-btn--onblue">
              Plan your first visit
            </Link>
            <Link href="/this-week" className="pp-hero__link">
              See what&rsquo;s happening this week <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── What we do — image right ──────────────────────── */}
      <section className="pp-section pp-section--white">
        <div className="rim-container">
          <div className="pp-split pp-split--flip">
            <div
              className="pp-split__media"
              style={{
                ["--pp-split-image" as string]: "url('/images/buddga-lotus-unsplash-1600.webp')",
                ["--pp-split-position" as string]: "center 30%",
              }}
              aria-hidden="true"
            />
            <div className="pp-split__body">
              {/* Meets the reader's actual life by naming particulars, never the
                  epoch. No "turbulent times", no "today's fast-paced world",
                  anywhere on the site. */}
              <div className="pp-intro">
                <h2 className="pp-intro__title">Learn, Practice, and Grow Together.</h2>
                <p className="pp-intro__body">
                  Most of us are carrying more than we let on. Full days that somehow do not
                  nourish. News that arrives faster than a heart can hold it. Plenty of connection
                  on a screen, and more loneliness than anyone says out loud. Nobody needs to be
                  told the times are hard. What we need is a place to put some of it down.
                </p>
                <p className="pp-intro__body">
                  And what helps is old, and it still works: a practice that settles the mind,
                  teachings that give a life meaning and direction, and people who take both
                  seriously, sitting beside you. That is what we are making here, together.
                </p>
              </div>

              <div className="pp-intro">
                <h2 className="pp-intro__title">What We Learn and Practice.</h2>
                <p className="pp-intro__body">
                  At RIM, meditation is part of a larger way of learning and living. We explore
                  Buddhist wisdom across the traditions&mdash;not as a belief system, but as
                  practical ways to steady the mind, understand experience, meet difficulty, and
                  bring more wisdom and compassion into everyday life. You do not need to be
                  Buddhist to practice here, and nobody will try to make you one.
                </p>
                <p className="pp-intro__body">
                  Everything we keep passes one old test: does it help a person suffer less, see
                  more clearly, and love more capably? We call this ordered path A Handful of
                  Leaves, after a story the Buddha told in a forest.
                </p>
              </div>

              <div className="pp-actions">
                <Link href="/what-we-practice" className="pp-btn pp-btn--ghost">
                  Explore what we learn and practice
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Community — image left, alternating with the section above ── */}
      <section id="programs" className="pp-section">
        <div className="rim-container">
          <div className="pp-split">
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
                <h2 className="pp-intro__title">Join a Mindfulness-Based Community</h2>
                <p className="pp-intro__body">
                  This path is difficult to walk alone, and no one here has to. Anyone who has sat
                  in a room of settled people knows that steadiness is contagious, and in community
                  we learn as much from one another&rsquo;s honest difficulties as from one
                  another&rsquo;s calm.
                </p>
                <p className="pp-intro__body">
                  Members gather for meditation, dharma talks, classes, community groups, and
                  retreats, and friendships form around what matters. Membership, like everything
                  else here, is freely offered.
                </p>
              </div>

              <div className="pp-actions">
                <Link href="/join" className="pp-btn">
                  Become a member
                </Link>
                <Link href="/diversity" className="pp-link">
                  Diverse Together <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Program doors — the live taxonomy, each leading to its own
             chapter of the catalog. Composed like the page's other chapters:
             words on one side, the doors on the other, so the section fills
             its container instead of floating an intro over a card grid. */}
      <section className="pp-section pp-section--white">
        <div className="rim-container">
          <div className="pp-split pp-split--doors">
            <div className="pp-split__body">
              <div className="pp-intro">
                <p className="pp-intro__eyebrow">Community programs</p>
                <h2 className="pp-intro__title">
                  Learn and practice with the support of others.
                </h2>
                <p className="pp-intro__body">
                  We gather through the week, mornings and evenings,{" "}
                  <strong>in person at the center and online</strong>. Every session is complete in
                  itself. No background is needed and no one will ask you to explain yourself, so
                  you can come this week, just as you are.
                </p>
                {/* Lifted from the membership block on /community-programs on
                    purpose — recurrence is how a line becomes the community's
                    own vocabulary. Keep the two in step. */}
                <p className="pp-intro__body">
                  RIM asks no fees or tuition; the center is held by the people who practice here,
                  each giving as they are able.
                </p>
              </div>

              <div className="pp-actions">
                <Link href="/community-programs" className="pp-btn pp-btn--ghost">
                  See all programs
                </Link>
              </div>
            </div>

            <div className="pp-doors">
              {doors.map((door) => (
                <Link
                  key={door.id}
                  href={`/community-programs#${door.slug}`}
                  className="pp-card pp-card--row pp-card--door"
                >
                  <div className="pp-card__row">
                    <h3 className="pp-card__title">{categoryDisplayName(door.name)}</h3>
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

      {/* ── Generosity — image right, completing the page's alternation.
             The held lotus (Olga Nayda, Unsplash) — an offered flower is the
             dana gesture itself. ── */}
      <section className="pp-section pp-section--last">
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
                {/* The giving is described before the word arrives — the
                    experience-before-the-name rule. The brief's opening line
                    ("Everything at RIM is freely offered and community-supported")
                    was cut here: the hero already says it, and this section says
                    it more concretely one sentence later. */}
                <p className="pp-intro__body">
                  We follow an old practice here: the teachings are given as a gift, never sold.
                  There is no fee or tuition for anything. The community sustains the teachers and
                  the center, each person as they are able.
                </p>
                <p className="pp-intro__body">
                  The tradition calls this <em>dana</em>, generosity of heart: a gift economy rather
                  than a fee for service. What you receive here was given by someone, and what you
                  give keeps the door open for the next person. A teaching given freely can be
                  trusted freely.
                </p>
                <p className="pp-intro__note">RIM is a 501(c)(3) nonprofit.</p>
              </div>

              <div className="pp-actions">
                <Link href="/donate" className="pp-btn">
                  Give a donation
                </Link>
                <Link href="/volunteerism/volunteer" className="pp-link">
                  Volunteer with us <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
