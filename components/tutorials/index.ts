/**
 * Every tutorial at /tutorials, and the path through them (2026-10-21,
 * Jesse). Start here is the same for everyone, read in order; then each
 * team's own tutorials, in order. Jesse chose the four teams to cover now:
 * Hosting Team, Peer-Led Silent Meditation, Greeter, Audio/Visual.
 *
 * A new tutorial is one file beside this one (typed by ./types), added to
 * TUTORIALS and to the teams' paths that need it. Open to everyone but not
 * indexed, in no menu or footer and not in the sitemap: Jesse shares them by
 * link (whether some move behind sign-in is backlog 2026-10-21-001).
 */

import type { Tutorial } from "./types";
import { START_HERE_TUTORIALS } from "./startHere";
import { SCHEDULER_TUTORIALS } from "./schedulerTutorials";
import { ZOOM_TUTORIALS } from "./zoomTutorials";
import { LEAD_TUTORIALS } from "./leadTutorials";

export const TUTORIALS: Tutorial[] = [...START_HERE_TUTORIALS, ...SCHEDULER_TUTORIALS, ...ZOOM_TUTORIALS, ...LEAD_TUTORIALS];

/** Start here, in reading order. */
export const START_HERE = START_HERE_TUTORIALS.map((t) => t.slug);

/** Each team's own tutorials, in order, after Start here. `leads` are for
 *  the team's coordinators. */
export const TEAM_PATHS: { slug: string; name: string; line: string; tutorials: string[]; leads: string[] }[] = [
  {
    slug: "host-team",
    name: "Hosting Team",
    line: "You open and hold RIM's online sessions on Zoom.",
    tutorials: ["scheduler-for-hosts", "zoom-for-hosts"],
    leads: ["leading-your-team", "scheduler-for-leads"],
  },
  {
    slug: "peer-led-silent-meditation",
    name: "Peer-Led Silent Meditation",
    line: "You lead Good Morning and Good Evening Silent Meditation on Zoom.",
    tutorials: ["scheduler-for-guides", "zoom-for-guides"],
    leads: ["leading-your-team", "scheduler-for-leads"],
  },
  {
    slug: "greeter",
    name: "Greeter",
    line: "You welcome people at RIM's in-person sessions.",
    tutorials: ["scheduler-for-greeters"],
    leads: ["leading-your-team", "scheduler-for-leads"],
  },
  {
    slug: "audio-visual",
    name: "Audio/Visual",
    line: "You look after sound and video at RIM's in-person sessions.",
    tutorials: ["scheduler-for-av"],
    leads: ["leading-your-team", "scheduler-for-leads"],
  },
];

export function findTutorial(slug: string): Tutorial | undefined {
  return TUTORIALS.find((t) => t.slug === slug);
}
