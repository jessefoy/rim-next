import Link from "next/link";

export const metadata = {
  title: "Our Story — Rooted In Mindfulness",
  description:
    "How Rooted in Mindfulness began, what it became, and what has stayed the same: a Buddhist-rooted contemplative community in Brookfield, Wisconsin, open to anyone.",
};

/**
 * /about — where RIM came from, and what has not changed.
 *
 * ── PROVISIONAL COPY ─────────────────────────────────────────────────────────
 * Two historical claims below are Jesse's to confirm and are marked VERIFY in
 * the JSX: when RIM was founded, and when the center opened. The founder's
 * background (Naropa; MBSR teacher training at the UMass Center for
 * Mindfulness; a fifteen-plus-year mindfulness-based mind-body medical
 * practice) is taken from his live team page and is not in question.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Credentials appear here once, briefly. The house guide keeps them out of
 * teaching prose; an About page is the one place they belong.
 */
export default function AboutPage() {
  return (
    <div className="pp-page pp-page--spine">
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">About RIM</p>
          <h1 className="pp-hero__title">Rooted in practice. Grown by community.</h1>
          <p className="pp-hero__body">Where this community came from, and what has not changed.</p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-prose">
            {/* VERIFY — when RIM was founded. */}
            <p>
              Rooted in Mindfulness began with one intention: to make mindfulness and contemplative
              practice available to people in ways that could hold up in a real life.
            </p>
            {/* VERIFY — when the center opened. */}
            <p>
              The early work happened in medicine and in the community. Our founder and guiding
              teacher, Jesse Foy, spent more than fifteen years in a mindfulness-based mind-body
              medical practice and trained as a teacher of Mindfulness-Based Stress Reduction at
              the Center for Mindfulness at UMass Medical School, alongside a formal education in
              Buddhism and contemplative psychology at Naropa University. Later, a center of our
              own gave people somewhere not only to learn to meditate but to keep practicing
              together.
            </p>
            <p>
              Over the years that room became a community: sittings, friendships, classes,
              retreats, and the slow exploring of a contemplative life. And our own roots became
              more visible. The teaching here unites traditional Buddhist psychology and
              contemporary mindfulness-based approaches, and it draws on decades of meditation
              practice. Today RIM is a Buddhist nonprofit and a contemplative community.
            </p>
            <p>
              One thing has not changed. The teachings have to be accessible enough to meet people
              where they are, and deep enough to accompany them for a lifetime.
            </p>
            <p>
              For some, this is a place to learn mindfulness and find more steadiness in an
              ordinary week. For others it becomes a community they stay in for years. And for
              some it becomes a doorway into the Dharma, the Buddha&rsquo;s teachings, taken all
              the way. No one has to come in through the same door.
            </p>
            <p>
              What joins us is the practice of waking up to our lives, and learning to meet
              ourselves, one another, and the world with more wisdom and care. We ask four things
              of the people who join us, and every one of them begins with that word.
            </p>
          </div>

          <div className="pp-actions">
            <Link href="/care" className="pp-btn">
              How we practice: Taking care
            </Link>
            <Link href="/community-care-agreements" className="pp-link">
              Our Community Care Agreements <span aria-hidden="true">→</span>
            </Link>
            <Link href="/what-we-practice" className="pp-link">
              What we learn: A Handful of Leaves <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
