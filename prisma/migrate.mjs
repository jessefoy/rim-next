/**
 * Lightweight migration runner for Vercel builds.
 *
 * Prisma's `migrate deploy` requires a baseline for existing databases.
 * This script runs migrations idempotently via Prisma's $executeRawUnsafe.
 */

import { PrismaClient } from "@prisma/client";
import { seedPrograms } from "./seed-programs.mjs";

const db = new PrismaClient();

const migrations = [
  {
    name: "add_tool_slug_to_hub_app_links",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'hub_app_links' AND column_name = 'toolSlug'
      `);
      if (cols.length === 0) {
        await db.$executeRawUnsafe(`ALTER TABLE "hub_app_links" ADD COLUMN "toolSlug" TEXT`);
        await db.$executeRawUnsafe(`UPDATE "hub_app_links" SET "toolSlug" = 'schedule' WHERE "href" LIKE '%/tools/schedule%'`);
        await db.$executeRawUnsafe(`UPDATE "hub_app_links" SET "toolSlug" = 'inbox' WHERE "href" LIKE '%/tools/inbox%'`);
        await db.$executeRawUnsafe(`UPDATE "hub_app_links" SET "toolSlug" = 'programs' WHERE "href" LIKE '%/tools/programs%'`);
        await db.$executeRawUnsafe(`UPDATE "hub_app_links" SET "toolSlug" = 'learning' WHERE "href" LIKE '%/tools/learning%'`);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    name: "add_sort_order_to_program_categories",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'program_categories' AND column_name = 'sortOrder'
      `);
      if (cols.length === 0) {
        await db.$executeRawUnsafe(`ALTER TABLE "program_categories" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0`);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    name: "add_time_text_to_programs",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'programs' AND column_name = 'timeText'
      `);
      if (cols.length === 0) {
        await db.$executeRawUnsafe(`ALTER TABLE "programs" ADD COLUMN "timeText" TEXT`);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    name: "add_open_access_fields_to_programs",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'programs' AND column_name = 'isOpenAccess'
      `);
      if (cols.length === 0) {
        await db.$executeRawUnsafe(`ALTER TABLE "programs" ADD COLUMN "isOpenAccess" BOOLEAN NOT NULL DEFAULT false`);
        await db.$executeRawUnsafe(`ALTER TABLE "programs" ADD COLUMN "guestAccessKey" TEXT`);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
];

async function main() {
  console.log("Running migrations...");
  for (const m of migrations) {
    await m.run();
  }

  // One-time program seed — check flag to avoid re-running
  const seedFlag = await db.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = '_migration_flags' AND column_name = 'seed_programs_v9'
  `).catch(() => []);

  // Create flag table if missing, then check
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
  `).catch(() => {});

  const applied = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'seed_programs_v9'
  `).catch(() => []);

  if (applied.length === 0) {
    await seedPrograms(db);
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('seed_programs_v9')`);
    console.log("  ✔ Program seed applied.");
  } else {
    console.log("  ⏭ Program seed already applied.");
  }

  await db.$disconnect();
  console.log("Migrations complete.");
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await db.$disconnect();
  process.exit(1);
});
