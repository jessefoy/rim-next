/**
 * Every tutorial at /tutorials (2026-10-21, Jesse: "I think I would like to
 * add more of these"). A new tutorial is one file beside this one (its steps
 * and drawings, typed by ./types) added to TUTORIALS, with its topic in
 * TUTORIAL_TOPICS. Open to everyone but not indexed, in no menu or footer and
 * not in the sitemap: Jesse shares them by link (whether some move behind
 * sign-in is backlog 2026-10-21-001).
 */

import type { Tutorial } from "./types";
import { gettingStartedForGuides } from "./gettingStartedForGuides";

/** The index's groups, in order. */
export const TUTORIAL_TOPICS = ["Leading a session"] as const;

export const TUTORIALS: Tutorial[] = [gettingStartedForGuides];

export function findTutorial(slug: string): Tutorial | undefined {
  return TUTORIALS.find((t) => t.slug === slug);
}
