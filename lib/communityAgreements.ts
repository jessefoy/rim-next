/**
 * Community Care Agreements — canonical text shared across every surface
 * that asks someone to commit to RIM's community ethos.
 *
 * Used by:
 *   - /community-care-agreements (public reading page)
 *   - /account/community-care (member reading page)
 *   - /join (new-member threshold)
 *   - /account/welcome (post-sign-in welcome ritual fallback)
 *   - components/RegistrationForm.tsx (program registration)
 *
 * One agreement, five surfaces. Editing the text here changes it
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
 * The frame the agreements sit inside: Our Shared Vision. Rendered
 * immediately above the agreements list on every surface, as one paragraph
 * that opens with the bold title ("Our Shared Vision.") and continues with
 * the body. Same wording everywhere, so the agreement feels like the same
 * thing wherever it appears.
 *
 * Jesse, 2026-09-25: the shared vision frames the agreements rather than
 * standing fourth among them, "both a clear request and a kind,
 * compassionate, friendly, and safe invitation." The former fourth agreement
 * (Care for Our Shared Vision) is absorbed into this frame. Source of truth
 * for the wording: the vault's 04-community-website-copy-2026-09-25.md.
 * Provisional until Jesse's read-aloud.
 */
export const COMMUNITY_SHARED_VISION_TITLE = "Our Shared Vision";
export const COMMUNITY_AGREEMENTS_LEAD_IN =
  "We come together because wakefulness, wisdom, and compassion are already " +
  "within us, and because we want to live from them: to heal, promote, and " +
  "protect well-being in ourselves, one another, and our shared world. These " +
  "agreements are how we care for that vision together. We ask every member " +
  "to hold them, as directions and not as grades, and we return to them as a " +
  "practice: honestly, and with room to begin again.";

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
 * The three agreements, held inside the shared-vision frame above. Rendered
 * as an ordered list on every surface; each item carries a bold title and
 * its agreement text.
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
];
