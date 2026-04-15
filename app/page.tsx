import Link from "next/link";

export const metadata = {
  title: "Rooted In Mindfulness — Meditation and Dharma Community — Brookfield, WI",
  description: "A meditation and dharma community in Brookfield, Wisconsin. Buddhist-rooted, open to everyone, offered in the spirit of generosity.",
};

export default function HomePage() {
  return (
    <>
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="hp-hero">
        <div className="hp-hero__video">
          <video autoPlay loop muted playsInline poster="/images/Bodhi_Leaves-poster-00001.jpg">
            <source src="/videos/Bodhi_Leaves-transcode.webm" type="video/webm" />
            <source src="/videos/Bodhi_Leaves-transcode.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="hp-hero__overlay" />
        <div className="rim-container">
          <div className="hp-hero__content">
            <h1 className="hp-hero__heading">A place to practice, together.</h1>
            <p className="hp-hero__desc">
              We're a meditation and dharma community in Brookfield, Wisconsin. We sit together, we
              study the teachings, and we try to bring what we find into the rest of our lives.
              Buddhist-rooted, open to everyone, and offered in the spirit of generosity.
            </p>
            <Link href="/community-programs" className="hp-hero__cta">
              Come to a Drop-In →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Welcome ─────────────────────────────────────────── */}
      <section className="rim-section rim-section--white">
        <div className="rim-container rim-container--narrow">
          <p className="hp-welcome__body">
            People come to RIM for different reasons. Some want to learn to meditate. Some have been
            practicing on their own and are ready for a teacher and a community. Some are going through
            something hard and need a place where they don't have to explain themselves.
          </p>
          <p className="hp-welcome__anchor">
            Whatever brought you here, you're welcome. No experience needed. No fees. Come as you are,
            and see what you find.
          </p>
        </div>
      </section>

      {/* ── This Week at RIM ────────────────────────────────── */}
      <section className="rim-section rim-section--grey">
        <div className="rim-container">
          <h2 className="hp-sched__heading">This Week at RIM</h2>
          <div className="hp-sched">
            {[
              { day: "Monday",    name: "Awakening the Heart",         desc: "Lovingkindness practice",        time: "9:30 AM",           fmt: "Online",              inperson: false },
              { day: "Tuesday",   name: "The Art of Meditation",       desc: "Guided practice and teaching",  time: "9:30 AM",           fmt: "In person & online",  inperson: true  },
              { day: "Wednesday", name: "Qigong at RIM",               desc: "Gentle movement and breath",    time: "10:00 AM",          fmt: "Online",              inperson: false },
              { day: "Thursday",  name: "Essential Dharma Study",      desc: "Teaching and dialogue",         time: "9:30 AM",           fmt: "Online",              inperson: false },
              { day: "Saturday",  name: "Meditation and Dharma Talk",  desc: "Guided sit and teaching",       time: "9:30 AM",           fmt: "In person & online",  inperson: true  },
              { day: "Sunday",    name: "Our Hearts Were Made for This",desc: "Lovingkindness practice",      time: "9:00 AM",           fmt: "Online",              inperson: false },
              { day: "Every day", name: "Silent Meditation",           desc: "Morning · Evening",             time: "6:30 AM · 7:30 PM", fmt: "Online",              inperson: false },
            ].map((row) => (
              <div key={row.day} className="hp-sched__row">
                <span className="hp-sched__day">{row.day}</span>
                <span className="hp-sched__program">
                  <strong>{row.name}</strong>
                  <span className="hp-sched__desc">{row.desc}</span>
                </span>
                <span className="hp-sched__time">{row.time}</span>
                <span className={`hp-sched__fmt${row.inperson ? " hp-sched__fmt--inperson" : ""}`}>
                  {row.fmt}
                </span>
              </div>
            ))}
          </div>
          <p className="hp-sched__note">
            New to meditation? <strong>Tuesdays</strong> and <strong>Saturdays</strong> are great places
            to start — both are offered in person at the center and online.
          </p>
          <Link href="/community-programs" className="hp-link">See All Programs →</Link>
        </div>
      </section>

      {/* ── Community Voices ────────────────────────────────── */}
      <section className="rim-section rim-section--white">
        <div className="rim-container">
          <h2 className="hp-voices__heading">What people find here</h2>
          <div className="hp-voices">
            <blockquote className="hp-voice">
              <p>"RIM has been a safe place for me to bring my anxiety and brokenness — to feel supported and okay. It is the only place I get to be not judged and not excluded. You allow me to show up with all my baggage and leave it here. Feeling lighter."</p>
              <footer>— Community member</footer>
            </blockquote>
            <blockquote className="hp-voice">
              <p>"I have not found anyone else who melds the philosophy of mindfulness with the practice itself. There are those who teach, those who do, and only one I have found who does both."</p>
              <footer>— Community member</footer>
            </blockquote>
            <blockquote className="hp-voice">
              <p>"After the first drop-in session, I knew I was home. The warm, welcoming, engaging community were where I wanted to grow my practice."</p>
              <footer>— Community member</footer>
            </blockquote>
          </div>
        </div>
      </section>

      {/* ── What You'll Find Here ───────────────────────────── */}
      <section className="rim-section rim-section--grey">
        <div className="rim-container">
          <h2 className="hp-paths__heading">Wherever you are, there's a place to practice</h2>
          <div className="hp-paths">
            <div className="hp-path">
              <h3 className="hp-path__name">Drop-In Sessions</h3>
              <p>The open door. Guided meditation, short teaching, time for questions. Come when you can,
              as often as you like. No commitment, no experience needed.</p>
            </div>
            <div className="hp-path">
              <h3 className="hp-path__name">Courses</h3>
              <p>Multi-week programs for those ready to go deeper. Foundations of Mindfulness is where
              most people begin. Each course builds a real practice — not just ideas, but skills you can use.</p>
            </div>
            <div className="hp-path">
              <h3 className="hp-path__name">Study &amp; Community Groups</h3>
              <p>Dharma study, book clubs, qigong, nature meditation, community service. For the
              practitioner who wants to keep going — and wants company on the way.</p>
            </div>
          </div>
          <div className="hp-paths__links">
            <Link href="/community-programs" className="hp-link">See All Programs →</Link>
            <Link href="/community-programs" className="hp-link">Upcoming Courses →</Link>
          </div>
        </div>
      </section>

      {/* ── The Teacher ─────────────────────────────────────── */}
      <section className="rim-section rim-section--white">
        <div className="rim-container rim-container--narrow">
          <h2>Meet Jesse</h2>
          <p>
            Jesse Foy is the founding and guiding teacher at Rooted in Mindfulness. He has practiced in
            the Insight Meditation tradition for more than two decades and draws from the earliest Buddhist
            texts, the Chan tradition of Silent Illumination, and a genuine love of making the teachings
            accessible to anyone who walks through the door.
          </p>
          <p>
            What his students tend to say is that he meets people where they are — and somehow makes the
            teaching feel both simple and real at the same time.
          </p>
          <Link href="/teachers" className="hp-link">About Our Teachers →</Link>
        </div>
      </section>

      {/* ── What We're Rooted In ────────────────────────────── */}
      <section className="rim-section rim-section--grey">
        <div className="rim-container rim-container--narrow">
          <h2>The tradition behind the practice</h2>
          <p>
            RIM is rooted in the earliest Buddhist teachings — the texts and practices that predate the
            many schools and traditions that came later. We also draw from the Chan practice of Silent
            Illumination, one of the clearest expressions of what sitting meditation is and does.
          </p>
          <p>
            We teach in plain, accessible language. You don't need to be Buddhist to practice here. You
            don't need to adopt a tradition or a belief system. The teaching is here to support your
            practice — not to stand between you and it.
          </p>
          <Link href="/diversity" className="hp-link">Our Approach to Diversity →</Link>
        </div>
      </section>

      {/* ── Three Circles ───────────────────────────────────── */}
      <section className="rim-section rim-section--teal">
        <div className="rim-container">
          <h2 className="hp-circles__heading">Why we practice together</h2>
          <div className="hp-circles">
            <div className="hp-circle">
              <h3 className="hp-circle__title">For yourself.</h3>
              <p>This is where practice begins — a steadier mind, a more open heart, a clearer way of being in your own life.</p>
            </div>
            <div className="hp-circle">
              <h3 className="hp-circle__title">For those you love.</h3>
              <p>What changes in you moves outward. The way you listen, the way you respond, the patience you bring home.</p>
            </div>
            <div className="hp-circle">
              <h3 className="hp-circle__title">For our shared world.</h3>
              <p>We don't practice only for ourselves. We practice because the world needs people who are present, compassionate, and willing to show up.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Dana ────────────────────────────────────────────── */}
      <section className="rim-section rim-section--white">
        <div className="rim-container rim-container--narrow">
          <h2>A generosity-based community</h2>
          <p>
            Everything at RIM is offered in the spirit of <em>dana</em> — a Pāli word meaning generosity
            of heart, mind, and action.
          </p>
          <p>
            In the Buddhist tradition, teachers offer their teachings freely, and the community supports
            the teachers and the center to the level of their ability. RIM follows this model. We don't
            charge fees or tuition. Instead, this community is sustained by the generosity of the people
            who practice here — through donations, volunteering, teaching, and showing up for one another.
          </p>
          <p><em>RIM is a 501(c)(3) nonprofit organization.</em></p>
          <div className="hp-dana__links">
            <Link href="/donate" className="hp-link">Give a Donation →</Link>
            <Link href="/volunteerism/volunteer" className="hp-link">Volunteer →</Link>
          </div>
        </div>
      </section>

      {/* ── Closing Invitation ──────────────────────────────── */}
      <section className="rim-section rim-section--grey">
        <div className="rim-container rim-container--narrow">
          <blockquote className="hp-closing">
            <p className="hp-closing__quote">
              "If something brought you here, that's enough. Come to a drop-in. Sit for an hour. See what you notice."
            </p>
            <footer className="hp-closing__attr">— Jesse</footer>
          </blockquote>
          <Link href="/community-programs" className="hp-link hp-closing__cta">
            This Week's Schedule →
          </Link>
        </div>
      </section>
    </>
  );
}
