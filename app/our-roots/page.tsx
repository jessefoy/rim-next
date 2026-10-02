import Link from "next/link";

export const metadata = {
  title: "Our Roots - Rooted In Mindfulness",
  description:
    "Buddhist teachings as one family of traditions, silent illumination at the heart of our practice, A Handful of Leaves, and Taking CARE, which grows from all of it. Taught for modern life, and open to anyone.",
};

/**
 * /our-roots — where the practice comes from (2026-09-25; rewritten
 * 2026-09-30, Revision 10; 2026-10-01, the integration brief; rewritten as a
 * whole again 2026-10-02, the history-and-roots brief).
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/08-promotion-site-drafts-integration-2026-10-01.md
 * (Section 8.6, which supersedes Section 3), carried by the brief
 * 08-promotion-site-brief-history-roots-2026-10-02.md (H6). Jesse approved
 * it 2026-10-02.
 *
 * Order: many traditions, one family; silent illumination at the heart of our
 * practice (the hall and the orchestra is this page's one image); the
 * bodhisattva; A Handful of Leaves (one paragraph and a link; its story lives
 * on /handful-of-leaves); Taking CARE, which grows from all of this; modern
 * life; and anyone. The vocabulary: the roots are the tradition, silent
 * illumination is the heart of the practice, and Taking CARE grows from the
 * roots. "Rooted in Chan" and "The shared Dharma" are retired as headings: RIM
 * is not strictly Chan. Section ids come from the headings so other pages can
 * link to them (Why We Practice links to #for-the-benefit-of-all).
 */
export default function OurRootsPage() {
  return (
    <div className="pp-page pp-page--spine pp-page--column">
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Where this comes from</p>
          <h1 className="pp-hero__title">Our Roots</h1>
          <p className="pp-hero__body">
            The tradition we practice in, the teachings we draw on, and how they meet a modern life.
          </p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-prose pp-prose--sections">
            <h2 id="many-traditions-one-family">Many traditions, one family</h2>
            <p>
              For twenty-five centuries, Buddhist teachings, the Dharma, have been practiced and
              passed on. Over that time they grew into many traditions across Asia and now the
              West, each finding its own words for the same understanding. We honor them as one
              living family. Each is complete in itself, and none is lessened by being honored
              alongside the others. We try to hold our own views, Buddhist ones included, lightly
              enough to keep learning and firmly enough to act on what we care about. People from
              every tradition, and from none, practice here, and whatever wisdom they bring keeps
              its place.
            </p>

            <h2 id="at-the-heart-of-our-practice">At the heart of our practice</h2>
            <p>
              At the heart of our practice is silent illumination: an open, settled awareness that
              meets whatever arrives with warmth. It comes to us from Chan, the Chinese school of
              Buddhism also known as Zen, where a teacher named Hongzhi gave it its name nine
              centuries ago.
            </p>
            <p>
              It is less one technique than the ground under all of them. Loving-kindness,
              awareness of breathing, and the contemplation of change each have a long history of
              their own. They do not compete. This open awareness is not an instrument in the
              orchestra. It is the hall the music is played in.
            </p>
            <p>
              Behind it is one of the Buddha&apos;s earliest teachings: the mind is luminous,
              clouded only by what passes through it. Chan understands this luminous, wakeful
              nature as Buddha nature. It is already present in each of us, clear and free, and it
              is the source of our capacity for wisdom and compassion. Practice is learning to
              recognize what clouds it and let it go, and to recognize, cultivate, and protect what
              helps us realize it, so that more and more of our life is lived from it.
            </p>

            <h2 id="for-the-benefit-of-all">For the benefit of all</h2>
            <p>
              Chan belongs to the Mahayana, the branch of Buddhism that holds up the bodhisattva:
              one who walks the path of awakening for the benefit of all beings, themselves
              included. We hold that spirit in an ordinary way. Our own well-being, the well-being
              of those we care about, and the health of our shared world are one work, and practice
              serves all three at once. In unsettled times, this is also how we keep from despair:
              tending what is ours to tend, together, and trusting that care reaches further than
              we can see. Each of us takes part as an honest participant, beginning where we are.
            </p>

            <h2 id="a-handful-of-leaves">A Handful of Leaves</h2>
            <p>
              We draw on the whole of this family through A Handful of Leaves. It takes its name
              from a day the Buddha held a few leaves in his hand and said that what he taught was
              like this handful: only what helps. It gathers teachings from the Buddha&apos;s
              earliest words, from the ways they grew through centuries of practice, and from the
              living traditions today, and orders them as a practicing life.{" "}
              <Link href="/handful-of-leaves">More about A Handful of Leaves</Link>
            </p>

            <h2 id="taking-care-grows-from-all-of-this">Taking CARE grows from all of this</h2>
            <p>
              Taking CARE is how we practice all of this together: a mindfulness-based program,
              true to the traditional wisdom and teachings it grows from. Its eight words carry the
              luminous mind, silent illumination, and the care of the bodhisattva into plain
              language anyone can begin with today. Behind each word stand teachings A Handful of
              Leaves gathers from across the traditions, so there is enough in them for a lifetime.
              What we learned from mindfulness-based teaching keeps the practice practical, and the
              Dharma keeps it deep.
            </p>

            <h2 id="for-modern-life">For modern life</h2>
            <p>
              We teach for people living full lives, with work, families, and responsibilities, and
              we teach plainly and practically. Our teaching is informed by mindfulness-based
              programs, psychology, and modern science. Much of how we teach grew from years of
              teaching Mindfulness-Based Stress Reduction,{" "}
              <Link href="/about#how-we-began">where RIM began</Link>, so it will feel familiar if
              you came to meditation through a course, a class at work, or an app. Those doors are
              real doors; they led you here.
            </p>

            <h2 id="for-anyone">For anyone</h2>
            <p>
              Buddhist, secular, spiritual, or undecided: people from all traditions and walks of
              life find support here. The door is the same, and so is the depth. Nothing here will
              ask you to believe anything. It will ask you to look.
            </p>
          </div>

          <div className="pp-actions">
            <Link href="/handful-of-leaves" className="pp-btn">
              A Handful of Leaves
            </Link>
            <Link href="/care" className="pp-btn pp-btn--ghost">
              Taking CARE: how we practice
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
