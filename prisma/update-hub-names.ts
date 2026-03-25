/**
 * One-time script: standardize hub names to "X Hub" pattern.
 *
 * Run: npx tsx prisma/update-hub-names.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const updates = [
  { slug: "host-team", name: "Hosting Hub" },
  { slug: "courses",   name: "Teaching Hub" },
  { slug: "registrar", name: "Registration Hub" },
  // "support" is already "Support Hub"
];

async function main() {
  for (const { slug, name } of updates) {
    const hub = await db.hub.findUnique({ where: { slug } });
    if (!hub) {
      console.log(`  ⚠ Hub "${slug}" not found, skipping`);
      continue;
    }
    await db.hub.update({ where: { slug }, data: { name } });
    console.log(`  ✓ ${hub.name} → ${name}`);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
