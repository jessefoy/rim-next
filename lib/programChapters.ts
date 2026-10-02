/**
 * How the public catalog groups programs (2026-10-01, the integration brief,
 * A16 and A17). One map, read by the Programs & Events page (which chapter a
 * program is listed under) and by the program detail page (whether it carries
 * the shared block), so the two cannot drift.
 */

/**
 * The catalog is organized by the three ways Taking CARE is offered, then the
 * two kinds of gathering that stand apart (2026-10-01, the integration brief,
 * A16; words from the brief's Part B3). Program categories are the data; this
 * map says which chapter each category's programs appear in, by the category
 * slug (stable, unlike its display name). A visible category that is not
 * mapped here still renders, after these chapters, under its own heading, so a
 * category added in Program Manager is never silently missing.
 *
 *   Foundations            no category yet: one card, linking /foundations
 *   Ongoing Learning & Practice   drop-ins (the weekly gatherings), then "Silent meditation"
 *   Immersion              classes-courses-workshops, retreats
 *   Community Groups       community-groups-events
 *   Events                 events
 */
export type Chapter = {
  id: string;
  title: string;
  intro?: string;
  groups: { slugs: string[]; subheading?: string }[];
  /** Shown in place of the cards when nothing is listed. */
  emptyNote?: string;
  /** Keep the chapter (heading and introduction) when nothing is listed, because
      a door on the home page links to its anchor. */
  alwaysShow?: boolean;
};

export const CHAPTERS: Chapter[] = [
  {
    id: "ongoing-learning-and-practice",
    title: "Ongoing Learning & Practice",
    intro:
      "Drop-ins, silent meditation, and courses through the week, in person and online. The drop-ins are open any week, and they are the easiest way in.",
    groups: [{ slugs: ["drop-ins"] }, { slugs: ["silent-meditation"], subheading: "Silent meditation" }],
    alwaysShow: true,
  },
  {
    id: "immersion",
    title: "Immersion",
    intro:
      "Workshops, days of mindfulness, and retreats, with time to settle more fully into the practice.",
    groups: [{ slugs: ["classes-courses-workshops", "retreats"] }],
    emptyNote: "Upcoming dates will be listed here.",
  },
  {
    id: "community-groups",
    title: "Community Groups",
    intro:
      "Groups led by members of our community, gathered around shared practice and interests.",
    groups: [{ slugs: ["community-groups-events"] }],
  },
  {
    id: "events",
    title: "Events",
    groups: [{ slugs: ["events"] }],
  },
];

/** The chapters whose programs carry the shared program block: the "three
    ways" Taking CARE is offered (Foundations, which has no category yet,
    Ongoing Learning & Practice, and Immersion). Community Groups are member-led, with
    frames of their own, and Events stand apart. */
const SHARED_BLOCK_CHAPTER_IDS = new Set(["ongoing-learning-and-practice", "immersion"]);

export function showsSharedProgramBlock(categorySlug: string | null | undefined): boolean {
  if (!categorySlug) return false;
  return CHAPTERS.some(
    (chapter) =>
      SHARED_BLOCK_CHAPTER_IDS.has(chapter.id) &&
      chapter.groups.some((g) => g.slugs.includes(categorySlug))
  );
}
