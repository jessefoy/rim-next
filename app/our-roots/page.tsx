import Link from "next/link";

export const metadata = {
  title: "Our Roots — Rooted In Mindfulness",
  description:
    "The tradition Rooted in Mindfulness practices in: silent illumination, from Chan Buddhism, and A Handful of Leaves, the body of Buddhist teaching we draw on, informed by mindfulness-based programs and modern science. Open to anyone.",
};

/**
 * /our-roots — where the practice comes from (2026-09-25, revision 2). It
 * replaces /what-we-practice (A Handful of Leaves), which redirects here.
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/04-community-website-copy-2026-09-25.md
 * Provisional until Jesse's read-aloud.
 *
 * Why the change (Jesse, 2026-09-25): the old page led with a name the
 * average reader could not place. A Handful of Leaves is the container, the
 * body of teaching RIM draws on, and it sits inside a tradition. So this page
 * leads with the tradition (silent illumination, through Chan), then tells the
 * story of the name and says plainly what the handful is. The "ordered
 * structure" point that the session-174 page protected survives in one
 * sentence: the handful is ordered by what each teaching is for, so it can be
 * walked, not a collection. The seven-gathering count and the practice-shape
 * paragraph are left to the introduction itself.
 *
 * Image discipline: one image, the hall and the orchestra (it carries the
 * anti-eclecticism point). The leaves are the story of the name.
 */
export default function OurRootsPage() {
  return (
    <div className="pp-page pp-page--spine">
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Where this comes from</p>
          <h1 className="pp-hero__title">Our Roots</h1>
          <p className="pp-hero__body">
            The tradition we practice in, and the handful of teachings we draw on.
          </p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-prose">
            <h2>Silent illumination</h2>
            <p>
              At the heart of our practice is an old way of meditation called silent illumination:
              an open, settled awareness that meets whatever arrives with warmth. It comes to us
              through Chan, the Chinese meditation school that later became Zen, where a teacher
              named Hongzhi gave it its name some nine centuries ago.
            </p>
            <p>
              It is less one technique than the ground under all of them. Loving-kindness comes from
              one lineage, breath awareness from another, contemplation of change from a third. They
              do not compete. This open awareness is not an instrument in the orchestra. It is the
              hall the music is played in.
            </p>

            <h2>A handful of leaves</h2>
            <p>
              One afternoon, some twenty-five centuries ago, the Buddha was walking with his
              students through a grove of trees. He gathered a few fallen leaves into his hand and
              asked them which were more numerous, the leaves in his hand or the leaves in the
              forest above them. The answer was obvious, and so was the point. What he had come to
              understand was vast, like the forest. What he taught was like this handful: only what
              helps, only what leads to peace, to clear seeing, and to lives of wisdom and
              compassion.
            </p>
            <p>
              We took the name of the teaching we draw on from that afternoon. A Handful of Leaves
              gathers what helps from across the Buddhist traditions and orders it by what each
              teaching is for in a life of practice: why we begin, what holds us, what we meet in
              the mind, and what is finally seen. It replaces nothing and ranks nothing. It is
              ordered so that a person can walk it.
            </p>

            <h2>Why a handful</h2>
            <p>
              Every teaching of every Buddhist tradition is available to us at once: a retreat in
              one lineage, a book from another, an app teaching something adapted from all of them.
              That is a gift, and much of the time it is overwhelming. We meet the traditions
              broadly rather than deeply, and breadth without roots leaves even sincere
              practitioners holding valuable pieces with no way to put them together. Exposure
              everywhere, orientation nowhere. The handful is our answer to that.
            </p>

            <h2>Informed by modern understanding</h2>
            <p>
              Our teaching is also informed by mindfulness-based programs, psychology, and modern
              science. Much of how we teach grew from years of teaching Mindfulness-Based Stress
              Reduction, and it will feel familiar if you came to meditation through a course, a
              class at work, or an app. Those doors are real doors; they led you here.
            </p>

            <h2>For anyone</h2>
            <p>
              Buddhist, secular, spiritual, or undecided: the door is the same, and so is the depth.
              Nothing here will ask you to believe anything. It will ask you to look.
            </p>
            <p>
              Everyone who joins us receives the full introduction to the handful and the map of its
              teachings, and many people return to it for years.
            </p>
          </div>

          <div className="pp-actions">
            <Link href="/care" className="pp-btn">
              Taking Care: how we practice
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
