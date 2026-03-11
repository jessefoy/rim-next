/**
 * Add Jesse Foy as coordinator member of all seeded hubs.
 * Run: set -a && source .env.local && set +a && npx ts-node --compiler-options '{"module":"commonjs"}' prisma/seed-jesse-hubs.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const POSITION_MAP: Record<string, string> = {
  "host-team":              "Hub Coordinator",
  "people-team":            "Hub Coordinator",
  "newsletter":             "Hub Coordinator",
  "greeter":                "Hub Coordinator",
  "av-team":                "Hub Coordinator",
  "housekeeping":           "Hub Coordinator",
  "plant-care":             "Hub Coordinator",
  "sangha-care":            "Hub Coordinator",
  "km-support":             "Hub Coordinator",
  "silent-meditation":      "Hub Coordinator",
  "volunteer-coordination": "Hub Coordinator",
  "board":                  "Board Member",
  "teacher-council":        "Council Member",
};

async function main() {
  // Look up Jesse by admin email
  const user = await db.user.findFirst({
    where: { email: { contains: "jesse", mode: "insensitive" } },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (!user) {
    throw new Error("Could not find user with 'jesse' in email. Check the email address.");
  }
  console.log(`Found user: ${user.firstName} ${user.lastName} <${user.email}> (id: ${user.id})`);

  // Load all hubs
  const hubs = await db.hub.findMany({ select: { id: true, slug: true, name: true } });
  console.log(`Found ${hubs.length} hubs.\n`);

  // Upsert HubMember rows
  for (const hub of hubs) {
    const position = POSITION_MAP[hub.slug] ?? "Hub Coordinator";
    await db.hubMember.upsert({
      where:  { hubId_userId: { hubId: hub.id, userId: user.id } },
      update: { isCoordinator: true, position },
      create: { hubId: hub.id, userId: user.id, isCoordinator: true, position },
    });
    console.log(`  ✓ ${hub.name} (${hub.slug}) — ${position}`);
  }

  console.log(`\nDone. ${hubs.length} HubMember rows created/updated.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
