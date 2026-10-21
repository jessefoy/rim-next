import type { ReactNode } from "react";

/** The two screens a tutorial is drawn for. */
export type TutorialDevice = "phone" | "computer";

/** One step's words. A tip opens with a short bold lead. */
export type TutorialStepText = {
  title: string;
  words: string;
  tip?: { lead: string; text: string };
  /** What the drawing shows, for a screen reader. */
  alt: string;
};

/** A step, with the words that differ on a computer. */
export type TutorialStep = TutorialStepText & {
  computer?: Partial<TutorialStepText>;
};

export type Tutorial = {
  slug: string;
  /** The heading on the index and the page. */
  title: string;
  /** Who it's for, said plainly (the page's eyebrow). */
  forWhom: string;
  summary: string;
  /** The index groups tutorials by topic (TUTORIAL_TOPICS, in order). */
  topic: string;
  steps: TutorialStep[];
  /** One drawing per step, in step order, for each screen. */
  screens: Record<TutorialDevice, ReactNode[]>;
  /** The closing help, a few short paragraphs. */
  help: string[];
};
