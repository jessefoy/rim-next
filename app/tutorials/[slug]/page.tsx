import Link from "next/link";
import { notFound } from "next/navigation";
import TutorialSteps from "@/components/TutorialSteps";
import { TUTORIALS, findTutorial } from "@/components/tutorials";
import { WATCH_READY, finishFor, stepsFor } from "@/components/tutorials/pageData";

/**
 * /tutorials/[slug]: one tutorial, step by step (components/TutorialSteps).
 * Not indexed, like the index (2026-10-21, Jesse). A tutorial in a series
 * says where it sits ("Start here · 2 of 4"), and every tutorial ends with
 * the one to read next, so no one has to find their way back to the list.
 */

export function generateStaticParams() {
  return TUTORIALS.map((t) => ({ slug: t.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tutorial = findTutorial(slug);
  return {
    title: `${tutorial?.title ?? "Tutorial"} - Rooted In Mindfulness`,
    description: tutorial?.summary,
    robots: { index: false, follow: false },
  };
}

export default async function TutorialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tutorial = findTutorial(slug);
  if (!tutorial) notFound();
  // The steps as plain text for each screen; the drawings go to the client
  // as rendered markup. The end of Start here leads on to Find your team.
  const steps = stepsFor(tutorial);
  const { next, endOfSeries, finish } = finishFor(tutorial);

  return (
    <div className="pp-page pp-page--spine">
      <section className="pp-hero pp-hero--quiet">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">
            {tutorial.series ? `${tutorial.series.name} · ${tutorial.series.part} of ${tutorial.series.of}` : tutorial.forWhom}
          </p>
          <h1 className="pp-hero__title">{tutorial.title}</h1>
          <p className="pp-hero__body">{tutorial.summary}</p>
        </div>
      </section>

      <section className="pp-section">
        <div className="rim-container">
          {WATCH_READY.includes(tutorial.slug) && (
            <p className="tut-watch-link">
              <Link href={`/tutorials/${tutorial.slug}/watch`} className="pp-btn pp-btn--ghost"><span aria-hidden="true">{"\u25B6\uFE0E"}</span> Watch it as a video</Link>
            </p>
          )}
          <p className="tut-note">The pictures are drawings of what you&rsquo;ll see. The names, dates and code in them are examples.</p>
          <TutorialSteps steps={steps} screens={tutorial.screens} finish={finish} />
        </div>
      </section>

      {tutorial.reference && (
        <section className="pp-section pp-section--white">
          <div className="rim-container">
            <div className="tut-ref">
              <h2>{tutorial.reference.heading}</h2>
              {tutorial.reference.intro && <p className="tut-ref__intro">{tutorial.reference.intro}</p>}
              {tutorial.reference.groups.map((g) => (
                <section key={g.title} className="tut-ref__group">
                  <h3>{g.title}</h3>
                  <dl>
                    {g.items.map((item) => (
                      <div key={item.name} className="tut-ref__item">
                        <dt>{item.name}</dt>
                        <dd>{item.text}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="tut-help">
            {endOfSeries && (
              <div className="tut-next">
                <p className="tut-next__label">Next</p>
                <Link href="/tutorials#find-your-team" className="tut-next__card">
                  <span className="tut-next__title">Find your team</span>
                  <span className="tut-next__summary">That&rsquo;s Start here done. Your team&rsquo;s own tutorials are next: the Scheduler, and Zoom if you lead sessions.</span>
                  <span className="tut-next__go">Find your team →</span>
                </Link>
              </div>
            )}
            {next && (
              <div className="tut-next">
                <p className="tut-next__label">Next tutorial</p>
                <Link href={`/tutorials/${next.slug}`} className="tut-next__card">
                  <span className="tut-next__title">{next.title}</span>
                  <span className="tut-next__summary">{next.summary}</span>
                  <span className="tut-next__go">Start →</span>
                </Link>
              </div>
            )}
            <h2>If you get stuck</h2>
            {tutorial.help.map((p) => <p key={p}>{p}</p>)}
            <p><Link href="/tutorials" className="tut-help__back">← All tutorials</Link></p>
          </div>
        </div>
      </section>
    </div>
  );
}
