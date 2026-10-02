/**
 * The mapping table for the program-categories migration (the brief's C6):
 * for every program, archived included, the Category, Format and the two
 * checkboxes it should carry. PROPOSED, NOT APPLIED: Jesse approves this table
 * before anything is written (scripts/program-categories-2026-10-02.mjs).
 *
 * Codes are those of lib/programOffering.ts. `unsure: true` marks a row whose
 * reading is a question for Jesse; `note` says why. `expectedUpdatedAt` is the
 * row's updatedAt when the table was prepared (2026-10-02): the migration's
 * drift guard refuses to touch a row edited since.
 */

const A = "ONGOING_LEARNING_PRACTICE";

export const MAPPING = [
  // ── Today's drop-ins ────────────────────────────────────────────────────
  { slug: "awakening-the-heart", current: "drop-ins", category: A, format: "DROP_IN", silentMeditation: false, hostedByVolunteers: false, unsure: false, note: "", expectedUpdatedAt: "2026-10-01T18:33:36.762Z" },
  { slug: "the-art-of-meditation", current: "drop-ins", category: A, format: "DROP_IN", silentMeditation: false, hostedByVolunteers: false, unsure: false, note: "Weekly, registration off, open to drop in.", expectedUpdatedAt: "2026-09-27T00:23:05.069Z" },
  {
    slug: "essential-dharma-study", current: "drop-ins", category: A, format: "DROP_IN", silentMeditation: false, hostedByVolunteers: false, unsure: true,
    note: "QUESTION: Course or Drop-in? It has registration ON and runs as a sequence. Drop-in keeps today's behavior exactly (anyone signed in may enter its Zoom and it shows on My Home's Today for everyone). Course would change that: only registrants, hosts, and staff would be admitted and see it, because the old DROP_IN kind opens it today despite its registration.",
    expectedUpdatedAt: "2026-09-27T00:23:05.121Z",
  },
  { slug: "meditation-and-dharma-talk", current: "drop-ins", category: A, format: "DROP_IN", silentMeditation: false, hostedByVolunteers: false, unsure: false, note: "", expectedUpdatedAt: "2026-10-02T16:59:59.989Z" },
  {
    slug: "our-hearts-were-made-for-this", current: "drop-ins", category: A, format: "DROP_IN", silentMeditation: false, hostedByVolunteers: false, unsure: true,
    note: "QUESTION: Hosted by volunteers? It is facilitated by a community member (Sara Neall) and marked 'no host needed', but it is a guided lovingkindness practice, not a silent sit. Proposed No: only the two silent sits are Yes, as the brief says.",
    expectedUpdatedAt: "2026-09-27T00:23:05.040Z",
  },
  // ── The silent sits (RIM's root practice on RIM's schedule, hosted by volunteers) ──
  { slug: "good-morning-silent-meditation", current: "silent-meditation", category: A, format: "DROP_IN", silentMeditation: true, hostedByVolunteers: true, unsure: false, note: "", expectedUpdatedAt: "2026-10-01T18:33:36.856Z" },
  { slug: "good-evening-silent-meditation", current: "silent-meditation", category: A, format: "DROP_IN", silentMeditation: true, hostedByVolunteers: true, unsure: false, note: "", expectedUpdatedAt: "2026-10-01T18:33:36.901Z" },
  // ── Community groups (member-led by definition; no label, format optional and left empty) ──
  { slug: "qigong-at-rim", current: "community-groups-events", category: "COMMUNITY_GROUP", format: null, silentMeditation: false, hostedByVolunteers: false, unsure: true, note: "Format left empty (optional for a Community Group). It has registration on, so it is a commitment, not droppable, exactly as today. Could carry Format = Class if Jesse wants a label on its card.", expectedUpdatedAt: "2026-09-27T00:23:05.012Z" },
  { slug: "recovery-dharma", current: "community-groups-events", category: "COMMUNITY_GROUP", format: null, silentMeditation: false, hostedByVolunteers: false, unsure: false, note: "Registration off, so open to drop in, exactly as today.", expectedUpdatedAt: "2026-09-02T16:31:46.777Z" },
  { slug: "nature-meditation-km-group", current: "community-groups-events", category: "COMMUNITY_GROUP", format: null, silentMeditation: false, hostedByVolunteers: false, unsure: false, note: "", expectedUpdatedAt: "2026-09-27T00:23:04.985Z" },
  { slug: "bookmarks-and-breath", current: "community-groups-events", category: "COMMUNITY_GROUP", format: null, silentMeditation: false, hostedByVolunteers: false, unsure: false, note: "Archived. A quarterly book club.", expectedUpdatedAt: "2026-09-22T09:15:23.851Z" },
  // ── Special events ──────────────────────────────────────────────────────
  { slug: "rim-s-end-of-year-community-gathering-fundraiser", current: "events", category: "SPECIAL_EVENT", format: null, silentMeditation: false, hostedByVolunteers: false, unsure: true, note: "Special Event, as the brief says. Format left empty (optional). Its tagline reads 'Special Drop-In & Celebration'; if Jesse wants Format = Drop-in on its card, access does not change: a Special Event is never open by format, so it stays a commitment as today.", expectedUpdatedAt: "2026-09-27T00:23:04.715Z" },
  // ── Immersion (archived today) ──────────────────────────────────────────
  { slug: "day-of-mindfulness", current: "events", category: "IMMERSION", format: "DAY_OF_MINDFULNESS", silentMeditation: false, hostedByVolunteers: false, unsure: true, note: "QUESTION (the brief's): Immersion, Day of mindfulness? Archived. It moves out of Events.", expectedUpdatedAt: "2026-06-29T17:08:25.214Z" },
  { slug: "the-heart-of-wisdom", current: "retreats", category: "IMMERSION", format: "RETREAT", silentMeditation: false, hostedByVolunteers: false, unsure: false, note: "Archived. A 4-day, 3-night retreat.", expectedUpdatedAt: "2026-09-14T09:15:24.066Z" },
  { slug: "awakening-to-the-beauty-of-this-moment", current: "retreats", category: "IMMERSION", format: "DAY_OF_MINDFULNESS", silentMeditation: false, hostedByVolunteers: false, unsure: true, note: "QUESTION: Retreat or Day of mindfulness? It sits in the Retreats category today, but its own tagline calls it 'A Day of Mindfulness in Nature'. Proposed Day of mindfulness. Archived; access is the same either way.", expectedUpdatedAt: "2026-09-29T15:56:53.825Z" },
  // ── Service (internal; kept for the engaged-practice avenue still to be designed) ──
  { slug: "sangha-community-service-riverkeeper-spring-clean-up", current: "community-service", category: "SERVICE", format: null, silentMeditation: false, hostedByVolunteers: false, unsure: false, note: "Archived.", expectedUpdatedAt: "2026-06-17T21:41:46.413Z" },
  { slug: "sangha-community-service-ronald-mcdonald-house", current: "community-service", category: "SERVICE", format: null, silentMeditation: false, hostedByVolunteers: false, unsure: false, note: "Archived.", expectedUpdatedAt: "2026-06-17T21:41:50.511Z" },
  // ── Private (internal; never listed) ────────────────────────────────────
  { slug: "private-teacher-meetings", current: "private-sessions", category: "PRIVATE", format: null, silentMeditation: false, hostedByVolunteers: false, unsure: false, note: "Never listed. Already hidden from the listing, This Week and the dashboard by its own flags.", expectedUpdatedAt: "2026-09-02T16:31:48.104Z" },
  // ── Test and uncategorized (both archived) ──────────────────────────────
  { slug: "dummy-test-program", current: "drop-ins", category: A, format: "DROP_IN", silentMeditation: false, hostedByVolunteers: false, unsure: false, note: "Archived test program; mapped like its category so its behavior is unchanged.", expectedUpdatedAt: "2026-10-02T15:36:38.626Z" },
  { slug: "sacred-clarity", current: null, category: "FOUNDATIONS", format: "COURSE", silentMeditation: false, hostedByVolunteers: false, unsure: true, note: "QUESTION: it has NO category today. Proposed Foundations, Course (its tagline is 'Taking Care Through Meditation and Mindful Living'; it was a registered, capped, one-time online program). Archived; access is unchanged (registration on, so not droppable).", expectedUpdatedAt: "2026-05-08T03:28:33.480Z" },
];
