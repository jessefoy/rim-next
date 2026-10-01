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
  "and fellowship. Everyone is welcome, from all backgrounds and " +
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
 * (Care for Our Shared Vision) is absorbed into this frame.
 *
 * Source of truth for the frame and the three agreements: the vault's
 * 04-community-website-copy-2026-09-25.md, section "The Community Care
 * Agreements", revised and approved by Jesse on 2026-09-28 ("I do like the
 * agreements that you wrote"); implemented from Addendum A of
 * 08-promotion-site-brief-home-2026-09-28.md.
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
 * The mission is right effort in Jesse's terms (know ourselves, cultivate what
 * is healthy and wholesome, release what binds), the repeated actions of Flock
 * Not Clock. Jesse approved the current mission on 2026-09-30, replacing the
 * 2026-09-26 draft.
 *
 * RIM_WHAT_BINDS is final: Jesse ruled on 2026-09-30 that "unhealthy patterns
 * of mind and action" is the phrase. It is no longer a holding phrase. Change
 * it here and every surface follows. Provisional until Jesse's read-aloud.
 */
export const RIM_WHAT_BINDS = "unhealthy patterns of mind and action";

export const RIM_VISION =
  "To be more awake and present in our lives, and to live with greater " +
  "freedom from what binds us to " +
  RIM_WHAT_BINDS +
  ". This allows us to understand with greater wisdom, and what we " +
  "understand allows us to care with kindness and compassion. From that " +
  "awake, liberated wisdom and compassion we live, embody, and act, for the " +
  "benefit of ourselves, those we care about, and our shared world. This is " +
  "the great wisdom, great compassion, and great action.";

export const RIM_MISSION =
  "Together and in our daily lives, we practice taking care: coming to know " +
  "ourselves as we are, cultivating what is healthy and wholesome, and " +
  "releasing the patterns of clinging, view, habit, and reaction that bind " +
  "us, so that we realize the wakeful nature already within us. We carry " +
  "this practice into every moment of contact, for the benefit of " +
  "ourselves, those we care about, and our shared world.";

export const COMMUNITY_SHARED_VISION_TITLE = "Our Shared Vision";
/** The frame is the vision, stated as why we come together. */
export const COMMUNITY_AGREEMENTS_LEAD_IN =
  "We come together because wakefulness, wisdom, and compassion are already " +
  "within each of us, and we want to live from them. We practice to be more " +
  "awake and present in our lives, freer of what binds us to " +
  RIM_WHAT_BINDS +
  ", understanding with greater wisdom, caring with kindness and " +
  "compassion, and acting from both, for the benefit of ourselves, those we " +
  "care about, and our shared world. These agreements are how we care for " +
  "that vision together. We ask everyone who takes part to hold them. They " +
  "are directions to hold, not requirements to be graded on, and we return " +
  "to them as a practice: honestly, and with room to begin again.";

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
      "We care for the conditions that help us see clearly and live well, and we take responsibility for our own path: coming to know ourselves, cultivating what is healthy and wholesome, and letting go of what harms. We come with a sincere wish to practice, as the practice is offered here. Teachers and community offer support, and the walking is ours to do.",
  },
  {
    title: "Care for Others",
    summary:
      "We care for one another through our presence, speech, and actions. Guided by goodwill, we listen deeply, speak truthfully and kindly, and seek not to cause harm. We respect each person’s way of taking part, their experience, and their privacy: what is shared in practice stays where it was shared. We help keep RIM a safe place for everyone, and when harm happens, we work to repair it.",
  },
  {
    title: "Care for RIM",
    summary:
      "RIM is held through dana, the practice of mutual generosity. Financial support meets the center’s practical needs and keeps the teachings open to everyone. RIM could not exist without it, and we ask each member to support RIM financially as they are able. Time, care, service, and sincere presence also nourish the life of the sangha, and together we co-create RIM. We trust each person to discern what is possible; no one is expected to offer in every way, and belonging is never measured by what or how much one gives.",
  },
];
