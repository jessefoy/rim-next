import Link from "next/link";
import { RIM_MISSION, RIM_VISION } from "@/lib/communityAgreements";

export const metadata = {
  title: "About RIM — Rooted In Mindfulness",
  description:
    "The vision and mission of Rooted in Mindfulness, a dharma community rooted in traditional Buddhist wisdom, in Brookfield, Wisconsin, and held by the people who practice here.",
};

/**
 * /about — what RIM is for, how it is held, and how it began (2026-09-25,
 * revision 2).
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/04-community-website-copy-2026-09-25.md
 * Provisional until Jesse's read-aloud.
 *
 * Vision/mission-first at Jesse's direction, and not founder-centred: he
 * appears once, in one sentence of background. Vision before mission (Flock
 * Not Clock, Jesse 2026-09-26: vision is what we want to see and realize, the
 * mission is the repeated actions that bring it about); both come from ONE
 * source, lib/communityAgreements.ts, so they read the same everywhere.
 * "Held by a community" points to capacity: dana and volunteering. The founding dates the earlier
 * version flagged for verification are no longer stated.
 */
export default function AboutPage() {
  return (
    <div className="pp-page pp-page--spine pp-page--column">
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
            <h2 id="vision">Our vision</h2>
            <p>{RIM_VISION}</p>

            <h2 id="mission">Our mission</h2>
            <p>{RIM_MISSION}</p>

            <h2>Held by a community</h2>
            <p>
              RIM is a nonprofit, and it is held by the people who practice here. Members sustain it
              through <Link href="/donate">dana</Link>.{" "}
              <Link href="/volunteerism/volunteer">Volunteers</Link> greet newcomers, host our online
              gatherings, and look after the center and its teams. Our teachers offer what they have learned, and all of us
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
              roots became more visible too. Today RIM is a dharma community rooted in traditional
              Buddhist wisdom, practicing in the silent illumination tradition of Chan and drawing
              on the whole Buddhist tradition.
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
            <Link href="/new-to-rim" className="pp-btn pp-btn--ghost">
              New to RIM
            </Link>
            <Link href="/community-care-agreements" className="pp-btn pp-btn--ghost">
              Our Community Care Agreements
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
