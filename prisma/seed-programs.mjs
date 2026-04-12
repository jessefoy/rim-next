/**
 * seed-programs.mjs — One-time seed of all RIM program descriptions.
 *
 * Called from migrate.mjs. Upserts categories and programs with
 * full BlockNote JSON descriptions written to the RIM Writing Guide.
 *
 * Idempotent: checks a migration flag before running.
 */

// ── BlockNote JSON helpers ──────────────────────────────────────────────────────
// Every block needs a unique `id` for isBlockNoteJSON() to recognize the format.

let _id = 0;
const uid = () => `seed-${++_id}`;

/** Plain paragraph */
const p = (...parts) => ({
  id: uid(),
  type: "paragraph",
  props: {},
  content: parts.flat().map(part =>
    typeof part === "string" ? { type: "text", text: part, styles: {} } : part
  ),
  children: [],
});

/** Empty paragraph (spacer) */
const sp = () => ({ id: uid(), type: "paragraph", props: {}, content: [], children: [] });

/** Bold inline text */
const b = (text) => ({ type: "text", text, styles: { bold: true } });

/** Italic inline text */
const i = (text) => ({ type: "text", text, styles: { italic: true } });

/** Regular inline text */
const t = (text) => ({ type: "text", text, styles: {} });

/** Heading block */
const h = (level, text) => ({
  id: uid(),
  type: "heading",
  props: { level },
  content: [{ type: "text", text, styles: {} }],
  children: [],
});

/** Bullet list item */
const li = (...parts) => ({
  id: uid(),
  type: "bulletListItem",
  props: {},
  content: parts.flat().map(part =>
    typeof part === "string" ? { type: "text", text: part, styles: {} } : part
  ),
  children: [],
});

// ── Categories ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { slug: "drop-ins", name: "Drop-Ins: Open Practice and Learning", sortOrder: 1 },
  { slug: "silent-meditation", name: "Silent Meditation Drop-Ins", sortOrder: 2 },
  { slug: "classes-courses-workshops", name: "Classes, Courses, and Workshops", sortOrder: 3 },
  { slug: "community-groups-events", name: "Community Groups & Events", sortOrder: 4 },
  { slug: "community-service", name: "Community Service", sortOrder: 5 },
];

// ── Programs ────────────────────────────────────────────────────────────────────

const PROGRAMS = [
  // ─── Core Drop-Ins ────────────────────────────────────────────────────────

  {
    slug: "awakening-the-heart",
    name: "Awakening The Heart",
    tagline: "Cultivating a Warm, Open, Joyful, and Loving Heart",
    categorySlug: "drop-ins",
    programFormat: "virtual",
    venue: "other",
    locationText: "Zoom",
    dateText: "Every Monday Morning",
    timeText: "9:30-10:30 AM CT",
    danaText: "Suggested Donation: $10-$20",
    danaMode: "voluntary",
    suggestedDana: 15,
    teacherFacilitators: ["Jesse Foy"],
    registrationEnabled: false,
    description: [
      p("Lovingkindness is a practice of deliberately offering warmth \u2014 to yourself, to people you love, and even to people you struggle with. It\u2019s simpler than it sounds, and the effects are real."),
      p("Each Monday morning, we practice meditations rooted in the four immeasurables \u2014 lovingkindness, compassion, appreciative joy, and equanimity \u2014 with guided practice, short teachings, and conversation about how to carry this into daily life. The tone is friendly and unhurried."),
      p(b("Who it\u2019s for:"), t(" Everyone. Newcomers and longtime practitioners are equally welcome.")),
      sp(),
      p(b("In this program, you\u2019ll be invited to:")),
      li("Practice lovingkindness and compassion meditation in a supportive group"),
      li("Explore different ways of opening the heart \u2014 even on hard days"),
      li("Discover how small shifts in attention can change how you relate to yourself and others"),
    ],
  },

  {
    slug: "the-art-of-meditation",
    name: "The Art of Meditation",
    tagline: "Learning and Deepening a Skillful Meditation Practice",
    categorySlug: "drop-ins",
    programFormat: "hybrid",
    venue: "at-rim",
    dateText: "Every Tuesday Morning",
    timeText: "9:30-10:30 AM CT",
    danaText: "Suggested Donation: $10-$20",
    danaMode: "voluntary",
    suggestedDana: 15,
    teacherFacilitators: ["Jesse Foy"],
    registrationEnabled: false,
    description: [
      p("Meditation is a skill \u2014 one that develops with practice, patience, and good guidance. This weekly drop-in is a place to learn that skill from the ground up, or to deepen a practice you\u2019ve already begun."),
      p("Each Tuesday, we practice together with guided mindfulness meditations, explore techniques for working with the body, breath, and mind, and discuss how to bring what we learn on the cushion into the rest of our lives. The teaching draws from both traditional Buddhist and modern mindfulness-based approaches, and there\u2019s always time for questions."),
      p(b("Who it\u2019s for:"), t(" All levels. No prior experience needed.")),
      sp(),
      p(b("In this program, you\u2019ll be invited to:")),
      li("Develop and refine a formal meditation practice with skilled guidance"),
      li("Learn practical techniques for working with restlessness, distraction, and discomfort"),
      li("Explore how meditation can support clarity, well-being, and genuine ease in daily life"),
    ],
  },

  {
    slug: "essential-dharma-study",
    name: "Essential Dharma Study",
    tagline: "An Ongoing Exploration of Traditional Buddhist Teachings and How They Apply to Real Life",
    categorySlug: "drop-ins",
    programFormat: "virtual",
    venue: "other",
    locationText: "Zoom",
    dateText: "Every Thursday Morning",
    timeText: "9:30-10:30 AM CT",
    danaText: "Dana (offered in the spirit of generosity)",
    danaMode: "voluntary",
    teacherFacilitators: ["Jesse Foy"],
    registrationEnabled: true,
    description: [
      p("The Buddha\u2019s core teachings \u2014 on suffering, impermanence, compassion, and freedom \u2014 aren\u2019t abstract philosophy. They\u2019re practical observations about how our minds work and how we can live with more clarity and less unnecessary struggle. This weekly study group is a place to explore those teachings together."),
      p("Each Thursday, we gather around a specific dharma topic \u2014 sometimes chosen by the group, sometimes by the guiding teacher \u2014 and spend an hour in peer-to-peer dialogue, shared practice, and honest reflection. The emphasis is on understanding the teachings through your own experience, not just learning about them. Sessions close with a short lovingkindness practice."),
      p("This group meets between Essential Dharma Study courses and includes access to a private online space for continued conversation and practice support."),
      p(b("Who it\u2019s for:"), t(" All RIM community members, from newcomers to experienced practitioners. Curiosity matters more than background.")),
      sp(),
      p(b("In this group, you\u2019ll be invited to:")),
      li("Explore core Buddhist teachings in accessible, plain language"),
      li("Share your own experience and learn from others\u2019 perspectives"),
      li("Discover how ancient wisdom applies to the challenges of daily life"),
      li("Build genuine friendships with fellow practitioners (kalyana mitta \u2014 spiritual friendship)"),
    ],
  },

  {
    slug: "meditation-and-dharma-talk",
    name: "Meditation and Dharma Talk",
    tagline: "Guided Meditation and Teaching for a More Mindful Life",
    categorySlug: "drop-ins",
    programFormat: "hybrid",
    venue: "at-rim",
    dateText: "Every Saturday Morning",
    timeText: "9:30-10:45 AM CT",
    danaText: "Suggested Donation: $10-$20",
    danaMode: "voluntary",
    suggestedDana: 15,
    teacherFacilitators: ["Jesse Foy"],
    registrationEnabled: false,
    description: [
      p("Saturday mornings at RIM are a place to slow down, sit together, and listen. Each session pairs guided meditation with a dharma talk \u2014 a teaching drawn from Buddhist wisdom and applied to the real questions of how we live, how we relate, and how we meet difficulty with steadiness and care."),
      p("This is our longest-running and most attended weekly gathering. Whether you come every Saturday or once a month, the door is always open."),
      p(b("Who it\u2019s for:"), t(" Everyone. Come as you are \u2014 no experience needed.")),
      sp(),
      p(b("In this program, you\u2019ll be invited to:")),
      li("Practice guided meditation in a warm, grounded community setting"),
      li("Listen to a dharma talk that connects traditional teachings to everyday life"),
      li("Sit with others who are practicing alongside you \u2014 in person or online"),
    ],
  },

  {
    slug: "our-hearts-were-made-for-this",
    name: "Our Hearts Were Made for This",
    tagline: "A Sunday Morning Lovingkindness Practice",
    categorySlug: "drop-ins",
    programFormat: "virtual",
    venue: "other",
    locationText: "Zoom",
    dateText: "Every Sunday Morning",
    timeText: "9:00-9:45 AM CT",
    danaText: "Dana",
    danaMode: "voluntary",
    teacherFacilitators: ["Sara Neall"],
    registrationEnabled: false,
    description: [
      p("Kindness, compassion, joy, and equanimity aren\u2019t just nice ideas \u2014 they\u2019re capacities we can strengthen through practice, the way we\u2019d strengthen a muscle. This short Sunday session is dedicated to that practice."),
      p("Each week begins with a brief dharma talk to set the frame, followed by 20\u201330 minutes of guided lovingkindness meditation. Afterward, there\u2019s space for questions, reflections, or simply sitting together in the quiet that follows practice."),
      p(b("Who it\u2019s for:"), t(" Everyone. Whether you\u2019re new to lovingkindness practice or have been sitting with it for years.")),
      sp(),
      p(b("In this program, you\u2019ll be invited to:")),
      li("Practice lovingkindness meditation with gentle, sustained guidance"),
      li("Explore the four immeasurables as qualities already within you"),
      li("Start your week grounded in warmth and care"),
    ],
  },

  // ─── Silent Meditation Drop-Ins ───────────────────────────────────────────

  {
    slug: "good-morning-silent-meditation",
    name: "Good Morning Silent Meditation",
    tagline: "Start the Day in Silence, Together",
    categorySlug: "silent-meditation",
    programFormat: "virtual",
    venue: "other",
    locationText: "Zoom",
    dateText: "Monday\u2013Friday",
    timeText: "6:30-7:00 AM CT",
    danaText: "Dana",
    danaMode: "voluntary",
    teacherFacilitators: ["RIM Community Members"],
    registrationEnabled: false,
    description: [
      p("Thirty minutes of quiet meditation before the day begins. An experienced community member offers brief opening guidance to help settle the body and mind, and the rest of the sit is unguided. The session is held in noble silence."),
      p("There\u2019s something about practicing alongside others \u2014 even through a screen \u2014 that steadies the practice in a way that sitting alone doesn\u2019t quite match. This is a simple offering: show up, sit, and begin your day from a quieter place."),
      p(b("Who it\u2019s for:"), t(" Anyone with a meditation practice, or anyone who\u2019d like to start one. All levels.")),
      sp(),
      p(i("The room opens at 6:20 AM.")),
    ],
  },

  {
    slug: "good-evening-silent-meditation",
    name: "Good Evening Silent Meditation",
    tagline: "Close the Day in Stillness, Together",
    categorySlug: "silent-meditation",
    programFormat: "virtual",
    venue: "other",
    locationText: "Zoom",
    dateText: "Sunday\u2013Thursday",
    timeText: "7:30-8:00 PM CT",
    danaText: "Dana",
    danaMode: "voluntary",
    teacherFacilitators: ["RIM Community Members"],
    registrationEnabled: false,
    description: [
      p("The same simple format as the morning sit \u2014 brief opening guidance from a community member, followed by silent meditation. A way to let the day settle before sleep."),
      p("These evening sessions are held in noble silence and run for thirty minutes. The room opens at 7:20 PM so we can gather and arrive together."),
      p(b("Who it\u2019s for:"), t(" Anyone. All levels welcome.")),
    ],
  },

  // ─── Community Groups & Events ────────────────────────────────────────────

  {
    slug: "bookmarks-and-breath",
    name: "Bookmarks & Breath",
    tagline: "A Quarterly Book Club for Curious Readers and Honest Conversation",
    categorySlug: "community-groups-events",
    programFormat: "in-person",
    venue: "at-rim",
    dateText: "Quarterly on Monday Evenings",
    timeText: "6:00-7:00 PM CT",
    danaText: "Dana (optional)",
    danaMode: "voluntary",
    teacherFacilitators: ["Gina Dundun"],
    registrationEnabled: true,
    description: [
      p("Some of the best dharma conversations happen away from the cushion \u2014 over a book, a cup of tea, and a table full of people willing to say what they actually think. Bookmarks & Breath is that kind of space."),
      p("Each quarter, we read a book together and meet in person at RIM for an hour of circle-style discussion using question cards inspired by the reading. Everyone gets a few minutes to share, supported by a timer so all voices are heard. The atmosphere is relaxed, curious, and human \u2014 no pressure to sound wise or polished."),
      p(b("Currently reading:"), t(" "), i("Radical Acceptance"), t(" by Tara Brach \u2014 a warm, relatable exploration of meeting ourselves and our lives with a little more compassion.")),
      p(b("Who it\u2019s for:"), t(" Anyone who likes to read and talk about what they\u2019ve read. No meditation experience needed.")),
    ],
  },

  {
    slug: "qigong-at-rim",
    name: "Qigong at RIM",
    tagline: "Gentle Movement, Breath, and Meditation in the Chinese Tradition",
    categorySlug: "community-groups-events",
    programFormat: "virtual",
    venue: "other",
    locationText: "Zoom",
    dateText: "Every Wednesday Morning",
    timeText: "10:00-10:45 AM CT",
    danaText: "Dana",
    danaMode: "voluntary",
    teacherFacilitators: ["Maria Sprecher"],
    registrationEnabled: true,
    description: [
      p("Qigong (chee-gong) is a traditional Chinese health practice that combines slow, gentle movements with meditation and breathing. It\u2019s a way of listening to your body and giving it friendly, supportive care \u2014 accessible at any age and any fitness level."),
      p("This ongoing group meets weekly on Zoom. Movements and concepts are continuously revisited, so you can join at any time and attend whenever you\u2019re able. No prior experience is needed."),
      p(b("You\u2019ll need:"), t(" Comfortable, loose clothing \u00b7 shoes without substantial heels \u00b7 a supportive chair \u00b7 about 6 feet by 4 feet of clear space for movement.")),
      p(b("Who it\u2019s for:"), t(" Everyone. The movements are gentle and can be adapted to your body.")),
      sp(),
      p(b("In this group, you\u2019ll be invited to:")),
      li("Learn and practice qigong movements that support balance, calm, and vitality"),
      li("Explore breath and body awareness through the lens of Traditional Chinese Medicine"),
      li("Build a sustainable movement practice you can do at home"),
    ],
  },

  {
    slug: "recovery-dharma",
    name: "Recovery Dharma",
    tagline: "Buddhist Practices and Peer Support for Healing the Suffering of Addiction",
    categorySlug: "community-groups-events",
    programFormat: "virtual",
    venue: "other",
    locationText: "Zoom",
    dateText: "Every Sunday",
    timeText: "9:30-11:00 AM CT",
    danaText: "Dana (offered in the spirit of generosity)",
    danaMode: "voluntary",
    teacherFacilitators: ["Recovery Dharma Facilitators"],
    registrationEnabled: false,
    description: [
      p("Recovery Dharma is a peer-led community that uses Buddhist practices \u2014 meditation, self-inquiry, compassion, and the support of others \u2014 as tools for recovery and healing. It is grounded in the belief that each of us has the capacity to recover and to find freedom."),
      p("This group welcomes anyone working with addiction of any kind \u2014 whether related to substances, codependency, gambling, eating, relationships, technology, or any habitual pattern that creates suffering. Meetings include meditation, readings, and group sharing. No meditation experience is necessary."),
      p(b("Who it\u2019s for:"), t(" Anyone interested in recovery from addiction, in all its forms.")),
    ],
  },

  {
    slug: "nature-meditation-km-group",
    name: "Nature Meditation KM Group",
    tagline: "Mindful Walks in Nature, May Through October",
    categorySlug: "community-groups-events",
    programFormat: "in-person",
    venue: "other",
    locationText: "Menomonee Park",
    locationLink: "https://maps.google.com/maps?q=Menomonee+Park+W220N7884+Town+Line+Rd+Menomonee+Falls+WI+53051",
    dateText: "Last Sunday of the Month, May\u2013October",
    timeText: "9:30-10:45 AM",
    danaText: "Dana (to support RIM\u2019s mission)",
    danaMode: "voluntary",
    teacherFacilitators: ["Sam Scherer", "Kerry Thomas", "Christine Jacobi"],
    registrationEnabled: true,
    description: [
      p("The Buddha awakened under a tree next to a river. There\u2019s something about practicing outdoors \u2014 with the ground underfoot, the sounds of wind and water, and the steadiness of the natural world \u2014 that opens a different quality of attention."),
      p("This group meets monthly from late spring through fall for walks at Menomonee Park. Each gathering lasts about 75 minutes and includes a slow, mindful walk on easy trails, guided meditation, and time to share reflections. The pace is gentle, the trails are manageable, and the company is good."),
      p(b("What to know:"), t(" You\u2019ll need the ability to walk on uneven terrain for about 45 minutes at a slow pace. Closed-toe shoes with socks recommended. Bring bug spray, sunscreen, and water.")),
      p(b("Who it\u2019s for:"), t(" Anyone who enjoys being outdoors and is curious about practicing meditation in nature.")),
    ],
  },

  // ─── Community Service ────────────────────────────────────────────────────

  {
    slug: "sangha-community-service-ronald-mcdonald-house",
    name: "Sangha Community Service: Ronald McDonald House Family Dinner",
    tagline: "Cooking a Family Dinner Together \u2014 Practice in Action",
    categorySlug: "community-service",
    programFormat: "in-person",
    venue: "other",
    locationText: "Ronald McDonald House, Milwaukee",
    dateText: "Saturday, April 18",
    timeText: "3:00-6:00 PM",
    danaText: "Your participation is your dana",
    danaMode: "none",
    teacherFacilitators: ["RIM Community"],
    registrationEnabled: true,
    description: [
      p("Generosity and care are at the center of Buddhist practice, and sometimes the most direct expression of that is cooking a meal for people who need one."),
      p("On April 18, we\u2019re preparing a taco dinner to feed 70 families staying at the Ronald McDonald House \u2014 families whose children are receiving medical care. The dinner will cost approximately $400. We\u2019re collecting non-perishable food items and small cash donations ($5\u2013$20) at Tuesday and Saturday drop-ins through April 14. Digital transfers via Zelle are also welcome. All unused food goes to the Hunger Task Force, and surplus cash donations go directly to the Ronald McDonald House."),
      p(b("Who it\u2019s for:"), t(" Anyone who wants to help. Donate food, contribute funds, or join us for the cooking.")),
    ],
  },

  {
    slug: "sangha-community-service-riverkeeper-spring-clean-up",
    name: "Sangha Community Service: Riverkeeper Spring Clean Up",
    tagline: "Caring for the Waterways That Sustain Us",
    categorySlug: "community-service",
    programFormat: "in-person",
    venue: "other",
    locationText: "Lincoln Creek, Milwaukee",
    locationLink: "https://maps.google.com/maps?q=5900+W+Lincoln+Creek+Dr+Milwaukee+WI+53218",
    dateText: "Saturday, April 25",
    timeText: "9:00 AM-12:00 PM",
    danaText: "Your participation is your dana",
    danaMode: "none",
    teacherFacilitators: ["Kerry Thomas"],
    registrationEnabled: true,
    description: [
      p("Each spring, over 4,000 volunteers gather across the Milwaukee River watershed to remove more than 50 tons of trash in a single morning. This year, the RIM sangha is joining in at Lincoln Creek."),
      p("This is practice off the cushion \u2014 showing up, working together, and offering care to the land and water that hold our community. Bring friends, bring family (including children), and spend a morning doing something simple and good with your hands."),
      p("Volunteers receive a free event t-shirt designed by local artist Sam Hanson Doodle, and an invitation to the post-event zero-waste celebration at Rock the Green at the Harley-Davidson Museum."),
      p(b("Who it\u2019s for:"), t(" Everyone. Families welcome.")),
    ],
  },
];

// ── Seed function ───────────────────────────────────────────────────────────────

export async function seedPrograms(db) {
  console.log("  Seeding program categories and descriptions...");

  // 1. Upsert categories
  const categoryMap = {};
  for (const cat of CATEGORIES) {
    const result = await db.programCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, sortOrder: cat.sortOrder },
      create: { slug: cat.slug, name: cat.name, sortOrder: cat.sortOrder },
    });
    categoryMap[cat.slug] = result.id;
  }
  console.log(`    ${CATEGORIES.length} categories upserted.`);

  // Remove old categories not in the seed list
  const keepCategorySlugs = CATEGORIES.map(c => c.slug);
  const allCategories = await db.programCategory.findMany({ select: { id: true, slug: true, name: true } });
  const oldCategories = allCategories.filter(c => !keepCategorySlugs.includes(c.slug));
  for (const old of oldCategories) {
    // Reassign any programs on this old category to null
    await db.program.updateMany({ where: { categoryId: old.id }, data: { categoryId: null } });
    await db.programCategory.delete({ where: { id: old.id } });
    console.log(`    Deleted old category "${old.name}" (slug: ${old.slug}).`);
  }

  // 2. Upsert programs
  let created = 0, updated = 0;
  for (const prog of PROGRAMS) {
    const { slug, categorySlug, description, ...fields } = prog;
    const data = {
      ...fields,
      categoryId: categoryMap[categorySlug] ?? null,
      description: description,
    };

    const existing = await db.program.findUnique({ where: { slug } });
    if (existing) {
      await db.program.update({ where: { slug }, data });
      updated++;
    } else {
      await db.program.create({ data: { slug, ...data } });
      created++;
    }
  }
  console.log(`    ${created} programs created, ${updated} updated.`);

  // 3. Remove programs not in the seed list (except private teacher)
  const keepSlugs = PROGRAMS.map(p => p.slug);
  const allPrograms = await db.program.findMany({ select: { slug: true, name: true } });
  const PRESERVE_NAMES = ["private teacher", "sacred clarity", "teacher meeting"];
  const toRemove = allPrograms.filter(
    p => !keepSlugs.includes(p.slug) && !PRESERVE_NAMES.some(n => p.name.toLowerCase().includes(n))
  );

  if (toRemove.length > 0) {
    for (const prog of toRemove) {
      // Get the program ID for FK cleanup
      const full = await db.program.findUnique({ where: { slug: prog.slug }, select: { id: true } });
      if (!full) continue;

      // Delete in FK-safe order (deepest dependencies first)
      // SubClaim → SubRequest → HostAssignment (FK chain)
      const assignments = await db.hostAssignment.findMany({ where: { programSlug: prog.slug }, select: { id: true } });
      if (assignments.length > 0) {
        const assignmentIds = assignments.map(a => a.id);
        const subRequests = await db.subRequest.findMany({ where: { assignmentId: { in: assignmentIds } }, select: { id: true } });
        if (subRequests.length > 0) {
          await db.subClaim.deleteMany({ where: { requestId: { in: subRequests.map(r => r.id) } } });
          await db.subRequest.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
        }
        await db.hostAssignment.deleteMany({ where: { programSlug: prog.slug } });
      }

      // Session records (denormalized slug, no FK but tidy up)
      await db.sessionCoHostReport.deleteMany({ where: { programSlug: prog.slug } });
      await db.sessionCoHost.deleteMany({ where: { programSlug: prog.slug } });
      await db.sessionReport.deleteMany({ where: { programSlug: prog.slug } });

      // Direct FK references on programId
      await db.registration.deleteMany({ where: { programId: full.id } });
      await db.sessionAttendance.deleteMany({ where: { programId: full.id } });

      // Delete the program
      await db.program.delete({ where: { slug: prog.slug } });
      console.log(`    Deleted "${prog.name}" and related records.`);
    }
  }

  console.log("  \u2714 Program seed complete.");
}
