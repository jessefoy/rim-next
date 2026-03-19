/**
 * One-time migration: convert ReflectionQuestion.body from plain string to Tiptap JSON.
 *
 * Run with:
 *   set -a && source .env.local && set +a
 *   npx ts-node --project tsconfig.json prisma/migrate-question-bodies.ts
 *
 * Or, if ts-node isn't available:
 *   npx tsx prisma/migrate-question-bodies.ts
 *
 * Uses POSTGRES_URL_NON_POOLING to avoid PgBouncer prepared-statement issues.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({
  datasources: {
    db: { url: process.env.POSTGRES_URL_NON_POOLING },
  },
});

async function main() {
  const questions = await db.reflectionQuestion.findMany({
    select: { id: true, body: true },
  });

  let migrated = 0;
  let skipped = 0;

  for (const q of questions) {
    // Detect plain string: body is stored as a JSON value — if it came from the old
    // text column migration it will be a JSON string primitive (typeof === "string")
    if (typeof q.body !== "string") {
      // Already Tiptap JSON (object) or null — skip
      skipped++;
      continue;
    }

    const tiptapJson = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: q.body }],
        },
      ],
    };

    await db.reflectionQuestion.update({
      where: { id: q.id },
      data: { body: tiptapJson },
    });

    console.log(`  Migrated: "${q.body.slice(0, 60)}${q.body.length > 60 ? "…" : ""}"`);
    migrated++;
  }

  console.log(`\nDone. Migrated: ${migrated}, Skipped (already JSON): ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
