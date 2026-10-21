import type { ReactNode } from "react";

/** The two screens a tutorial is drawn for. */
export type TutorialDevice = "phone" | "computer";

/** One step's words. A tip opens with a short bold lead. */
export type TutorialStepText = {
  title: string;
  words: string;
  tip?: { lead: string; text: string };
  /** A way on from this step, such as the tutorial that picks up from here. */
  next?: { href: string; label: string };
  /** What the drawing shows, for a screen reader. */
  alt: string;
};

/** A step, with the words that differ on a computer. */
export type TutorialStep = TutorialStepText & {
  computer?: Partial<TutorialStepText>;
};

/** Plain reference below the steps, such as the list of emails. */
export type TutorialReference = {
  heading: string;
  intro?: string;
  groups: { title: string; items: { name: string; text: string }[] }[];
};

export type Tutorial = {
  slug: string;
  /** The heading on the index and the page. */
  title: string;
  /** Who it's for, said plainly (the page's eyebrow). */
  forWhom: string;
  summary: string;
  /** Start here's parts are read in order ("Start here · 2 of 4"). */
  series?: { name: string; part: number; of: number };
  /** The tutorial to read after this one, by slug. */
  nextTutorial?: string;
  steps: TutorialStep[];
  /** One drawing per step, in step order, for each screen. */
  screens: Record<TutorialDevice, ReactNode[]>;
  reference?: TutorialReference;
  /** The closing help, a few short paragraphs. */
  help: string[];
};
