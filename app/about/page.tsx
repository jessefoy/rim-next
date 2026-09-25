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
 * 2026-09-25: lineage stated as Jesse states it (Chan silent illumination,
 * the whole tradition through A Handful of Leaves); vision and mission added
 * as a set-apart panel. Source of truth for changed words: the vault's
 * 04-community-website-copy-2026-09-25.md.
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
              more visible. The teaching here is rooted in silent illumination, the meditation
              tradition of Chan Buddhism, and draws on the whole Buddhist tradition through A
              Handful of Leaves. Mindfulness-based programs, psychology, modern science, and
              decades of meditation practice inform it too. Today RIM is a Buddhist nonprofit and a dharma community.
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
              ourselves, one another, and the world with more wisdom and care. We ask the people
              who join us to hold one shared vision and three agreements, and every one of the
              agreements begins with that word.
            </p>
          </div>

          {/* Vision and mission, set apart for the readers who look for them
              (partners, funders, organizations). Master reference, Section 3. */}
          <div className="pp-panel ab-vision">
            <h2 className="pp-panel__title">Our vision</h2>
            <p className="pp-panel__body">
              People and communities living awake: less caught in the habits that cause suffering
              and harm, more able to live from the wisdom and care already within us, and sharing
              true well-being with those we love and the world we share.
            </p>
            <h2 className="pp-panel__title ab-vision__second">Our mission</h2>
            <p className="pp-panel__body">
              Rooted in Mindfulness is a community where people learn and practice together to
              live awake in everyday life. Through our practice of taking care, and the support of
              one another, we learn to see clearly, to free ourselves from harmful habits, and to
              heal, promote, and protect well-being in ourselves, one another, and our shared
              world. We bring this practice into our lives and our lives into our community, and we
              carry it outward to others who can benefit.
            </p>
          </div>

          <div className="pp-actions">
            <Link href="/why-we-practice" className="pp-btn">
              Why we practice
            </Link>
            <Link href="/care" className="pp-link">
              How we practice: Taking Care <span aria-hidden="true">→</span>
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
