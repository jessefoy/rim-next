/**
 * Community Care Agreements — canonical text shared across every surface
 * that asks someone to commit to RIM's community ethos.
 *
 * Used by:
 *   - /join (new-member threshold)
 *   - /account/welcome (post-sign-in welcome ritual fallback)
 *   - components/RegistrationForm.tsx (program registration)
 *
 * One agreement, three surfaces. Editing the text here changes it
 * everywhere — keep it that way.
 *
 * Text mirrors the live Rooted In Mindfulness Community Membership page:
 * https://www.rootedinmindfulness.org/community-membership
 */

export interface CommunityAgreement {
  title: string;
  /** One-sentence framing. The agreement IS the sentence — keep it tight. */
  summary: string;
}

/**
 * Page-opening copy for /join — the warm orientation that introduces what
 * RIM is before asking for anything. Mirrors the Webflow hero verbatim.
 */
export const JOIN_HERO_TITLE = "Become a member";
export const JOIN_HERO_INTRO =
  "RIM is a refuge we create together — a place for learning, practice, " +
  "and genuine friendship. Everyone is welcome, from all backgrounds and " +
  "phases of life. Come as you are.";

/**
 * Lead-in paragraph rendered immediately above the agreements list.
 * Same wording on every surface so the agreement feels like the same thing
 * wherever it appears.
 */
export const COMMUNITY_AGREEMENTS_LEAD_IN =
  "We ask members to hold these four shared intentions, which together " +
  "create a safe and supportive environment for all.";

/**
 * Form-section lead rendered above the form fields on /join. Tells the
 * reader why the form follows the agreements.
 */
export const JOIN_FORM_LEAD =
  "If these intentions resonate with you, we'd be honored to have you join us.";

/** Checkbox label next to the agreement-acceptance checkbox. */
export const COMMUNITY_AGREEMENTS_CHECKBOX_LABEL =
  "I'm entering this community in a spirit of care and respect.";

/**
 * The four agreements. Rendered as an ordered list on every surface;
 * each item carries a bold title and a one-sentence summary.
 */
export const COMMUNITY_AGREEMENTS: CommunityAgreement[] = [
  {
    title: "Care for Yourself",
    summary:
      "Take responsibility for your own path. Teachers and community offer support and friendship, but the journey is yours to walk.",
  },
  {
    title: "Care for Others",
    summary:
      "Show up for one another. Your presence and goodwill are gifts to every member of this community.",
  },
  {
    title: "Care for RIM",
    summary:
      "RIM is 100% community-funded. We ask that all members contribute financially in a way that feels right to them.",
  },
  {
    title: "Care for Our Shared Vision",
    summary:
      "We practice to cultivate wisdom and compassion — for ourselves, each other, and all beings.",
  },
];
