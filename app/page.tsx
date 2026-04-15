import Link from "next/link";

export const metadata = {
  title: "Rooted In Mindfulness - Meditation Center - Brookfield - Greater Milwaukee",
  description: "RIM is a Community Insight Meditation Center dedicated to providing a spiritual refuge for all who wish to live with greater wisdom, compassion, and well-being.",
};

export default function HomePage() {
  return (
    <>
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="hp-hero">
        <div className="hp-hero__video">
          <video
            autoPlay
            loop
            muted
            playsInline
            poster="/images/Bodhi_Leaves-poster-00001.jpg"
          >
            <source src="/videos/Bodhi_Leaves-transcode.webm" type="video/webm" />
            <source src="/videos/Bodhi_Leaves-transcode.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="hp-hero__overlay" />
        <div className="rim-container hp-hero__container">
          <div className="hp-hero__content">
            <span className="hp-hero__eyebrow">Dharma Community · Brookfield, WI</span>
            <h1 className="hp-hero__heading">
              Awaken your Mind,<br />
              Open your Heart,<br />
              Nourish your Life,<br />
              Beautify the World.
            </h1>
            <p className="hp-hero__desc">
              Meditation and mindful living for a wiser, kinder life —
              in a generous community grounded in Buddhist wisdom.
            </p>
            <Link href="/community-membership" className="hp-hero__cta">
              Join us today →
            </Link>
          </div>
        </div>
      </section>

      {/* ── About ───────────────────────────────────────────── */}
      <section className="rim-section rim-section--white hp-about">
        <div className="rim-container rim-container--narrow">
          <h2>Learn, Practice, and Grow Together.</h2>
          <p>
            <strong>RIM</strong> is a diverse community where people from all walks of life come together to
            nurture our natural capacity for wisdom, compassion, well-being, and authentic happiness.
          </p>
          <p>
            Through the timeless teachings of meditation, mindful living, and shared community support, we
            aspire to live in ways that uplift ourselves, benefit others, and care for our shared world.
          </p>
          <h3>Timeless Wisdom for our Modern Life.</h3>
          <p>
            We share the heart of Buddhist wisdom through Insight (Vipassana) practice—rooted in the Pāli
            Canon and enriched by the universal Dharma of all Buddhist traditions. Our teachings and practices
            are free from dogma, informed by modern science and lived experience, and offered in a spirit of
            generosity. Accessible to secular and spiritual seekers alike, they invite everyone to explore a
            more mindful, compassionate, and awakened way of life.
          </p>
          <Link href="/diversity" className="hp-link">
            We are diverse and welcoming — learn more →
          </Link>
        </div>
      </section>

      {/* ── Community Programs ──────────────────────────────── */}
      <section className="rim-section rim-section--grey">
        <div className="rim-container">
          <div className="hp-community">
            <div className="hp-community__image" />
            <div className="hp-community__content">
              <h2>Join a Mindfulness-Based Community</h2>
              <p>
                An intentional community provides connection, support, and friendship that can nourish us in a
                world where we may feel disconnected and unsupported.
              </p>
              <p>
                Be with others who share an intention to awaken our innate human goodness through meditation
                and mindful living. Together, we learn and practice ways to reduce harm and nourish well-being
                within one another and our shared world.
              </p>
              <h3>Community Programs</h3>
              <div className="hp-categories">
                <Link href="/community-programs" className="hp-category">Ongoing Drop-Ins</Link>
                <Link href="/community-programs" className="hp-category">Classes &amp; Courses</Link>
                <Link href="/community-programs" className="hp-category">Retreats &amp; Workshops</Link>
                <Link href="/community-programs" className="hp-category">Community Groups</Link>
              </div>
              <Link href="/community-membership" className="hp-link" style={{ marginTop: "28px", display: "inline-block" }}>
                Become a member — learn more →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Dana / Generosity ───────────────────────────────── */}
      <section className="rim-section rim-section--teal">
        <div className="rim-container rim-container--narrow">
          <h2>A Generosity-Based Approach</h2>
          <p>
            RIM is inspired by the spirit of <em>Dana</em>, an ancient Pali language word that means
            generosity of heart, mind, and action. <em>Dana</em> promotes a healthier, selfless, caring,
            and grateful world.
          </p>
          <p>
            Traditionally, Buddhist nuns and monks offer teachings in the spirit of generosity, while the
            community supports the teachers and the center to the level of their ability. In this same spirit,
            RIM and its teachers do not charge any fees or tuition and are supported by the community.
          </p>
          <p>
            As an alternative to a pay-for-service economics model, RIM embraces a generosity-based model.
            The RIM community is a living gift made possible by the appreciation, goodwill, and generosity of
            the kind people inspired to give financial support, volunteer, teach, and support one another.
          </p>
          <p><strong><em>RIM is a 501(c3) non-profit organization.</em></strong></p>
          <Link href="/donate" className="hp-cta-donate">
            Give a Donation
          </Link>
        </div>
      </section>
    </>
  );
}
