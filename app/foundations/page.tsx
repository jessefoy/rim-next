import Link from "next/link";

export const metadata = {
  title: "Foundations - Rooted In Mindfulness",
  description:
    "Foundations is where we encourage everyone to begin Taking CARE, our approach to meditation and mindful living. First offered in November 2026 in Brookfield, Wisconsin.",
};

/**
 * /foundations — where to begin (new, 2026-10-01, the integration brief, A12).
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/08-promotion-site-drafts-integration-2026-10-01.md
 * (Section 2). Provisional until Jesse's read-aloud.
 *
 * One bracketed [Jesse] note in the draft is left out of the page and listed
 * in the report: confirm that Foundations will list a suggested contribution
 * and turn no one away, since its format, and whether RIM pays a host, are not
 * yet decided.
 *
 * This is a static page standing in for a Program. A Foundations offering does
 * not exist in Program Manager yet; when it does, this page keeps its job (what
 * Foundations is) and the dated listing lives with the program. The "begins in
 * November" sentence is a dated fact to sweep on November 1 (UP_NEXT).
 *
 * The first button jumps to the footer's newsletter form (id="newsletter" in
 * components/Footer.tsx); the second goes to Taking CARE.
 */
export default function FoundationsPage() {
  return (
    <div className="pp-page pp-page--spine pp-page--column">
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Where to begin</p>
          <h1 className="pp-hero__title">Foundations</h1>
          <p className="pp-hero__body">Finding your footing in meditation and mindful living.</p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-prose">
            <p>
              Foundations is where we encourage everyone to begin. It is a welcoming introduction
              to Taking CARE, our root practice, through guided meditation, teaching, reflection,
              and conversation. No experience is needed.
            </p>
            <p>
              Taking CARE is offered in three ways, and Foundations is the first. From there,
              practice continues through Ongoing Practice, our drop-ins and courses through the
              week, and deepens through Immersion: workshops, days of mindfulness, and retreats.
            </p>
            <p>
              Our first Foundations offering begins in November. Its dates, times, and format will
              be listed here and in our newsletter as soon as they are set.
            </p>
            <p>
              Until then, every gathering is open to you.{" "}
              <Link href="/programs/meditation-and-dharma-talk">Meditation and Dharma Talk</Link>,
              on Saturday mornings, brings guided practice and a teaching together and makes a
              welcoming first visit.
            </p>
            <p>
              Like everything we offer, Foundations is given through dana, the practice of
              generosity. It will list a suggested contribution so everyone can see what it takes
              to sustain, and no one will be turned away for being unable to pay.{" "}
              <Link href="/donate#dana-at-rim">How dana works</Link>.
            </p>
          </div>

          <div className="pp-actions">
            <a href="#newsletter" className="pp-btn">
              Get the newsletter
            </a>
            <Link href="/care" className="pp-btn pp-btn--ghost">
              Taking CARE: how we practice
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
