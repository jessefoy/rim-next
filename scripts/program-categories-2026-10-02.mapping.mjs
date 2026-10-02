/**
 * The mapping table for the program-categories migration (the brief's C6):
 * for every program, archived included, the Category, Format, the two
 * checkboxes, and Open entry it should carry. APPROVED by Jesse, 2026-10-02,
 * with his changes (Our Hearts Were Made for This is a Community Group;
 * Sacred Clarity is Immersion, Workshop; Format is empty for the Community
 * Groups and the Special Event). Applied by scripts/program-categories-2026-10-02.mjs.
 *
 * Codes are those of lib/programOffering.ts. `openEntry` is each program's
 * CURRENT access, backfilled from the old rule (isOpenlyDroppable of the old
 * category's kind and the program's registration), so no program's access
 * changes; the script refuses to run unless every value here equals that
 * answer. `expectedUpdatedAt` is the row's updatedAt when the table was
 * prepared: the migration's drift guard refuses to touch a row edited since.
 */

const A = "ONGOING_LEARNING_PRACTICE";

export const MAPPING = [
  { slug: "awakening-the-heart", current: "drop-ins", category: A, format: "DROP_IN", silentMeditation: false, hostedByVolunteers: false, openEntry: true, unsure: false, note: "", expectedUpdatedAt: "2026-10-01T18:33:36.762Z" },
  { slug: "the-art-of-meditation", current: "drop-ins", category: A, format: "DROP_IN", silentMeditation: false, hostedByVolunteers: false, openEntry: true, unsure: false, note: "Weekly, registration off, open to drop in.", expectedUpdatedAt: "2026-09-27T00:23:05.069Z" },
  { slug: "essential-dharma-study", current: "drop-ins", category: A, format: "DROP_IN", silentMeditation: false, hostedByVolunteers: false, openEntry: true, unsure: false, note: "Jesse: stays Drop-in. Registration is ON and it is open entry today, so both stay as they are.", expectedUpdatedAt: "2026-09-27T00:23:05.121Z" },
  { slug: "meditation-and-dharma-talk", current: "drop-ins", category: A, format: "DROP_IN", silentMeditation: false, hostedByVolunteers: false, openEntry: true, unsure: false, note: "", expectedUpdatedAt: "2026-10-02T16:59:59.989Z" },
  { slug: "good-morning-silent-meditation", current: "silent-meditation", category: A, format: "DROP_IN", silentMeditation: true, hostedByVolunteers: true, openEntry: true, unsure: false, note: "", expectedUpdatedAt: "2026-10-01T18:33:36.856Z" },
  { slug: "good-evening-silent-meditation", current: "silent-meditation", category: A, format: "DROP_IN", silentMeditation: true, hostedByVolunteers: true, openEntry: true, unsure: false, note: "", expectedUpdatedAt: "2026-10-01T18:33:36.901Z" },
  { slug: "our-hearts-were-made-for-this", current: "drop-ins", category: "COMMUNITY_GROUP", format: null, silentMeditation: false, hostedByVolunteers: false, openEntry: true, unsure: false, note: "Jesse: a Community Group, Format empty. A collaboration with the Christine Center, led by a RIM volunteer. Open entry stays on (it is open today).", expectedUpdatedAt: "2026-09-27T00:23:05.040Z" },
  { slug: "qigong-at-rim", current: "community-groups-events", category: "COMMUNITY_GROUP", format: null, silentMeditation: false, hostedByVolunteers: false, openEntry: false, unsure: false, note: "Jesse: Format empty. Registration on, so not open entry, as today.", expectedUpdatedAt: "2026-09-27T00:23:05.012Z" },
  { slug: "recovery-dharma", current: "community-groups-events", category: "COMMUNITY_GROUP", format: null, silentMeditation: false, hostedByVolunteers: false, openEntry: true, unsure: false, note: "Registration off, so open entry, as today.", expectedUpdatedAt: "2026-09-02T16:31:46.777Z" },
  { slug: "nature-meditation-km-group", current: "community-groups-events", category: "COMMUNITY_GROUP", format: null, silentMeditation: false, hostedByVolunteers: false, openEntry: false, unsure: false, note: "", expectedUpdatedAt: "2026-09-27T00:23:04.985Z" },
  { slug: "bookmarks-and-breath", current: "community-groups-events", category: "COMMUNITY_GROUP", format: null, silentMeditation: false, hostedByVolunteers: false, openEntry: false, unsure: false, note: "Archived. A quarterly book club.", expectedUpdatedAt: "2026-09-22T09:15:23.851Z" },
  { slug: "rim-s-end-of-year-community-gathering-fundraiser", current: "events", category: "SPECIAL_EVENT", format: null, silentMeditation: false, hostedByVolunteers: false, openEntry: false, unsure: false, note: "Jesse: Special Event, Format empty.", expectedUpdatedAt: "2026-09-27T00:23:04.715Z" },
  { slug: "day-of-mindfulness", current: "events", category: "IMMERSION", format: "DAY_OF_MINDFULNESS", silentMeditation: false, hostedByVolunteers: false, openEntry: false, unsure: false, note: "Jesse: Immersion, Day of mindfulness. Archived; it moves out of Events.", expectedUpdatedAt: "2026-06-29T17:08:25.214Z" },
  { slug: "the-heart-of-wisdom", current: "retreats", category: "IMMERSION", format: "RETREAT", silentMeditation: false, hostedByVolunteers: false, openEntry: false, unsure: false, note: "Archived. A 4-day, 3-night retreat.", expectedUpdatedAt: "2026-09-14T09:15:24.066Z" },
  { slug: "awakening-to-the-beauty-of-this-moment", current: "retreats", category: "IMMERSION", format: "DAY_OF_MINDFULNESS", silentMeditation: false, hostedByVolunteers: false, openEntry: false, unsure: false, note: "Jesse: Immersion, Day of mindfulness. Archived.", expectedUpdatedAt: "2026-09-29T15:56:53.825Z" },
  { slug: "sangha-community-service-riverkeeper-spring-clean-up", current: "community-service", category: "SERVICE", format: null, silentMeditation: false, hostedByVolunteers: false, openEntry: false, unsure: false, note: "Jesse: the internal Service value. Archived.", expectedUpdatedAt: "2026-06-17T21:41:46.413Z" },
  { slug: "sangha-community-service-ronald-mcdonald-house", current: "community-service", category: "SERVICE", format: null, silentMeditation: false, hostedByVolunteers: false, openEntry: false, unsure: false, note: "Jesse: the internal Service value. Archived.", expectedUpdatedAt: "2026-06-17T21:41:50.511Z" },
  { slug: "private-teacher-meetings", current: "private-sessions", category: "PRIVATE", format: null, silentMeditation: false, hostedByVolunteers: false, openEntry: false, unsure: false, note: "Never listed. Already hidden from the listing, This Week and the dashboard by its own flags.", expectedUpdatedAt: "2026-09-02T16:31:48.104Z" },
  { slug: "dummy-test-program", current: "drop-ins", category: A, format: "DROP_IN", silentMeditation: false, hostedByVolunteers: false, openEntry: true, unsure: false, note: "Archived test program; mapped like its category so its behavior is unchanged.", expectedUpdatedAt: "2026-10-02T15:36:38.626Z" },
  { slug: "sacred-clarity", current: null, category: "IMMERSION", format: "WORKSHOP", silentMeditation: false, hostedByVolunteers: false, openEntry: false, unsure: false, note: "Jesse: Immersion, Workshop. It has no category today. Archived.", expectedUpdatedAt: "2026-05-08T03:28:33.480Z" },
];
