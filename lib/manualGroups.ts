/**
 * Manual chapter groupings — for the volunteer manual index pages.
 *
 * The manual is organized by audience, not by feature. The shape:
 *   Welcome → For all volunteers → For each team → For members → About
 *
 * MANUAL_GROUPS lists the groups in display order. Each group lists its
 * chapter slugs in display order within the group. The groupManualSections
 * helper buckets a flat list of ManualSection records into these groups,
 * preserving order and sweeping orphans into a final "Other chapters"
 * bucket so nothing disappears if a chapter is added without being
 * registered here.
 *
 * To add a chapter to a group: add its slug to the group's slugs array.
 * To add a new group: append to MANUAL_GROUPS.
 */

export interface ManualGroup {
  id:           string;
  label:        string;
  description?: string;
  slugs:        string[];
}

export const MANUAL_GROUPS: ManualGroup[] = [
  {
    id:          "welcome",
    label:       "Welcome",
    description: "Start here.",
    slugs:       ["introduction"],
  },
  {
    id:          "all-volunteers",
    label:       "For all volunteers",
    description: "Things that work the same way no matter which team you're on.",
    slugs:       ["conversations", "volunteer-roles"],
  },
  {
    id:          "host-team",
    label:       "For the host team",
    description: "The host hub, the schedule, the session room, and team management.",
    slugs:       [
      "host-hub",
      "host-schedule",
      "host-session-room",
      "host-rotations",
      "host-hub-team-management",
    ],
  },
  {
    id:          "registration-team",
    label:       "For the registration team",
    description: "Programs and registration management.",
    slugs:       ["registration", "programs"],
  },
  {
    id:          "courses-team",
    label:       "For the courses team",
    description: "Course and lesson management.",
    slugs:       ["course-hub"],
  },
  {
    id:          "support-team",
    label:       "For the support team",
    description: "The shared inbox and support workflow.",
    slugs:       ["support-inbox"],
  },
  {
    id:          "members",
    label:       "For members",
    description: "What members see and do in their accounts.",
    slugs:       ["member-accounts"],
  },
  {
    id:          "about-this-manual",
    label:       "About this manual",
    description: "How the manual itself works.",
    slugs:       ["manual-system"],
  },
];

export interface SectionLite {
  slug:        string;
  title:       string;
  description: string | null;
  hubSlug:     string | null;
}

export interface GroupedSections<T extends SectionLite = SectionLite> {
  group:    ManualGroup;
  sections: T[];
}

/**
 * Bucket sections into groups, preserving group order and within-group
 * order defined by MANUAL_GROUPS.slugs. Sections not listed in any group
 * are collected into an "Other chapters" bucket at the end so a freshly
 * added chapter never disappears just because it isn't registered yet.
 */
export function groupManualSections<T extends SectionLite>(sections: T[]): GroupedSections<T>[] {
  const bySlug = new Map<string, T>(sections.map((s) => [s.slug, s] as const));
  const result: GroupedSections<T>[] = [];
  const used = new Set<string>();

  for (const group of MANUAL_GROUPS) {
    const groupSections = group.slugs
      .map((slug) => bySlug.get(slug))
      .filter((s): s is T => Boolean(s));
    if (groupSections.length === 0) continue;
    groupSections.forEach((s) => used.add(s.slug));
    result.push({ group, sections: groupSections });
  }

  const orphans = sections.filter((s) => !used.has(s.slug));
  if (orphans.length > 0) {
    result.push({
      group: {
        id:    "other",
        label: "Other chapters",
        slugs: orphans.map((s) => s.slug),
      },
      sections: orphans,
    });
  }

  return result;
}
