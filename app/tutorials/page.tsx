import Link from "next/link";
import { TUTORIALS, TUTORIAL_TOPICS } from "@/components/tutorials";

/**
 * /tutorials: every tutorial, grouped by topic (2026-10-21, Jesse). Open to
 * everyone and not indexed; no menu, footer or sitemap link, since Jesse
 * shares tutorials by link as they're needed. See components/tutorials.
 */
export const metadata = {
  title: "Tutorials - Rooted In Mindfulness",
  description: "Step-by-step help with the RIM website, one screen at a time.",
  robots: { index: false, follow: false },
};

export default function TutorialsPage() {
  return (
    <div className="pp-page pp-page--spine">
      <section className="pp-hero pp-hero--quiet">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Help with the website</p>
          <h1 className="pp-hero__title">Tutorials</h1>
          <p className="pp-hero__body">Step-by-step help with the RIM website, one screen at a time.</p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container tut-index">
          {TUTORIAL_TOPICS.map((topic) => {
            const list = TUTORIALS.filter((t) => t.topic === topic);
            if (list.length === 0) return null;
            const id = `topic-${topic.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
            return (
              <section key={topic} className="tut-index__group" aria-labelledby={id}>
                <h2 id={id} className="tut-index__topic">{topic}</h2>
                <ul className="tut-index__list">
                  {list.map((t) => (
                    <li key={t.slug}>
                      <Link href={`/tutorials/${t.slug}`} className="tut-index__card">
                        <span className="tut-index__for">{t.forWhom}</span>
                        <span className="tut-index__title">{t.title}</span>
                        <span className="tut-index__summary">{t.summary}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
