import Link from "next/link";

export const metadata = {
  title: "Rooted In Mindfulness - Meditation Center - Brookfield - Greater Milwaukee",
  description:
    "RIM is a Community Insight Meditation Center dedicated to providing a spiritual refuge for all who wish to live with greater wisdom, compassion, and well-being.",
};

/* The four doors into the program catalog, as the live site presents them. */
const PROGRAM_DOORS = [
  { title: "Ongoing Drop-Ins", href: "/community-programs" },
  { title: "Classes & Courses", href: "/community-programs" },
  { title: "Retreats & Workshops", href: "/community-programs" },
  { title: "Community Groups", href: "/kalyana-mitta/community-groups-events" },
];

export default function HomePage() {
  return (
    <div className="pp-page">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="pp-hero pp-hero--video">
        <div className="pp-hero__video" aria-hidden="true">
          <video
            autoPlay
            loop
            muted
            playsInline
            poster="/videos/Bodhi_Leaves-poster-00001.jpg"
          >
            <source src="/videos/Bodhi_Leaves-transcode.webm" type="video/webm" />
            <source src="/videos/Bodhi_Leaves-transcode.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="rim-container pp-hero__inner">
          <h1 className="pp-hero__title">
            Awaken your Mind,
            <br />
            Open your Heart,
            <br />
            Nourish your Life,
            <br />
            Beautify the World.
          </h1>
          <p className="pp-hero__body">
            RIM is a modern, welcoming Dharma center grounded in traditional Buddhist wisdom. We
            offer meditation and mindful living practices in a safe and supportive community — to
            help one another heal, grow, awaken, and live in ways that benefit yourself, those you
            love, and our shared world.
          </p>
          <div className="pp-hero__actions">
            <Link href="/join" className="pp-btn pp-btn--onblue">
              Join us today
            </Link>
            <Link href="/this-week" className="pp-hero__link">
              See what&rsquo;s happening this week <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── What we do ────────────────────────────────────── */}
      <section className="pp-section pp-section--white">
        <div className="rim-container">
          <div className="pp-split">
            <div
              className="pp-split__media"
              style={{
                ["--pp-split-image" as string]: "url('/images/buddga-lotus-unsplash.jpg')",
                ["--pp-split-position" as string]: "center 30%",
              }}
              aria-hidden="true"
            />
            <div className="pp-split__body">
              <div className="pp-intro">
                <h2 className="pp-intro__title">Learn, Practice, and Grow Together.</h2>
                <p className="pp-intro__body">
                  <strong>RIM</strong> is a diverse community where people from all walks of life
                  come together to nurture our natural capacity for wisdom, compassion, well-being,
                  and authentic happiness.
                </p>
                <p className="pp-intro__body">
                  Through the timeless teachings of meditation, mindful living, and shared community
                  support, we aspire to live in ways that uplift ourselves, benefit others, and care
                  for our shared world.
                </p>
              </div>

              <div className="pp-intro">
                <h2 className="pp-intro__title">Timeless Wisdom for our Modern Life.</h2>
                <p className="pp-intro__body">
                  We share the heart of Buddhist wisdom through Insight (Vipassana) practice — rooted
                  in the Pāli Canon and enriched by the universal Dharma of all Buddhist traditions.
                  Our teachings and practices are free from dogma, informed by modern science and
                  lived experience, and offered in a spirit of generosity. Accessible to secular and
                  spiritual seekers alike, they invite everyone to explore a more mindful,
                  compassionate, and awakened way of life.
                </p>
              </div>

              <div className="pp-actions">
                <Link href="/diversity" className="pp-btn pp-btn--ghost">
                  Diverse Together — learn more
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Community + programs ──────────────────────────── */}
      <section id="programs" className="pp-section">
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
                <h2 className="pp-intro__title">Join a Mindfulness-Based Community</h2>
                <p className="pp-intro__body">
                  An intentional community provides connection, support, and friendship that can
                  nourish us in a world where we may feel disconnected and unsupported.
                </p>
                <p className="pp-intro__body">
                  Be with others who share an intention to awaken our innate human goodness through
                  meditation and mindful living. Together, we learn and practice ways to reduce harm
                  and nourish well-being within one another and our shared world.
                </p>
                <p className="pp-intro__body">
                  <strong>
                    Become a RIM Community Member and participate in events, meditation sessions,
                    dharma talks, classes, community groups, retreats, and much more.
                  </strong>
                </p>
              </div>

              <div className="pp-actions">
                <Link href="/join" className="pp-btn">
                  Learn more &amp; join us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Program doors ─────────────────────────────────── */}
      <section className="pp-section pp-section--white">
        <div className="rim-container">
          <div className="pp-intro">
            <p className="pp-intro__eyebrow">Community programs</p>
            <h2 className="pp-intro__title">Learn and practice with others.</h2>
            <p className="pp-intro__body">
              To safely stay connected, sit together, and support each other, Tuesday and Saturday
              drop-in classes are offered <strong>in person at the center or online</strong> via
              Zoom. Other classes are held on Zoom exclusively.
            </p>
          </div>

          <div className="pp-cards pp-cards--two">
            {PROGRAM_DOORS.map((door) => (
              <Link key={door.title} href={door.href} className="pp-card pp-card--row">
                <div className="pp-card__row">
                  <div className="pp-card__main">
                    <h3 className="pp-card__title">{door.title}</h3>
                  </div>
                  <span className="pp-card__action" aria-hidden="true">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="pp-actions pp-actions--center">
            <Link href="/community-programs" className="pp-link">
              See all programs <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Generosity ────────────────────────────────────── */}
      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-intro">
            <p className="pp-intro__eyebrow">Dana</p>
            <h2 className="pp-intro__title">A Generosity-Based Approach</h2>
          </div>

          <div className="pp-prose">
            <p>
              RIM is inspired by the spirit of <em>Dana</em>, an ancient Pali language word that
              means generosity of heart, mind, and action. <em>Dana</em> promotes a healthier,
              selfless, caring, and grateful world.
            </p>
            <p>
              Traditionally, Buddhist nuns and monks offer teachings in the spirit of generosity,
              while the community supports the teachers and the center to the level of their ability.
              In this same spirit, RIM and its teachers do not charge any fees or tuition and are
              supported by the community.
            </p>
            <p>
              As an alternative to a pay-for-service economics model, RIM embraces a generosity-based
              model. The RIM community is a living gift made possible by the appreciation, goodwill,
              and generosity of the kind people inspired to give financial support, volunteer, teach,
              and support one another.
            </p>
            <p>
              <em>RIM is a 501(c)(3) non-profit organization.</em>
            </p>
          </div>

          <div className="pp-actions pp-actions--center">
            <Link href="/donate" className="pp-btn">
              Give a donation
            </Link>
            <Link href="/volunteerism/volunteer" className="pp-link">
              Volunteer with us <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
