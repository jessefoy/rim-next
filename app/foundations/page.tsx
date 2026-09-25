import Link from "next/link";

export const metadata = {
  title: "Foundations — Rooted In Mindfulness",
  description:
    "Foundations: finding your footing in meditation and mindful living at Rooted in Mindfulness in Brookfield, Wisconsin. A welcoming introduction for those beginning and those returning to the foundations of practice.",
};

/**
 * /foundations — where RIM encourages everyone to begin (2026-09-25).
 *
 * COPY SOURCE OF TRUTH: the Obsidian vault,
 *   Dharma Study/10 — Dharma Canon/CARE/4 Promotion/04-community-website-copy-2026-09-25.md
 * The opening paragraph is Jesse's own route text (program-description draft,
 * 2026-09-23). The questions carry the Taking CARE mock's answers on therapy,
 * difficult feelings, and belief; this is the page a skeptical first-timer
 * reads. Provisional until Jesse's read-aloud.
 *
 * ── PLACEHOLDER ────────────────────────────────────────────────────────────
 * "When and where" is holding text by Jesse's instruction (no official date
 * yet). Replace it with the format, dates, times, suggested contribution, and
 * how to register when they are set; if Foundations becomes a Program row,
 * link its /programs/[slug] page here.
 * ────────────────────────────────────────────────────────────────────────────
 */
const QUESTIONS = [
  {
    q: "Do I need meditation experience?",
    a: "No. Foundations is designed as a first door into practice, and it keeps deepening for people who have practiced for many years.",
  },
  {
    q: "Is this religious?",
    a: "Our practice comes from Buddhist meditation and is open to people of every faith and of none. It asks no belief. Its teachings are offered to be explored and tested in experience.",
  },
  {
    q: "Is this therapy?",
    a: "It is a practice of meditation and mindful living. It can support people through hard seasons, and it does not replace medical or mental health care.",
  },
  {
    q: "What if difficult feelings come up?",
    a: "Meditation can bring up difficult feelings and memories. They are part of human experience, and they are met with care, at a workable pace, with a teacher available to talk with. Anyone receiving mental health care is encouraged to speak with their provider before beginning.",
  },
  {
    q: "What does it cost?",
    a: "Foundations is offered through dana, the practice of generosity. A suggested amount will be listed so you can see what the offering takes to sustain, and no one is turned away.",
  },
] as const;

export default function FoundationsPage() {
  return (
    <div className="pp-page pp-page--spine fd-page">
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
              Foundations is a welcoming introduction to our practice through guided meditation,
              teaching, reflection, and conversation. It explores the foundations of practice and
              offers a first, whole experience of bringing them into everyday life. It is suitable
              for those beginning and for those wishing to revisit the foundations.
            </p>

            <h2>What it gives</h2>
            <p>
              Foundations is where we encourage everyone to begin. It offers a daily practice to
              keep, a shared language for the eight words of our practice, and time to name what
              brings you here and find it within what we share. The practice goes home with you
              between meetings, and when we gather again there is room to bring back what you
              found.
            </p>
          </div>

          {/* PLACEHOLDER — holding text until Foundations has a format and dates. */}
          <div className="pp-panel">
            <h2 className="pp-panel__title">When and where</h2>
            <p className="pp-panel__body">
              Our first Foundations offering begins in November. Dates, times, format, and
              registration will be posted here as soon as they are set.
            </p>
          </div>

          <div className="pp-prose">
            <p>
              Foundations is encouraged, and it is never required. Drop-in gatherings are open to
              anyone, any week.
            </p>

            <h2>Questions</h2>
            {QUESTIONS.map((item) => (
              <details key={item.q} className="pp-details">
                <summary className="pp-details__summary">{item.q}</summary>
                <div className="pp-details__body">
                  <p>{item.a}</p>
                </div>
              </details>
            ))}
          </div>

          <div className="pp-actions">
            <Link href="/this-week" className="pp-btn">
              This week&rsquo;s schedule
            </Link>
            <Link href="/your-first-visit" className="pp-link">
              Your first visit <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
