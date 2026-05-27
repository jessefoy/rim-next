/**
 * Community Care Agreements — canonical text shared across every surface
 * that asks someone to commit to RIM's community ethos.
 *
 * Used by:
 *   - /join (new-member threshold) — both SHORT cards + LONG paragraphs
 *   - /account/welcome (post-login welcome ritual) — LONG paragraphs
 *   - components/RegistrationForm.tsx (program registration) — LONG paragraphs
 *
 * Editing the text here changes the agreement everywhere. Keep it that way.
 */

export interface CommunityAgreementShort {
  title: string;
  /** One-sentence orientation, scannable at a glance. */
  summary: string;
}

export interface CommunityAgreementLong {
  title: string;
  /** Paragraph-length expansion explaining the why. */
  body: string;
}

/** Lead-in paragraph rendered above the agreements on every surface. */
export const COMMUNITY_AGREEMENTS_LEAD_IN =
  "Rooted In Mindfulness is an intentional community held by shared values of " +
  "presence, care, and respect. We ask that everyone participate using their " +
  "real name and engage with the same care they would bring to a sitting practice.";

/** Checkbox label rendered alongside the agreement acceptance checkbox. */
export const COMMUNITY_AGREEMENTS_CHECKBOX_LABEL =
  "I'm entering this community in a spirit of care and respect.";

/** Short, scannable version — four cards for orientation. */
export const COMMUNITY_AGREEMENTS_SHORT: CommunityAgreementShort[] = [
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

/** Long-form version — full paragraphs for substance. */
export const COMMUNITY_AGREEMENTS_LONG: CommunityAgreementLong[] = [
  {
    title: "1. Care for Yourself",
    body:
      "Meditation and mindful living allow us to transform unhealthy patterns of the heart and mind, " +
      "helping us realize authentic health, well-being, meaning, and happiness. While a community, " +
      "teachers, and supportive friends can be powerful allies on the path of awakening, it is " +
      "ultimately up to each of us to take the necessary steps along the journey.",
  },
  {
    title: "2. Care for Others",
    body:
      "The work of self-discovery and development can be challenging to undertake alone. Being part " +
      "of a loving community where each member genuinely cares for one another's well-being offers a " +
      "true refuge. Showing up and sharing an intentional space to learn and practice with friends " +
      "is immeasurably beneficial for both ourselves and our shared world.",
  },
  {
    title: "3. Care for RIM: Our Shared Refuge",
    body:
      "RIM is co-created through the generosity, goodwill, and appreciation of its community. As a " +
      "living expression of generosity, RIM is 100% community-funded and entirely dependent on " +
      "donations. These cover all operating costs, contribute to teacher livelihoods, and maintain " +
      "the building. RIM does not charge fixed fees — we ask that members contribute an ongoing " +
      "amount (RIM Dana) that feels right to them.",
  },
  {
    title: "4. Care for Our Shared Mission and Vision",
    body:
      "RIM is a community refuge dedicated to learning and practicing the dharma, meditation, and " +
      "mindful living. We do this to understand ourselves, others, and the world — aiming to free " +
      "ourselves from unhealthy thoughts, words, and actions in order to realize a world where all " +
      "beings live with great wisdom and great compassion.",
  },
];
