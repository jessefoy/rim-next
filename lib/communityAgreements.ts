/**
 * Community Care Agreements — canonical text shared across every surface
 * that asks someone to commit to RIM's community ethos.
 *
 * Used by:
 *   - /community-care-agreements (public reading page)
 *   - /join (new-member threshold)
 *   - /account/welcome (post-sign-in welcome ritual fallback)
 *   - components/RegistrationForm.tsx (program registration)
 *
 * One agreement, four surfaces. Editing the text here changes it
 * everywhere, and keeping it that way is the point.
 *
 * The text no longer mirrors the legacy Webflow Community Membership page.
 * It was rewritten to carry the dana framing and the practice-of-returning
 * voice; this file is now the canonical source, not a copy of that page.
 */

export interface CommunityAgreement {
  title: string;
  /** Canonical community-facing agreement text. */
  summary: string;
}

/**
 * Page-opening copy for /join — the warm orientation that introduces what
 * RIM is before asking for anything.
 */
export const JOIN_HERO_TITLE = "Become a member";
export const JOIN_HERO_INTRO =
  "RIM is a refuge we create together: a place for learning, practice, " +
  "and honest friendship. Everyone is welcome, from all backgrounds and " +
  "phases of life. Come as you are.";

/**
 * Lead-in paragraph rendered immediately above the agreements list.
 * Same wording on every surface so the agreement feels like the same thing
 * wherever it appears.
 *
 * The count in this sentence tracks COMMUNITY_AGREEMENTS below — if the set
 * ever changes size, this line changes with it.
 */
export const COMMUNITY_AGREEMENTS_LEAD_IN =
  "These four intentions are all we ask of members. They are directions to " +
  "hold, not requirements to be graded on. We return to them as a practice: " +
  "honestly, and with room to begin again.";

/**
 * Form-section lead rendered above the form fields on /join. Tells the
 * reader why the form follows the agreements.
 */
export const JOIN_FORM_LEAD =
  "If you can hold these intentions with us, we would be honored to have you.";

/** Checkbox label next to the agreement-acceptance checkbox. */
export const COMMUNITY_AGREEMENTS_CHECKBOX_LABEL =
  "I'm entering this community in a spirit of care and respect.";

/**
 * The four agreements. Rendered as an ordered list on every surface;
 * each item carries a bold title and its agreement text.
 */
export const COMMUNITY_AGREEMENTS: CommunityAgreement[] = [
  {
    title: "Care for Yourself",
    summary:
      "We care for the conditions that help us see clearly and take responsibility for our own path. Teachers and community offer support, and the walking is ours to do.",
  },
  {
    title: "Care for Others",
    summary:
      "We care for one another through our presence, speech, and actions. Guided by goodwill, we listen deeply, speak truthfully and kindly, and seek not to cause harm.",
  },
  {
    title: "Care for RIM",
    summary:
      "RIM is held through dana, the practice of mutual generosity. Financial support meets the center’s practical needs and keeps the teachings freely offered. Time, care, and sincere presence in practice and learning nourish the life of the sangha. We trust each person to discern what is possible; no one is expected to offer in every way, and belonging is never measured by what or how much one gives.",
  },
  {
    title: "Care for Our Shared Vision",
    summary:
      "We let wisdom and compassion inform our actions, lessening suffering and nurturing well-being in ourselves, one another, those we love, and the world we share.",
  },
];
