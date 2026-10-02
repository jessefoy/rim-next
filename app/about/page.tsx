import Link from "next/link";
import { RIM_MISSION, RIM_VISION } from "@/lib/communityAgreements";
import { RIM_ADDRESS, RIM_PHONE_DISPLAY, RIM_PHONE_TEL, RIM_SUPPORT_EMAIL } from "@/lib/locations";

export const metadata = {
  title: "About RIM - Rooted In Mindfulness",
  description:
    "Rooted in Mindfulness is a community meditation center in Brookfield, Wisconsin, and a dharma community rooted in the Chan tradition. Our vision and mission, what we practice and why, and how we are held.",
};

/**
 * /about — who we are (rewritten 2026-09-30, Revision 10).
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/04-community-website-copy-2026-09-25.md
 * ("About RIM", Revision 10), carried by the brief
 * 08-promotion-site-brief-about-roots-2026-09-30.md. Provisional until Jesse's
 * read-aloud.
 *
 * One job per page: About says who we are and links out to the pages that
 * hold the detail (Taking CARE, Why We Practice, Our Roots, the donate and
 * volunteer pages, the teachers, New to RIM). It holds a summary, the vision
 * and mission, how RIM is held, the teachers, one short history paragraph, and
 * contact.
 *
 * The vision and the mission come from ONE source, lib/communityAgreements.ts
 * (never retyped here), so they read the same everywhere; /about#vision is
 * linked from the Kalyana Mitta guidelines. The address, phone and email come
 * from lib/locations.ts, the same constants the footer reads.
 */
export default function AboutPage() {
  return (
    <div className="pp-page pp-page--spine pp-page--column">
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">About RIM</p>
          <h1 className="pp-hero__title">Rooted in practice. Grown by community.</h1>
          <p className="pp-hero__body">Who we are, what we practice, and why.</p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-prose pp-prose--sections">
            <p>
              Rooted in Mindfulness is a community meditation center in Brookfield, Wisconsin,
              serving the Greater Milwaukee area and beyond, in person and online. We are a dharma
              community rooted in the Chan tradition, and Taking CARE is our root practice: an
              approach to meditation and mindful living plain enough to begin with and deep enough
              for a lifetime.
            </p>

            <h2>Our vision and mission</h2>
            <p>
              Our vision is what we hope to see realized in our lives and in the world. Our mission
              is what we do, again and again, to bring it about.
            </p>
            <div className="pp-quote pp-quote--set" id="vision">
              <p className="pp-quote__text">
                <strong>Our vision.</strong> {RIM_VISION}
              </p>
            </div>
            <div className="pp-quote pp-quote--set" id="mission">
              <p className="pp-quote__text">
                <strong>Our mission.</strong> {RIM_MISSION}
              </p>
            </div>

            <h2>What we practice, and why</h2>
            <p>
              We practice Taking CARE: eight words that describe one practice from eight sides,
              Calm, Connect, Aware, Attitude, Recognize, Remember, Embody, and Engage, practiced in
              the spirit of silent illumination, an open, settled awareness that meets whatever
              arrives with warmth.
            </p>
            <p>
              We practice to meet our lives with more clarity, freedom, and care: to enjoy what
              there is to enjoy, to meet what is hard without adding to it, and to care well for
              the people around us and the world we share.
            </p>
          </div>
          <div className="pp-actions">
            <Link href="/care" className="pp-btn">
              Taking CARE: how we practice
            </Link>
            <Link href="/why-we-practice" className="pp-btn pp-btn--ghost">
              Why we practice
            </Link>
          </div>

          <div className="pp-prose pp-prose--sections">
            <h2>Where it comes from</h2>
            <p>
              Our roots are in Chan, the Chinese school of Buddhism also known as Zen. We honor the
              whole of the Dharma, the Buddha&apos;s teachings, as one living family, and draw on
              it through A Handful of Leaves. We teach plainly, for people living full modern
              lives, and our teaching is informed by mindfulness-based programs, psychology, and
              modern science. People from every tradition, and from none, find support here.
            </p>
          </div>
          <div className="pp-actions">
            <Link href="/our-roots" className="pp-btn">
              Our roots
            </Link>
          </div>

          <div className="pp-prose pp-prose--sections">
            <h2>Held by a community</h2>
            <p>
              RIM is a nonprofit, and it is held by the people who practice here. Members sustain it
              through dana, the practice of generosity. Volunteers host our online gatherings, care
              for the center, and serve on our teams, and some train to share the practice. Our
              teachers offer what they have learned, and all of us hold the same{" "}
              <Link href="/community-care-agreements">Community Care Agreements</Link>. No one
              person or building holds it up.
            </p>
          </div>
          <div className="pp-actions">
            <Link href="/donate" className="pp-btn">
              Ways to give
            </Link>
            <Link href="/volunteerism/volunteer" className="pp-btn pp-btn--ghost">
              Volunteering
            </Link>
          </div>

          <div className="pp-prose pp-prose--sections">
            <h2>Our teachers</h2>
            <p>
              Jesse Foy, RIM&apos;s founding and guiding teacher, has been studying and practicing
              for over 25 years, with a mindfulness-based mind-body medical practice since 2006. He
              trained as an MBSR (Mindfulness-Based Stress Reduction) teacher through the Center
              for Mindfulness at the University of Massachusetts Medical School, and also studied
              Buddhism and contemplative psychology at Naropa University.
            </p>
          </div>
          <div className="pp-actions">
            <Link href="/teachers" className="pp-btn">
              Our teachers
            </Link>
          </div>

          <div className="pp-prose pp-prose--sections">
            <h2>How we began</h2>
            <p>
              RIM began with one intention: to make mindfulness and contemplative practice available
              in ways that hold up in an ordinary life. What started as classes became a community
              with a center of its own, and its Buddhist roots grew more visible along the way. One
              thing has not changed. The teachings have to be accessible enough to meet people
              where they are, and deep enough to accompany them for a lifetime.
            </p>

            <h2>Visit or reach us</h2>
            <p>
              Our center is at {RIM_ADDRESS}, and many of our gatherings also meet online. You can
              reach us at <a href={`mailto:${RIM_SUPPORT_EMAIL}`}>{RIM_SUPPORT_EMAIL}</a> or{" "}
              <a href={`tel:${RIM_PHONE_TEL}`}>{RIM_PHONE_DISPLAY}</a>.
            </p>
          </div>
          <div className="pp-actions">
            <Link href="/new-to-rim" className="pp-btn">
              New to RIM
            </Link>
            <Link href="/community-programs" className="pp-btn pp-btn--ghost">
              Programs &amp; events
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
