/**
 * Program OFFERING: Category and Format (2026-10-02, the program-categories
 * brief). Two independent fields on every program, plus two checkboxes.
 *
 *   Category  Which way an offering belongs to: the three ways Taking CARE is
 *             offered (Foundations, Ongoing Learning & Practice, Immersion),
 *             the two public groups that sit outside them (Community Group,
 *             Special Event), and two internal values (Service, Private).
 *   Format    What kind of offering it is: drop-in, class, course, workshop,
 *             day of mindfulness, retreat. A Foundations workshop and an
 *             Immersion workshop are both workshops, so format is its own
 *             field, not a child of category. Required for the three ways.
 *   Silent meditation     (checkbox, drop-ins) the silent-sitting drop-ins, grouped
 *                         under "Silent meditation" within Ongoing Learning & Practice.
 *   Hosted by volunteers  (checkbox, any category) the label on cards and pages.
 *
 * These are NEW program-level fields. `Program.programFormat` already means
 * DELIVERY (in-person / virtual / hybrid); the Format here is stored as
 * `offeringFormat` so the two cannot be confused.
 *
 * Storage is a stable string CODE; the human LABEL lives here in code, so a
 * rename never touches the database (the same rule as lib/programKind.ts).
 *
 * WHAT FORMAT DECIDES: display only (the label on cards and pages, the drop-in
 * mark on This Week, and the "Simply arrive" line where registration is off).
 * WHAT IT NEVER CHANGES: a program's registration setting, the suggested
 * contribution, or the dana minimum (those are the program's own settings,
 * set by hand). The one rule that reads Format beyond display is
 * `isProgramOpenlyDroppable` below, which replaces the category `kind` rule
 * and gives the identical answer for every program that existed when the
 * fields were introduced.
 *
 * TRANSITION: until a program's own fields are filled, `resolveOffering`
 * derives them from the old `categoryId` (the slug map below), so the site
 * reads the same whichever order the code and the data arrive in. Once the
 * migration is verified, that fallback (LEGACY_BY_CATEGORY_SLUG and the
 * `category` branch of `resolveOffering`) is the only thing left to delete.
 */

import { isOpenlyDroppable } from "@/lib/programKind";

// ── Codes and labels ────────────────────────────────────────────────────────

export const OFFERING_CATEGORIES = [
  {
    code: "FOUNDATIONS",
    label: "Foundations",
    sectionTitle: "Foundations",
    anchor: "foundations",
    way: true,
    intro: "Where we encourage everyone to begin. First offered in November.",
  },
  {
    code: "ONGOING_LEARNING_PRACTICE",
    label: "Ongoing Learning & Practice",
    sectionTitle: "Ongoing Learning & Practice",
    anchor: "ongoing-learning-and-practice",
    way: true,
    intro:
      "Drop-ins, silent meditation, and courses through the week, in person and online. The drop-ins are open any week, and they are the easiest way in.",
  },
  {
    code: "IMMERSION",
    label: "Immersion",
    sectionTitle: "Immersion",
    anchor: "immersion",
    way: true,
    intro:
      "Workshops, days of mindfulness, and retreats, with time to settle more fully into the practice.",
  },
  {
    code: "COMMUNITY_GROUP",
    label: "Community Group",
    sectionTitle: "Community Groups",
    anchor: "community-groups",
    way: false,
    intro:
      "Groups led by members of our community, gathered around shared practice and interests.",
  },
  {
    code: "SPECIAL_EVENT",
    label: "Special Event",
    sectionTitle: "Special Events",
    anchor: "special-events",
    way: false,
    intro: undefined,
  },
  {
    // Kept for the engaged-practice avenue still to be designed. No public
    // section until a Service program is scheduled.
    code: "SERVICE",
    label: "Service (internal)",
    sectionTitle: "Service",
    anchor: "service",
    way: false,
    intro: undefined,
  },
  {
    // One-on-one sessions: never listed publicly.
    code: "PRIVATE",
    label: "Private (internal)",
    sectionTitle: "Private",
    anchor: "private",
    way: false,
    intro: undefined,
  },
] as const;

export type OfferingCategoryCode = (typeof OFFERING_CATEGORIES)[number]["code"];

export const OFFERING_FORMATS = [
  { code: "DROP_IN", label: "Drop-in" },
  { code: "CLASS", label: "Class" },
  { code: "COURSE", label: "Course" },
  { code: "WORKSHOP", label: "Workshop" },
  { code: "DAY_OF_MINDFULNESS", label: "Day of mindfulness" },
  { code: "RETREAT", label: "Retreat" },
] as const;

export type OfferingFormatCode = (typeof OFFERING_FORMATS)[number]["code"];

/** The public sections, in the order the programs page shows them. Service
    follows them only when a Service program is listed; Private never appears. */
export const PUBLIC_CATEGORY_ORDER: readonly OfferingCategoryCode[] = [
  "FOUNDATIONS",
  "ONGOING_LEARNING_PRACTICE",
  "IMMERSION",
  "COMMUNITY_GROUP",
  "SPECIAL_EVENT",
  "SERVICE",
];

/** The line under the "Silent meditation" subheading. */
export const SILENT_MEDITATION_LINE =
  "Silent sitting together on Zoom, mornings and evenings, hosted by volunteers from our community.";

export const HOSTED_BY_VOLUNTEERS_LABEL = "Hosted by volunteers";

const CATEGORY_CODES: readonly string[] = OFFERING_CATEGORIES.map((c) => c.code);
const FORMAT_CODES: readonly string[] = OFFERING_FORMATS.map((f) => f.code);

export function isOfferingCategory(code: unknown): code is OfferingCategoryCode {
  return typeof code === "string" && CATEGORY_CODES.includes(code);
}
export function isOfferingFormat(code: unknown): code is OfferingFormatCode {
  return typeof code === "string" && FORMAT_CODES.includes(code);
}

export function categoryInfo(code: string | null | undefined) {
  return OFFERING_CATEGORIES.find((c) => c.code === code) ?? null;
}
/** The category's name as a heading and breadcrumb (plural for the two groups). */
export function categorySectionTitle(code: string | null | undefined): string | null {
  return categoryInfo(code)?.sectionTitle ?? null;
}
export function categoryAnchor(code: string | null | undefined): string | null {
  return categoryInfo(code)?.anchor ?? null;
}
export function formatLabel(code: string | null | undefined): string | null {
  return OFFERING_FORMATS.find((f) => f.code === code)?.label ?? null;
}

/** Format is required for the three ways; optional for the rest. */
export function formatRequiredFor(category: string | null | undefined): boolean {
  return categoryInfo(category)?.way === true;
}

/** Programs in these categories carry the shared program block: the three
    ways, the silent sits included; not Community Groups or Special Events. */
export function showsSharedProgramBlock(category: string | null | undefined): boolean {
  return categoryInfo(category)?.way === true;
}

/** Categories that are listed publicly (Private never is). */
export function isPubliclyListedCategory(category: string | null | undefined): boolean {
  return !!category && category !== "PRIVATE";
}

// ── The old category, as a fallback ─────────────────────────────────────────

type Derived = {
  category: OfferingCategoryCode;
  format: OfferingFormatCode | null;
  silentMeditation: boolean;
  hostedByVolunteers: boolean;
};

/**
 * What each OLD program category (`ProgramCategory.slug`) means in the new
 * model, used only while a program's own fields are empty. Per-program
 * decisions (which of these is wrong for a given program) live in the
 * migration's mapping table, not here.
 */
const LEGACY_BY_CATEGORY_SLUG: Record<string, Derived> = {
  "drop-ins": { category: "ONGOING_LEARNING_PRACTICE", format: "DROP_IN", silentMeditation: false, hostedByVolunteers: false },
  "silent-meditation": { category: "ONGOING_LEARNING_PRACTICE", format: "DROP_IN", silentMeditation: true, hostedByVolunteers: true },
  "classes-courses-workshops": { category: "ONGOING_LEARNING_PRACTICE", format: "COURSE", silentMeditation: false, hostedByVolunteers: false },
  "retreats": { category: "IMMERSION", format: "RETREAT", silentMeditation: false, hostedByVolunteers: false },
  "community-groups-events": { category: "COMMUNITY_GROUP", format: null, silentMeditation: false, hostedByVolunteers: false },
  "events": { category: "SPECIAL_EVENT", format: null, silentMeditation: false, hostedByVolunteers: false },
  "community-service": { category: "SERVICE", format: null, silentMeditation: false, hostedByVolunteers: false },
  "private-sessions": { category: "PRIVATE", format: null, silentMeditation: false, hostedByVolunteers: false },
};

/** The old category slugs that mean `category` in the new model: the legacy
    half of a Prisma `where` (see `whereOfferingCategory`). */
export function legacySlugsFor(category: OfferingCategoryCode): string[] {
  return Object.entries(LEGACY_BY_CATEGORY_SLUG)
    .filter(([, d]) => d.category === category)
    .map(([slug]) => slug);
}

/**
 * A Prisma `where` fragment: programs whose Category is `category`, by their
 * own field or, while that is empty, by their old category.
 */
export function whereOfferingCategory(category: OfferingCategoryCode) {
  return {
    OR: [
      { offeringCategory: category },
      { offeringCategory: null, category: { slug: { in: legacySlugsFor(category) } } },
    ],
  };
}

// ── The resolver ─────────────────────────────────────────────────────────────

export type OfferingProgramLike = {
  offeringCategory?: string | null;
  offeringFormat?: string | null;
  silentMeditation?: boolean | null;
  hostedByVolunteers?: boolean | null;
  registrationEnabled?: boolean;
  /** The OLD category, while it still exists. */
  category?: { slug?: string | null; kind?: string | null } | null;
};

export type Offering = {
  category: OfferingCategoryCode | null;
  format: OfferingFormatCode | null;
  silentMeditation: boolean;
  hostedByVolunteers: boolean;
  /** Where the answer came from. */
  source: "program" | "legacy-category" | "none";
};

/** A program's Category, Format and checkboxes: its own fields when filled,
    otherwise derived from its old category, otherwise nothing. */
export function resolveOffering(p: OfferingProgramLike): Offering {
  if (isOfferingCategory(p.offeringCategory)) {
    return {
      category: p.offeringCategory,
      format: isOfferingFormat(p.offeringFormat) ? p.offeringFormat : null,
      silentMeditation: !!p.silentMeditation,
      hostedByVolunteers: !!p.hostedByVolunteers,
      source: "program",
    };
  }
  const legacy = p.category?.slug ? LEGACY_BY_CATEGORY_SLUG[p.category.slug] : undefined;
  if (legacy) return { ...legacy, source: "legacy-category" };
  return { category: null, format: null, silentMeditation: false, hostedByVolunteers: false, source: "none" };
}

// ── The droppable rule ───────────────────────────────────────────────────────

/**
 * Is this offering openly droppable: shown on My Home's Today with a public
 * Join for everyone, admitted at the Zoom door without registering, and shown
 * the "Simply arrive" line where registration is off?
 *
 * Replaces `isOpenlyDroppable(category.kind, registrationEnabled)`. For every
 * program that existed when the fields were introduced it gives the identical
 * answer (proved in the migration's before-and-after table):
 *
 *   Category Community Group  ->  open only when registration is off (an open
 *                                 circle like Recovery Dharma; a registered one
 *                                 like Qigong is a commitment)
 *   Category Special Event, Service, Private  ->  never (a commitment)
 *   Format Drop-in            ->  always open (as the old DROP_IN kind was)
 *   any other Format          ->  a commitment
 *
 * A program with nothing filled and no old category keeps the old fallback
 * ("no registration means drop-in"). A program not yet migrated is decided by
 * its old category kind, exactly as before.
 */
export function isProgramOpenlyDroppable(p: OfferingProgramLike): boolean {
  const registrationEnabled = !!p.registrationEnabled;
  if (isOfferingCategory(p.offeringCategory)) {
    if (p.offeringCategory === "COMMUNITY_GROUP") return !registrationEnabled;
    if (p.offeringCategory === "SPECIAL_EVENT" || p.offeringCategory === "SERVICE" || p.offeringCategory === "PRIVATE") {
      return false;
    }
    return p.offeringFormat === "DROP_IN";
  }
  return isOpenlyDroppable(p.category?.kind ?? null, registrationEnabled);
}

// ── Validation (editor and API) ──────────────────────────────────────────────

export type OfferingInput = {
  offeringCategory?: unknown;
  offeringFormat?: unknown;
  silentMeditation?: unknown;
  hostedByVolunteers?: unknown;
};

export type CleanOffering = {
  offeringCategory: OfferingCategoryCode;
  offeringFormat: OfferingFormatCode | null;
  silentMeditation: boolean;
  hostedByVolunteers: boolean;
};

/**
 * Check a Category and Format as the editor sends them. Category is required;
 * Format is required for the three ways and optional otherwise; Silent
 * meditation only applies to a Drop-in (cleared otherwise). Returns either the
 * clean values or a message in the editor's voice.
 */
export function cleanOffering(input: OfferingInput): { ok: true; value: CleanOffering } | { ok: false; error: string } {
  const category = typeof input.offeringCategory === "string" ? input.offeringCategory.trim() : "";
  const format = typeof input.offeringFormat === "string" ? input.offeringFormat.trim() : "";
  if (!category) return { ok: false, error: "Choose a category: which way this offering belongs to." };
  if (!isOfferingCategory(category)) return { ok: false, error: "That category is not one of the choices." };
  if (format && !isOfferingFormat(format)) return { ok: false, error: "That format is not one of the choices." };
  if (!format && formatRequiredFor(category)) {
    return { ok: false, error: "Choose a format: what kind of offering it is. Foundations, Ongoing Learning & Practice, and Immersion each need one." };
  }
  return {
    ok: true,
    value: {
      offeringCategory: category,
      offeringFormat: format ? (format as OfferingFormatCode) : null,
      silentMeditation: format === "DROP_IN" && input.silentMeditation === true,
      hostedByVolunteers: input.hostedByVolunteers === true,
    },
  };
}
