/**
 * One-time migration: convert Household.notes from plain string to BlockNote JSON.
 *
 * Run with:
 *   set -a && source .env.local && set +a
 *   npx tsx prisma/migrate-household-notes.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({
  datasources: {
    db: { url: process.env.POSTGRES_URL_NON_POOLING },
  },
});

async function main() {
  const households = await db.household.findMany({
    where: { notes: { not: null } },
    select: { id: true, notes: true },
  });

  let migrated = 0;
  let skipped = 0;

  for (const h of households) {
    // If notes is already an array (BlockNote JSON), skip
    if (Array.isArray(h.notes)) {
      skipped++;
      continue;
    }

    // If notes is a plain string (old markdown), convert to BlockNote JSON
    if (typeof h.notes === "string") {
      // Split by newlines and create a paragraph block per line
      const lines = h.notes.split("\n").filter((l) => l.trim());
      const blocks = lines.length > 0
        ? lines.map((line) => ({
            type: "paragraph",
            content: [{ type: "text", text: line }],
          }))
        : [{ type: "paragraph", content: [] }];

      await db.household.update({
        where: { id: h.id },
        data: { notes: blocks },
      });

      console.log(`  Migrated household ${h.id}: "${String(h.notes).slice(0, 60)}${String(h.notes).length > 60 ? "…" : ""}"`);
      migrated++;
      continue;
    }

    // Already an object/other JSON — skip
    skipped++;
  }

  console.log(`\nDone. Migrated: ${migrated}, Skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
