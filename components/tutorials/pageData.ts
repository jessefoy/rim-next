/**
 * What a tutorial's two pages need from it: the step-by-step page
 * (app/tutorials/[slug]) and the watch page (app/tutorials/[slug]/watch). One
 * place, so the two never say different things.
 */

import type { Tutorial, TutorialStepText } from "./types";
import { findTutorial } from "./index";

/** Tutorials with a watch page (2026-10-22: Signing in first, to judge). */
export const WATCH_READY: string[] = ["signing-in"];

/** The steps as plain text for each screen (a computer may say a few words differently). */
export function stepsFor(tutorial: Tutorial) {
  const plain = (s: TutorialStepText): TutorialStepText => ({
    title: s.title,
    words: s.words,
    alt: s.alt,
    ...(s.tip ? { tip: s.tip } : {}),
    ...(s.next ? { next: s.next } : {}),
  });
  return {
    phone: tutorial.steps.map((s) => plain(s)),
    computer: tutorial.steps.map((s) => plain({ ...s, ...s.computer })),
  };
}

/** Where the end of a tutorial leads: the next one (its watch page when
 *  watching and there is one), the end of Start here to Find your team, or
 *  back to all of them. */
export function finishFor(tutorial: Tutorial, watching = false) {
  const next = tutorial.nextTutorial ? findTutorial(tutorial.nextTutorial) : undefined;
  const endOfSeries = !next && !!tutorial.series && tutorial.series.part === tutorial.series.of;
  const finish = next
    ? { href: `/tutorials/${next.slug}${watching && WATCH_READY.includes(next.slug) ? "/watch" : ""}`, label: "Next tutorial" }
    : endOfSeries
      ? { href: "/tutorials#find-your-team", label: "Find your team" }
      : { href: "/tutorials", label: "All tutorials" };
  return { next, endOfSeries, finish };
}
