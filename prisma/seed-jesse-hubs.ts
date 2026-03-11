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
  // Look up all Jesse accounts (iCloud + work email)
  const users = await db.user.findMany({
    where: {
      OR: [
        { email: { contains: "jesse", mode: "insensitive" } },
        { email: { contains: "icloud.com", mode: "insensitive" } },
      ],
    },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (!users.length) {
    throw new Error("Could not find any Jesse user accounts.");
  }

  // Load all hubs
  const hubs = await db.hub.findMany({ select: { id: true, slug: true, name: true } });
  console.log(`Found ${hubs.length} hubs, ${users.length} user account(s).\n`);

  // Upsert HubMember rows for ALL Jesse accounts
  for (const user of users) {
    console.log(`\nProcessing: ${user.firstName} ${user.lastName} <${user.email}> (id: ${user.id})`);
    for (const hub of hubs) {
      const position = POSITION_MAP[hub.slug] ?? "Hub Coordinator";
      await db.hubMember.upsert({
        where:  { hubId_userId: { hubId: hub.id, userId: user.id } },
        update: { isCoordinator: true, position },
        create: { hubId: hub.id, userId: user.id, isCoordinator: true, position },
      });
      console.log(`  ✓ ${hub.name} (${hub.slug}) — ${position}`);
    }
  }

  console.log(`\nDone. ${hubs.length} hubs × ${users.length} accounts seeded.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
