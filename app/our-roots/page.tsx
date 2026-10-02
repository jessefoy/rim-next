import Link from "next/link";

export const metadata = {
  title: "Our Roots - Rooted In Mindfulness",
  description:
    "Our roots in Chan, the Chinese school of Buddhism also known as Zen: the luminous mind, silent illumination, and care for the benefit of all, with A Handful of Leaves and Taking CARE, taught plainly for modern lives.",
};

/**
 * /our-roots — where the practice comes from (2026-09-25; rewritten
 * 2026-09-30, Revision 10; rewritten as a whole 2026-10-01, the integration
 * brief).
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/08-promotion-site-drafts-integration-2026-10-01.md
 * (Section 3, with E5 and E6 from Section 7), carried by the brief
 * 08-promotion-site-brief-integration-2026-10-01.md (A14). Provisional until
 * Jesse's read-aloud.
 *
 * Order: the shared Dharma (one living family), our own root in Chan (the
 * luminous mind, Buddha nature, silent illumination: the hall and the
 * orchestra is this page's one image), the bodhisattva, A Handful of Leaves
 * (one paragraph and a link; its story lives on /handful-of-leaves), Taking
 * CARE rooted in all of it, teaching for modern lives, and anyone.
 *
 * The Thich Nhat Hanh quotation and the closing "everyone who joins receives"
 * line left this page: the name stays in the Handful introduction, and the
 * closing line moved to /handful-of-leaves. Chan is a school; "tradition" is
 * the word for the wider families. Section ids come from the headings so other
 * pages can link to them.
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
            <h2 id="the-shared-dharma">The shared Dharma</h2>
            <p>
              The Buddha&apos;s teachings, the Dharma, have been practiced for twenty-five
              centuries. Over that time they grew into many traditions across Asia and now the
              West, each finding its own words for what the Buddha saw. We honor them as one living
              family. Each is complete in itself, and none is lessened by being honored alongside
              the others. We try to hold our own views, Buddhist ones included, lightly enough to
              keep learning and firmly enough to act on what we care about. People from every
              tradition, and from none, practice here, and whatever wisdom they bring keeps its
              place.
            </p>

            <h2 id="rooted-in-chan">Rooted in Chan</h2>
            <p>
              Within that family, our roots are in Chan, the Chinese school of Buddhism also known
              as Zen. One of the Buddha&apos;s earliest teachings says that the mind is luminous,
              clouded only by what passes through it. Chan understands this luminous, wakeful
              nature as Buddha nature. It is already present in each of us, clear and free, and it
              is the source of our capacity for wisdom and compassion. Practice is learning to
              recognize what clouds it and let it go, and to recognize, cultivate, and protect what
              helps us realize it, so that more and more of our life is lived from it.
            </p>
            <p>
              At the heart of our practice is silent illumination: an open, settled awareness that
              meets whatever arrives with warmth. A Chinese teacher named Hongzhi gave it that name
              nine centuries ago.
            </p>
            <p>
              It is less one technique than the ground under all of them. Loving-kindness,
              awareness of breathing, and the contemplation of change each have a long history of
              their own. They do not compete. This open awareness is not an instrument in the
              orchestra. It is the hall the music is played in.
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

            <h2 id="taking-care">Taking CARE, rooted in all of this</h2>
            <p>
              Taking CARE is how we practice all of this together. Its eight words carry the
              luminous mind, silent illumination, and the care of the bodhisattva into plain
              language anyone can begin with today. Behind each word stand teachings A Handful of
              Leaves gathers from across the traditions, so there is enough in them for a lifetime.
              Mindfulness-based programs and modern science help keep the practice practical, and
              the Dharma keeps it deep.
            </p>

            <h2 id="for-modern-lives">For modern lives</h2>
            <p>
              We teach for people living full lives, with work, families, and responsibilities, and
              we teach plainly and practically. Our teaching is informed by mindfulness-based
              programs, psychology, and modern science. Much of how we teach grew from years of
              teaching Mindfulness-Based Stress Reduction, so it will feel familiar if you came to
              meditation through a course, a class at work, or an app. Those doors are real doors;
              they led you here.
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
