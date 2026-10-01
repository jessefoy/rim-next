import Link from "next/link";

export const metadata = {
  title: "Our Roots - Rooted In Mindfulness",
  description:
    "The Dharma as one living family, our roots in Chan, A Handful of Leaves, and Taking CARE, rooted in all of it. Taught plainly for modern lives, informed by mindfulness-based programs and science, and open to anyone.",
};

/**
 * /our-roots — where the practice comes from (2026-09-25; rewritten
 * 2026-09-30, Revision 10). It replaced /what-we-practice (A Handful of
 * Leaves), which redirects here.
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/04-community-website-copy-2026-09-25.md
 * ("Our Roots", Revision 10), carried by the brief
 * 08-promotion-site-brief-about-roots-2026-09-30.md. Provisional until Jesse's
 * read-aloud.
 *
 * Order: the shared Dharma (one living family, in the spirit of Thich Nhat
 * Hanh and the Order of Interbeing), our own root in Chan, the Handful of
 * Leaves (the story and what it is; "why a handful" is folded in), Taking CARE
 * rooted in all of it, teaching for modern lives, and anyone.
 *
 * Image discipline: one image, in words: the hall and the orchestra, in
 * "Rooted in Chan" (it carries the anti-eclecticism point). The leaves are the
 * story of the name. The Order of Interbeing's first mindfulness training is
 * an inline quotation inside its sentence, not a pull quote.
 *
 * Open for Jesse's ear: keeping that quotation; the Mahayana line in "Rooted
 * in Chan".
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
            <h2>The shared Dharma</h2>
            <p>
              Over twenty-five centuries, the Buddha&apos;s teachings, the Dharma, have grown into
              many traditions across Asia and now the West. We honor them as one living family. Each
              is complete in itself, and none is diminished by being honored alongside the others.
              Thich Nhat Hanh and the Order of Interbeing express this spirit well: the first of
              their mindfulness trainings asks us not to be &quot;bound to any doctrine, theory, or
              ideology, even Buddhist ones.&quot; We practice in that spirit. People from every
              tradition, and from none, find a place here, and whatever wisdom they bring keeps its
              honored place.
            </p>

            <h2>Rooted in Chan</h2>
            <p>
              Within that family, our own roots are in Chan, the Chinese meditation tradition also
              known as Zen, part of the Mahayana stream of Buddhism, which speaks of a wakeful and
              caring nature, Buddha nature, already present in each of us. At the heart of our
              practice is silent illumination: an open, settled awareness that meets whatever
              arrives with warmth. A teacher named Hongzhi gave it its name some nine centuries ago.
            </p>
            <p>
              It is less one technique than the ground under all of them. Loving-kindness,
              awareness of breathing, and the contemplation of change each have a long history of
              their own. They do not compete. This open awareness is not an instrument in the
              orchestra. It is the hall the music is played in.
            </p>

            <h2>A handful of leaves</h2>
            <p>
              One afternoon, some twenty-five centuries ago, the Buddha was walking with his
              students through a grove of trees. He gathered a few fallen leaves into his hand and
              asked them which were more numerous, the leaves in his hand or the leaves in the
              forest above them. What he had come to understand was vast, like the forest. What he
              taught was like this handful: only what helps, only what leads to peace, to clear
              seeing, and to lives of wisdom and compassion.
            </p>
            <p>
              Today every teaching of every tradition is available to us at once, and much of the
              time it is overwhelming: exposure everywhere, orientation nowhere. A Handful of Leaves
              is our answer. It gathers the working teachings of a practicing life from across the
              traditions and orders them by what each is for: why we begin, what holds us, what we
              meet in the mind, where and how we look, and what is finally seen. It replaces nothing
              and ranks nothing. It is ordered so that a person can walk it.
            </p>

            <h2>Taking CARE, rooted in all of this</h2>
            <p>
              Taking CARE, our root practice, grows from this ground. Its eight words are plain
              enough to begin with today, and each is rooted in teachings the traditions have
              carried for centuries, so there is enough in them for a lifetime of practice. A
              Handful of Leaves is where we go deeper: the wider body of teaching that supports and
              enriches the practice of CARE.
            </p>

            <h2>For modern lives</h2>
            <p>
              We teach for people living full lives, with work, families, and responsibilities, and
              we teach plainly and practically. Our teaching is informed by mindfulness-based
              programs, psychology, and modern science. Much of how we teach grew from years of
              teaching Mindfulness-Based Stress Reduction, so it will feel familiar if you came to
              meditation through a course, a class at work, or an app. Those doors are real doors;
              they led you here.
            </p>

            <h2>For anyone</h2>
            <p>
              Buddhist, secular, spiritual, or undecided: people from all traditions and walks of
              life find support here. The door is the same, and so is the depth. Nothing here will
              ask you to believe anything. It will ask you to look.
            </p>
            <p>
              Everyone who joins us receives the full introduction to A Handful of Leaves and the
              map of its teachings, and many people return to them for years.
            </p>
          </div>

          <div className="pp-actions">
            <Link href="/care" className="pp-btn">
              Taking CARE: how we practice
            </Link>
            <Link href="/new-to-rim" className="pp-btn pp-btn--ghost">
              New to RIM
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
