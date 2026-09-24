import Link from "next/link";
import { db } from "@/lib/db";
import { categoryDisplayName } from "@/lib/programUtils";

// The searchable lineage terms ("insight meditation", "vipassana", "Buddhist")
// live here, in metadata, and deliberately not in the hero — a seeker still
// finds the door, and a first-time visitor isn't met with vocabulary.
export const metadata = {
  title: "Rooted In Mindfulness - Meditation Center - Brookfield - Greater Milwaukee",
  description:
    "Rooted in Mindfulness is a Buddhist meditation community in Brookfield, Wisconsin, near Milwaukee. Insight meditation, mindfulness practice, and dharma teachings, freely offered and community-supported. In person and online. Come as you are.",
};

export const dynamic = "force-dynamic";

/**
 * The home page is sequenced CARE-first (session 177). The visitor meets, in
 * order: what this has to do with a life → the practice (CARE) → where it
 * comes from (the Buddhist roots, named plainly) → how to begin → how it is
 * held → what we are here for. The roots are visible and unapologetic; they
 * are not the threshold. Authority: care-core-framework.md (teacher-side) and
 * the Taking C.A.R.E. handout; the public register lives on this side of the
 * framework's register line. Copy is provisional until Jesse's read-aloud.
 *
 * The four pairs link to their anchors on /care. Their one-line descriptions
 * are the only place on this page CARE is unpacked; the page stays short.
 */
const CARE_PAIRS = [
  {
    slug: "calm-and-connect",
    title: "Calm and Connect",
    line: "Settle what can be settled, and arrive where life is happening.",
  },
  {
    slug: "aware-and-attitude",
    title: "Aware and Attitude",
    line: "Let the mind’s own clarity do the seeing, and meet what it sees with kindness and curiosity.",
  },
  {
    slug: "recognize-and-remember",
    title: "Recognize and Remember",
    line: "Know what is here, honestly, and remember what matters.",
  },
  {
    slug: "embody-and-engage",
    title: "Embody and Engage",
    line: "Let the practice become who we are, and how we care for one another and the world.",
  },
] as const;

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
          {/* Jesse's headline, kept verbatim (session 177 ruling). Read beside
              CARE it already traces the model — mind and heart (Aware,
              Attitude), life (Embody), world (Engage) — and widens from within
              ourselves to the world, which is the three rings. */}
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
            Our practice is taking care: of ourselves, of those we love, of our shared world, and
            of this moment. RIM is a welcoming meditation community in Brookfield, Wisconsin, in
            person and online, where we learn and practice that care together and help one another
            heal, grow, and live well. Everything here is freely offered and community-supported.
            Come as you are.
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

      {/* ── Practice for real life — image right ─────────────
             Meets the reader's actual life by naming particulars, never the
             epoch. No "turbulent times", no "today's fast-paced world",
             anywhere on the site. */}
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
              <div className="pp-intro">
                <h2 className="pp-intro__title">Practice for real life.</h2>
                <p className="pp-intro__body">
                  Most of us are carrying more than we let on. Full days that somehow do not
                  nourish. A conversation we keep replaying on the drive home. A habit we meant to
                  change last year. Nobody needs to be told the times are hard. What we need is
                  somewhere to put some of it down, and a way to meet what cannot be put down.
                </p>
                <p className="pp-intro__body">
                  We meditate here, and the practice is larger than meditation. Sitting still is
                  where it starts. It becomes how we answer a hard email, how we listen to a child
                  at bedtime, how we rest. Most of the practice happens in ordinary life, and the
                  ordinary door opens all the way.
                </p>
              </div>

              <div className="pp-actions">
                <Link href="/care" className="pp-btn pp-btn--ghost">
                  Explore how we practice
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Taking care — the four pairs left, words right ──
             The practice is shown before it is named: the pairs first, the
             acronym in the last line (experience before the name). */}
      <section className="pp-section">
        <div className="rim-container">
          <div className="pp-split pp-split--doors pp-split--doors-left">
            <div className="pp-split__body">
              <div className="pp-intro">
                <p className="pp-intro__eyebrow">Our practice</p>
                <h2 className="pp-intro__title">Taking care of this life.</h2>
                <p className="pp-intro__body">
                  Our practice is taking care. We describe that one practice with four pairs of
                  words. They are not steps. In any real moment all of them are present, and any
                  one of them is a way in.
                </p>
                <p className="pp-intro__body">
                  Each of these can be practiced within ourselves, between us, and in the wider
                  world we are part of. The first letters spell the word. We call it CARE.
                </p>
              </div>

              <div className="pp-actions">
                <Link href="/care" className="pp-btn">
                  Learn about CARE
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
                      <p className="pp-card__body">{pair.line}</p>
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

      {/* ── Deep roots — image right ─────────────────────────
             The first place "Buddhist" appears on the page, by design. The
             roots are named plainly; they are not the threshold. */}
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
                  RIM is a Buddhist-rooted nonprofit and a contemplative community. What we
                  practice comes down through the Buddhist meditation traditions, from the earliest
                  teachings and the traditions that grew from them, and it is taught plainly and by
                  experience, without dogma. Contemplative psychology, mindfulness-based programs,
                  modern science, and decades of lived practice inform it too.
                </p>
                <p className="pp-intro__body">
                  You do not need to be Buddhist, or to hold any religious belief, to practice
                  here. Secular and spiritual seekers sit side by side. Some come for a steadier
                  way through stress. Some come for the meditation and the company. Some want to
                  study the Dharma, the Buddha&rsquo;s teachings, and walk that path all the way.
                  All of these are real ways to be here, and no one is asked to choose a door
                  before coming in.
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
                  Go deeper: A Handful of Leaves <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Program doors left, words right — the live taxonomy, each
             leading to its own chapter of the catalog. The newcomer pathway
             lives in these words and at /your-first-visit; nothing goes above
             the catalog itself (session 170 tombstone). */}
      <section className="pp-section">
        <div className="rim-container">
          <div className="pp-split pp-split--doors pp-split--doors-left">
            <div className="pp-split__body">
              <div className="pp-intro">
                <p className="pp-intro__eyebrow">Community programs</p>
                <h2 className="pp-intro__title">Learn, practice, and grow together.</h2>
                <p className="pp-intro__body">
                  Practice is easier to keep when we do not keep it alone. We come together to
                  nurture what is naturally in us: wisdom, compassion, and well-being. We gather
                  through the week, mornings and evenings,{" "}
                  <strong>in person at the center and online</strong>: meditation sittings,
                  classes, community groups, retreats and practice days, and time to talk about
                  what practice meets in a life. Every session is complete in itself.
                </p>
                <p className="pp-intro__body">
                  New to this? You do not need to know how to meditate, understand Buddhism, or
                  know where any of it is going. Begin with a drop-in sitting, an introductory
                  class, or a conversation. Nobody will ask you to explain yourself.
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
                <Link href="/community-programs" className="pp-btn">
                  See all programs
                </Link>
                <Link href="/your-first-visit" className="pp-link">
                  Coming for the first time <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>

            <div className="pp-doors">
              {doors.map((door) => (
                <Link
                  key={door.id}
                  href={`/community-programs#${door.slug}`}
                  className="pp-card pp-card--row"
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

      {/* ── Generosity — image right. The held lotus (Olga Nayda, Unsplash):
             an offered flower is the dana gesture itself. ── */}
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
                {/* The giving is described before the word arrives — the
                    experience-before-the-name rule. */}
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
                <p className="pp-intro__body">
                  And the giving is itself practice. Taking care, in one of its plainest forms.
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

      {/* ── What we are here for — the mission, and its seriousness, last:
             safety first, stakes late. */}
      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <aside className="pp-closing">
            <div>
              <h2 className="pp-closing__title">What we are here for.</h2>
              <p className="pp-closing__body">
                We practice to benefit ourselves, those we care about, and our shared world: to
                know ourselves, to cultivate what is good in us, and to wake up and free ourselves
                from the patterns that cause harm. That is the whole of it, and it is not small.
              </p>
              <p className="pp-closing__body">
                Anyone can begin here. It is for people who mean to keep going. The practice asks
                something real of us, patience with the long unglamorous middle, honesty about our
                own weather, showing up on the days we would rather not, and it asks because the
                stakes are real. Our seriousness is a kind of warmth. This is the work we share,
                and there is room in it for you.
              </p>
            </div>
            <Link href="/this-week" className="pp-btn pp-closing__link">
              Come sit with us <span aria-hidden="true">→</span>
            </Link>
          </aside>
        </div>
      </section>
    </div>
  );
}
