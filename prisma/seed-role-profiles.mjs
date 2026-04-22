/**
 * Phase 1 seed — role profiles for Jesse.
 *
 * Adds Founder + Guiding Teacher RoleProfile records on Jesse's account if
 * they don't already exist. Idempotent via the [userId, roleKey] unique
 * constraint — safe to re-run. Gracefully skips with a warning if Jesse's
 * user record isn't present yet (e.g. fresh database, or before first login).
 *
 * Per Host Hub Rework spec (Phase 1): only Jesse is seeded here. Maria's
 * Virtual Host Coordinator profile and other coordinators are added through
 * the admin UI, not via seed.
 */

const JESSE_EMAIL = "jessefoy@icloud.com";

function paragraph(text) {
  return [
    {
      type: "paragraph",
      props: {
        textColor: "default",
        backgroundColor: "default",
        textAlignment: "left",
      },
      content: [{ type: "text", text, styles: {} }],
      children: [],
    },
  ];
}

const SEEDS = [
  {
    roleKey: "founder",
    title: "Founder",
    description: paragraph(
      "Jesse founded Rooted In Mindfulness to offer Dharma practice in an accessible, relational way — grounded in lineage, oriented toward everyday life.",
    ),
    isPrimary: true,
    sortOrder: 0,
  },
  {
    roleKey: "guiding-teacher",
    title: "Guiding Teacher",
    description: paragraph(
      "Jesse serves as RIM's Guiding Teacher, holding the overall direction of practice, curriculum, and teacher development.",
    ),
    isPrimary: false,
    sortOrder: 1,
  },
];

export async function seedRoleProfiles(db) {
  const jesse = await db.user.findUnique({
    where: { email: JESSE_EMAIL },
    select: { id: true },
  });

  if (!jesse) {
    console.log(
      `  ⚠ seed-role-profiles: user ${JESSE_EMAIL} not found — skipping.`,
    );
    return;
  }

  for (const seed of SEEDS) {
    const existing = await db.roleProfile.findUnique({
      where: {
        userId_roleKey: { userId: jesse.id, roleKey: seed.roleKey },
      },
    });
    if (existing) {
      console.log(
        `  ⏭ role-profile already present: ${JESSE_EMAIL} / ${seed.roleKey}`,
      );
      continue;
    }
    await db.roleProfile.create({
      data: {
        userId: jesse.id,
        roleKey: seed.roleKey,
        title: seed.title,
        description: seed.description,
        isPrimary: seed.isPrimary,
        sortOrder: seed.sortOrder,
      },
    });
    console.log(`  ✔ seeded role-profile: ${JESSE_EMAIL} / ${seed.roleKey}`);
  }
}
