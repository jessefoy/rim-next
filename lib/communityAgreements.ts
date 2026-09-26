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
/**
 * RIM's vision and mission — ONE source for every surface that states them
 * (About, the Our Shared Vision frame below and so all five agreement
 * surfaces; the home hero carries the triad). Jesse, 2026-09-26: "We are
 * repeating our vision and mission and pointing to capacity" (the Flock Not
 * Clock principle: vision is what we want to see and realize, mission the
 * repeated actions that bring it about). The vision is Jesse's arc of the
 * practice, near-verbatim (vault master reference, Sections 2 and 3).
 *
 * RIM_WHAT_BINDS is a HOLDING phrase: Jesse is still choosing the triad
 * (he said "views, skills, and habits"; he is weighing "views, states, and
 * habits", relatable and including actions). Change it here and every
 * surface follows. Provisional until Jesse's read-aloud.
 */
export const RIM_WHAT_BINDS = "unhealthy patterns of mind and action";

export const RIM_VISION =
  "To be more awake and present in our lives, and to live with greater " +
  "freedom from what binds us to " +
  RIM_WHAT_BINDS +
  ". This allows us to understand with greater wisdom, and what we " +
  "understand allows us to care with kindness and compassion. From that " +
  "awake, liberated wisdom and compassion we live, embody, and act: the " +
  "great wisdom, great compassion, and great action.";

export const RIM_MISSION =
  "We practice taking care, together and in our daily lives. We gather to " +
  "learn and practice, in person and online, and we support one another " +
  "along the way. We bring the practice into our lives, and our lives back " +
  "into the community. We hold our care agreements with one another. We " +
  "share the teachings through dana, sustained by the generosity of those " +
  "who practice here. And we carry the practice outward, to the people and " +
  "organizations it can serve.";

export const COMMUNITY_SHARED_VISION_TITLE = "Our Shared Vision";
/** The frame is the vision, stated as why we come together. */
export const COMMUNITY_AGREEMENTS_LEAD_IN =
  "We come together because wakefulness, wisdom, and compassion are already " +
  "within us, and because we want to live from them: to be more awake and " +
  "present in our lives, freer of what binds us to " +
  RIM_WHAT_BINDS +
  ", understanding with greater wisdom, caring with kindness and " +
  "compassion, and acting from that wisdom and compassion in ourselves, one " +
  "another, and our shared world. These agreements are how we care for that " +
  "vision together. We ask every member to hold them, as directions and not " +
  "as grades, and we return to them as a practice: honestly, and with room " +
  "to begin again.";

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
