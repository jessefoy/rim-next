import Link from "next/link";

export const metadata = {
  title: "About RIM — Rooted In Mindfulness",
  description:
    "The mission and vision of Rooted in Mindfulness, a Buddhist nonprofit and dharma community in Brookfield, Wisconsin, held by the people who practice here.",
};

/**
 * /about — what RIM is for, how it is held, and how it began (2026-09-25,
 * revision 2).
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/04-community-website-copy-2026-09-25.md
 * Provisional until Jesse's read-aloud.
 *
 * Mission-first at Jesse's direction ("more vision/mission-focused"), and not
 * founder-centred: he appears once, in one sentence of background, which
 * newcomers and partner organizations reasonably look for. Mission and vision
 * are the master reference's Section 3 drafts. The founding dates the earlier
 * version flagged for verification are no longer stated.
 */
export default function AboutPage() {
  return (
    <div className="pp-page pp-page--spine">
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">About RIM</p>
          <h1 className="pp-hero__title">Rooted in practice. Grown by community.</h1>
          <p className="pp-hero__body">What we are for, and how this community came to be.</p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-prose">
            <h2>Our mission</h2>
            <p>
              Rooted in Mindfulness is a community where people learn and practice together to live
              awake in everyday life. Through our practice of taking care, and the support of one
              another, we learn to see clearly, to free ourselves from harmful habits, and to heal,
              promote, and protect well-being in ourselves, one another, and our shared world. We
              bring this practice into our lives and our lives into our community, and we carry it
              outward to others who can benefit.
            </p>

            <h2>Our vision</h2>
            <p>
              People and communities living awake: less caught in the habits that cause suffering
              and harm, more able to live from the wisdom and care already within us, and sharing
              true well-being with those we love and the world we share.
            </p>

            <h2>Held by a community</h2>
            <p>
              RIM is a nonprofit, and it is held by the people who practice here. Members sustain it
              through dana. Volunteers greet newcomers, host our online gatherings, and look after
              the center and its teams. Our teachers offer what they have learned, and all of us
              hold the same <Link href="/community-care-agreements">care agreements</Link>. No one
              person or building holds it up.
            </p>

            <h2>How we began</h2>
            <p>
              Rooted in Mindfulness began with one intention: to make mindfulness and contemplative
              practice available in ways that could hold up in an ordinary life. Its founding
              teacher, Jesse Foy, came to this work through more than fifteen years of
              mindfulness-based work in medicine, training as a teacher of Mindfulness-Based Stress
              Reduction at UMass Medical School, and the study of Buddhism and contemplative
              psychology at Naropa University.
            </p>
            <p>
              A center of our own gave people somewhere not only to learn to meditate but to keep
              practicing together. Over the years that room became a community: sittings,
              friendships, classes, retreats, and the slow exploring of a contemplative life. Our
              roots became more visible too. Today RIM is a Buddhist nonprofit and a dharma
              community, rooted in the silent illumination tradition of Chan and drawing on the
              whole Buddhist tradition.
            </p>
            <p>
              One thing has not changed. The teachings have to be accessible enough to meet people
              where they are, and deep enough to accompany them for a lifetime.
            </p>
          </div>

          <div className="pp-actions">
            <Link href="/why-we-practice" className="pp-btn">
              Why we practice
            </Link>
            <Link href="/new-to-rim" className="pp-link">
              New to RIM <span aria-hidden="true">→</span>
            </Link>
            <Link href="/community-care-agreements" className="pp-link">
              Our Community Care Agreements <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
