import Link from "next/link";
import { notFound } from "next/navigation";
import TutorialPlayer from "@/components/TutorialPlayer";
import { findTutorial } from "@/components/tutorials";
import { WATCH_READY, finishFor, stepsFor } from "@/components/tutorials/pageData";

/**
 * /tutorials/[slug]/watch: a tutorial played like a video, beside its
 * step-by-step page (2026-10-22, Jesse: "do a second page so that we don't
 * replace this one"). Captions only, by his choice. Only the tutorials in
 * WATCH_READY have one: Signing in first, to judge before the rest. Not
 * indexed.
 */

export function generateStaticParams() {
  return WATCH_READY.map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tutorial = findTutorial(slug);
  return {
    title: `${tutorial?.title ?? "Tutorial"}: watch it - Rooted In Mindfulness`,
    description: tutorial?.summary,
    robots: { index: false, follow: false },
  };
}

export default async function TutorialWatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tutorial = findTutorial(slug);
  if (!tutorial || !WATCH_READY.includes(slug)) notFound();
  const { finish } = finishFor(tutorial, true);

  return (
    <div className="pp-page pp-page--spine">
      <section className="pp-hero pp-hero--quiet">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">
            {tutorial.series ? `${tutorial.series.name} · ${tutorial.series.part} of ${tutorial.series.of}` : tutorial.forWhom}
          </p>
          <h1 className="pp-hero__title">{tutorial.title}</h1>
          <p className="pp-hero__body">Press Play and watch. Each step shows where to tap, then moves on by itself. You can pause at any time.</p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <TutorialPlayer
            steps={stepsFor(tutorial)}
            screens={tutorial.screens}
            finish={finish}
            stepByStepHref={`/tutorials/${tutorial.slug}`}
          />
          <p className="tut-help__back-row"><Link href="/tutorials" className="tut-help__back">← All tutorials</Link></p>
        </div>
      </section>
    </div>
  );
}
