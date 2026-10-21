import Link from "next/link";
import { notFound } from "next/navigation";
import TutorialSteps from "@/components/TutorialSteps";
import { TUTORIALS, findTutorial } from "@/components/tutorials";
import type { TutorialStepText } from "@/components/tutorials/types";

/**
 * /tutorials/[slug]: one tutorial, step by step (components/TutorialSteps).
 * Not indexed, like the index (2026-10-21, Jesse).
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

  // The steps as plain text for each screen (a computer may say a few words
  // differently); the drawings go to the client as rendered markup.
  const plain = (s: TutorialStepText): TutorialStepText => ({
    title: s.title,
    words: s.words,
    alt: s.alt,
    ...(s.tip ? { tip: s.tip } : {}),
    ...(s.next ? { next: s.next } : {}),
  });
  const steps = {
    phone: tutorial.steps.map((s) => plain(s)),
    computer: tutorial.steps.map((s) => plain({ ...s, ...s.computer })),
  };

  return (
    <div className="pp-page pp-page--spine">
      <section className="pp-hero pp-hero--quiet">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">{tutorial.forWhom}</p>
          <h1 className="pp-hero__title">{tutorial.title}</h1>
          <p className="pp-hero__body">{tutorial.summary}</p>
        </div>
      </section>

      <section className="pp-section">
        <div className="rim-container">
          <p className="tut-note">The pictures are drawings of what you&rsquo;ll see. The names, dates and code in them are examples.</p>
          <TutorialSteps steps={steps} screens={tutorial.screens} />
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="tut-help">
            <h2>If you get stuck</h2>
            {tutorial.help.map((p) => <p key={p}>{p}</p>)}
            <p><Link href="/tutorials" className="tut-help__back">← All tutorials</Link></p>
          </div>
        </div>
      </section>
    </div>
  );
}
