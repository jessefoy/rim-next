import { publicPageMetadata } from "@/lib/publicMetadata";
import Link from "next/link";
import { RIM_MISSION, RIM_VISION } from "@/lib/communityAgreements";

export const metadata = publicPageMetadata("About RIM — Rooted In Mindfulness", "Meet the community behind Rooted in Mindfulness in Brookfield and online: our shared CARE practice, purpose, teachers, volunteers, and ways to get in touch.", "/about");

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
            <p>
              Rooted in Mindfulness is a meditation community in Brookfield, Wisconsin, with
              gatherings at our center and online. <Link href="/care">CARE</Link> is our shared
              approach to learning and practice. We gather to understand our experience and bring
              greater care into our lives, relationships, and the world around us.
            </p>
            <h2 id="vision">Our vision</h2>
            <p>{RIM_VISION}</p>

            <h2 id="mission">Our mission</h2>
            <p>{RIM_MISSION}</p>

            <h2>People and responsibility</h2>
            <p>
              Our founding teacher, <Link href="/teachers/jesse-foy">Jesse Foy</Link>, teaches
              meditation and mindful living. Other teachers and community facilitators lead the
              offerings listed in our <Link href="/community-programs">program directory</Link>.
              Each program names the people guiding it and describes the practice they offer.
            </p>
            <p>
              Volunteers welcome people, host online gatherings, and look after the center.
              Members support this nonprofit through <Link href="/donate">generosity</Link>,
              including time and care as well as financial gifts. Our
              <Link href="/community-care-agreements"> Community Care Agreements</Link> guide
              how we take part together.
            </p>
            <p>
              For questions about the community or to raise a concern, contact
              <a href="mailto:support@rootedinmindfulness.org"> support@rootedinmindfulness.org</a>
              {" "}or call <a href="tel:4148828932">(414) 882-8932</a> and leave a message.
              The center is volunteer-operated. See our
              <Link href="/community-care-agreements#concerns"> guidance for raising a concern</Link>.
            </p>

            <h2>How we began</h2>
            <p>
              Rooted in Mindfulness began with one intention: to make mindfulness and contemplative
              practice available in ways that could hold up in an ordinary life. Its founding
              teacher, <Link href="/teachers/jesse-foy">Jesse Foy</Link>, came to this work through more than fifteen years of
              mindfulness-based work in medicine, training as a teacher of Mindfulness-Based Stress
              Reduction at UMass Medical School, and the study of Buddhism and contemplative
              psychology at Naropa University.
            </p>
            <p>
              A center of our own gave people somewhere not only to learn to meditate but to keep
              practicing together. Over the years that room became a community: sittings,
              friendships, classes, retreats, and the slow exploring of a contemplative life. Our
              teaching draws on Buddhist wisdom and the silent illumination tradition of Chan.
              A Handful of Leaves brings these traditional teachings into our exploration of CARE.
              <Link href="/our-roots"> Our Roots</Link> explains how they inform the practice.
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
