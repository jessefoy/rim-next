import Link from "next/link";

export const metadata = {
  title: "Rooted In Mindfulness - Meditation Center - Brookfield - Greater Milwaukee",
  description: "RIM is a Community Insight Meditation Center dedicated to providing a spiritual refuge for all who wish to live with greater wisdom, compassion, and well-being.",
};

export default function HomePage() {
  return (
    <>
      {/* ── Hero Video Section ──────────────────────────────── */}
      <section className="header-section-video">
        <div className="header-content-video">
          <div className="header-title-video">
            <div className="header-content">
              <h1 className="h1-heading">
                Awaken your <span>Mind,</span><br />
                Open your <span>Heart,</span><br />
                Nourish your <span>Life,</span><br />
                Beautify the <span>World.</span>
              </h1>
              <div className="max-width-large">
                <p className="paragraph-32">
                  RIM is a modern, welcoming Dharma center grounded in traditional Buddhist wisdom. We offer meditation and mindful living practices in a safe and supportive community—to help one another heal, grow, awaken, and live in ways that benefit yourself, those you love, and our shared world.
                </p>
              </div>
              <Link href="/community-membership" className="button-primary w-button">
                Join us–today
              </Link>
            </div>
          </div>
        </div>
        <div className="background">
          <div className="header-gradient-overlay"></div>
          <div className="header-background-video w-background-video w-background-video-atom">
            <video
              autoPlay
              loop
              muted
              playsInline
              style={{ backgroundImage: "url('/videos/Bodhi_Leaves-poster-00001.jpg')" }}
            >
              <source src="/videos/Bodhi_Leaves-transcode.mp4" />
              <source src="/videos/Bodhi_Leaves-transcode.webm" />
            </video>
          </div>
        </div>
      </section>

      {/* ── Learn, Practice, Grow ───────────────────────────── */}
      <div className="section background-white">
        <div className="container-home-page">
          <div className="grid-halves reverse-direction">
            <div className="container-image">
              <div className="section-image what-we-do"></div>
            </div>
            <div className="container-content flip-pull">
              <div className="section-content content-info">
                <h2>Learn, Practice, and Grow Together.</h2>
                <p className="section-text-3">
                  <strong>RIM</strong> is a diverse community where people from all walks of life come together to nurture our natural capacity for wisdom, compassion, well-being, and authentic happiness.
                  <br /><br />
                  Through the timeless teachings of meditation, mindful living, and shared community support, we aspire to live in ways that uplift ourselves, benefit others, and care for our shared world.
                </p>
              </div>
              <div className="section-platforms">
                <div className="program-details-content no-bottom-margin">
                  <h2>Timeless Wisdom for our Modern Life.</h2>
                  <p className="section-text-3">
                    We share the heart of Buddhist wisdom through Insight (Vipassana) practice—rooted in the Pāli Canon and enriched by the universal Dharma of all Buddhist traditions. Our teachings and practices are free from dogma, informed by modern science and lived experience, and offered in a spirit of generosity. Accessible to secular and spiritual seekers alike, they invite everyone to explore a more mindful, compassionate, and awakened way of life.
                    <br /> 👋🏿👋🏾👋🏽👋🏼👋🏻🌈
                  </p>
                  <Link href="/diversity" className="button-2 w-button">
                    Diverse Together - Learn More
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Community Programs ──────────────────────────────── */}
      <div id="Programs" className="section background-white-copy">
        <div className="container-home-page">
          <div className="grid-halves reverse-direction">
            <div className="container-content flip-pull">
              <div className="section-content content-info-copy">
                <h2>Join a Mindfulness-Based Community</h2>
                <p className="section-text-3">
                  An intentional community provides connection, support, and friendship that can nourish us in a world where we may feel disconnected and unsupported.
                  <br /><br />
                  Be with others who share an intention to awaken our innate human goodness through meditation and mindful living. Together, we learn and practice ways to reduce harm and nourish well-being within one another and our shared world.
                  <br />
                  <strong>Become a RIM Community Member and participate in events, meditation sessions, dharma talks, classes, community groups, retreats, and much more.</strong>
                </p>
                <Link href="/community-membership" className="button-2 w-button">
                  Learn More &amp; Join Us!
                </Link>
              </div>
              <div className="section-platforms-copy">
                <div className="section-platforms-title-copy-2">
                  <h2>Community Programs</h2>
                  <p className="paragraph-13">
                    <strong>Learn and practice with others.</strong> To safely stay connected, sit together, and support each other, Tuesday and Saturday Drop-in classes are now offered <strong>in-person at the center or online</strong> via zoom! Other classes are held on zoom exclusively.
                  </p>
                </div>
                <div className="section-platforms-row">
                  <div className="w-layout-grid grid-19">
                    <Link href="/community-programs" className="div-block-101 w-inline-block">
                      <div><h2 className="book-card-title-copy">Ongoing Drop-Ins</h2></div>
                    </Link>
                    <Link href="/community-programs" className="div-block-101 w-inline-block">
                      <div><h2 className="book-card-title-copy">Classes &amp; Courses</h2></div>
                    </Link>
                    <Link href="/community-programs" className="div-block-101 w-inline-block">
                      <div><h2 className="book-card-title-copy">Retreats &amp; Workshops</h2></div>
                    </Link>
                    <Link href="/community-programs" className="div-block-101 w-inline-block">
                      <div><h2 className="book-card-title-copy">Community Groups</h2></div>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            <div className="container-image">
              <div className="section-image community-programs-image"></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dana / Generosity ───────────────────────────────── */}
      <div className="section background-white">
        <div className="container-home-page">
          <div className="div-block-110">
            <div className="div-block-111">
              <h2>A Generosity-Based Approach</h2>
              <p className="section-text-3">
                RIM is inspired by the spirit of <em>Dana</em>, an ancient Pali language word that means generosity of heart, mind, and action. <em>Dana</em> promotes a healthier, selfless, caring, and grateful world.
                <br /><br />
                Traditionally, Buddhist nuns and monks offer teachings in the spirit of generosity, while the community supports the teachers and the center to the level of their ability. In this same spirit, RIM and its teachers do not charge any fees or tuition and are supported by the community.
                <br /><br />
                As an alternative to a pay-for-service economics model, RIM embraces a generosity-based model. The RIM community is a living gift made possible by the appreciation, goodwill, and generosity of the kind people inspired to give financial support, volunteer, teach, and support one another.
                <br /><br />
                <strong><em>RIM is a 501(c3) non-profit organization.</em></strong>
              </p>
              <Link href="/donate" className="button-2 _20px-from-top donate-red w-button">
                Give a Donation
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
