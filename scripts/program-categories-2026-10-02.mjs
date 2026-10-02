#!/usr/bin/env node
/**
 * One-time migration: fill every program's Category, Format and the two
 * checkboxes (the program-categories brief, C6). PREPARED AND DRY-RUN ONLY:
 * it writes program data to production, which Jesse approves, row by row,
 * through the mapping table in program-categories-2026-10-02.mapping.mjs.
 *
 *   node scripts/program-categories-2026-10-02.mjs            dry run: the mapping table, the before-and-after droppable proof, the checks; writes nothing
 *   node scripts/program-categories-2026-10-02.mjs --apply    writes (after the approved table)
 *
 * What --apply does, in order:
 *   1. Stops unless every check below passes (every program is in the table and
 *      no other; each row valid; every droppable answer unchanged).
 *   2. Makes sure the four columns exist (idempotent; the build adds them too).
 *   3. Drift guard: stops if any program's updatedAt differs from the value the
 *      table was prepared against (someone edited it since).
 *   4. Saves a snapshot of the whole programs table to the temp directory.
 *   5. One transaction: one UPDATE per row, keyed by slug AND updatedAt, setting
 *      only the four offering columns. updatedAt is NOT bumped (raw SQL), so no
 *      program looks edited, and nothing else on a row can change.
 *   6. Whole-table diff afterward: only the four columns may differ.
 *
 * It never touches ProgramCategory or `categoryId` (the old category stays
 * until the migration is verified). Reads the production URL from
 * PRODUCTION_DATABASE_URL, or POSTGRES_PRISMA_URL in .env.production.local (the
 * shell's own POSTGRES_PRISMA_URL is a placeholder and is ignored). Delete this
 * file and the mapping after the migration is verified.
 */
import { createRequire } from "module";
import fs from "fs";
import os from "os";
import path from "path";
import { MAPPING } from "./program-categories-2026-10-02.mapping.mjs";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

// ── The rules, written out (a second implementation, independent of lib/programOffering.ts) ──
const CATEGORIES = ["FOUNDATIONS", "ONGOING_LEARNING_PRACTICE", "IMMERSION", "COMMUNITY_GROUP", "SPECIAL_EVENT", "SERVICE", "PRIVATE"];
const WAYS = ["FOUNDATIONS", "ONGOING_LEARNING_PRACTICE", "IMMERSION"];
const FORMATS = ["DROP_IN", "CLASS", "COURSE", "WORKSHOP", "DAY_OF_MINDFULNESS", "RETREAT"];

/** The old rule: the category's kind and the program's registration. */
function droppableBefore(kind, registrationEnabled) {
  if (kind === "DROP_IN") return true;
  if (kind === "COMMUNITY_GROUP") return !registrationEnabled;
  if (kind == null) return !registrationEnabled;
  return false;
}
/** The new rule: Category and Format. */
function droppableAfter(category, format, registrationEnabled) {
  if (category === "COMMUNITY_GROUP") return !registrationEnabled;
  if (category === "SPECIAL_EVENT" || category === "SERVICE" || category === "PRIVATE") return false;
  return format === "DROP_IN";
}

function productionUrl() {
  if (process.env.PRODUCTION_DATABASE_URL) return process.env.PRODUCTION_DATABASE_URL;
  const text = fs.readFileSync(new URL("../.env.production.local", import.meta.url), "utf8");
  const match = text.match(/^POSTGRES_PRISMA_URL="?([^"\n]+)"?/m);
  if (!match) throw new Error("No PRODUCTION_DATABASE_URL, and no POSTGRES_PRISMA_URL in .env.production.local");
  return match[1];
}

const apply = process.argv.includes("--apply");
const db = new PrismaClient({ datasourceUrl: productionUrl() });
const yn = (b) => (b ? "yes" : "no");
const pad = (s, n) => String(s ?? "").padEnd(n).slice(0, n);

try {
  await db.$queryRawUnsafe("SELECT 1");
  const rows = await db.program.findMany({
    select: { slug: true, name: true, archivedAt: true, registrationEnabled: true, updatedAt: true, category: { select: { slug: true, kind: true } } },
    orderBy: [{ archivedAt: "asc" }, { slug: "asc" }],
  });

  // Is the offering already filled in on any row (columns may not exist yet)?
  let existing = new Map();
  let columnsPresent = true;
  try {
    const raw = await db.$queryRawUnsafe(`SELECT slug, "offeringCategory", "offeringFormat", "silentMeditation", "hostedByVolunteers" FROM "programs"`);
    existing = new Map(raw.map((r) => [r.slug, r]));
  } catch {
    columnsPresent = false;
  }

  // ── The mapping table ──────────────────────────────────────────────────────
  const problems = [];
  const bySlug = new Map(MAPPING.map((m) => [m.slug, m]));
  console.log(`\nProgram categories migration: ${rows.length} programs in production, ${MAPPING.length} rows in the mapping table. Offering columns present: ${columnsPresent ? "yes" : "no (the build adds them; --apply would add them)"}.\n`);
  console.log([pad("PROGRAM", 52), pad("CURRENT CATEGORY", 24), pad("PROPOSED CATEGORY", 27), pad("PROPOSED FORMAT", 19), "SILENT", "HOSTED", "DROPPABLE BEFORE>AFTER", "?"].join(" | "));
  let unchanged = 0;
  for (const r of rows) {
    const m = bySlug.get(r.slug);
    if (!m) { problems.push(`${r.slug}: not in the mapping table`); console.log(pad(r.slug, 52), "| NOT IN THE TABLE"); continue; }
    const before = droppableBefore(r.category?.kind ?? null, r.registrationEnabled);
    const after = droppableAfter(m.category, m.format, r.registrationEnabled);
    if (before === after) unchanged++;
    else problems.push(`${r.slug}: droppable would change from ${before} to ${after}`);
    if (!CATEGORIES.includes(m.category)) problems.push(`${r.slug}: unknown category ${m.category}`);
    if (m.format != null && !FORMATS.includes(m.format)) problems.push(`${r.slug}: unknown format ${m.format}`);
    if (WAYS.includes(m.category) && !m.format) problems.push(`${r.slug}: a way needs a format`);
    if (m.silentMeditation && m.format !== "DROP_IN") problems.push(`${r.slug}: silent meditation needs Drop-in`);
    if ((m.current ?? null) !== (r.category?.slug ?? null)) problems.push(`${r.slug}: table says current category ${m.current}, production has ${r.category?.slug ?? null}`);
    console.log([pad(r.slug + (r.archivedAt ? " (archived)" : ""), 52), pad(r.category?.slug ?? "(none)", 24), pad(m.category, 27), pad(m.format ?? "(none)", 19), pad(yn(m.silentMeditation), 6), pad(yn(m.hostedByVolunteers), 6), `${yn(before)} > ${yn(after)}${before === after ? "" : "  MISMATCH"}`, m.unsure ? "?" : ""].join(" | "));
  }
  for (const m of MAPPING) if (!rows.find((r) => r.slug === m.slug)) problems.push(`${m.slug}: in the table but not in production`);
  console.log(`\nisOpenlyDroppable unchanged for ${unchanged} of ${rows.length} programs.`);
  console.log(`Rows marked ? (questions for Jesse): ${MAPPING.filter((m) => m.unsure).map((m) => m.slug).join(", ")}`);
  const filled = [...existing.values()].filter((e) => e.offeringCategory != null).length;
  console.log(`Rows already carrying an offering Category in production: ${filled}.`);

  if (problems.length) {
    console.log("\nPROBLEMS (the migration will not run until these are resolved):\n  - " + problems.join("\n  - "));
    process.exitCode = 1;
  } else {
    console.log("\nAll checks pass.");
  }

  if (!apply) {
    console.log("\nDry run. Nothing was written. Pass --apply to write, after Jesse approves the table.");
  } else if (problems.length) {
    throw new Error("Not applying: resolve the problems above first.");
  } else {
    // 2. columns
    await db.$executeRawUnsafe(`ALTER TABLE "programs" ADD COLUMN IF NOT EXISTS "offeringCategory" TEXT`);
    await db.$executeRawUnsafe(`ALTER TABLE "programs" ADD COLUMN IF NOT EXISTS "offeringFormat" TEXT`);
    await db.$executeRawUnsafe(`ALTER TABLE "programs" ADD COLUMN IF NOT EXISTS "silentMeditation" BOOLEAN NOT NULL DEFAULT false`);
    await db.$executeRawUnsafe(`ALTER TABLE "programs" ADD COLUMN IF NOT EXISTS "hostedByVolunteers" BOOLEAN NOT NULL DEFAULT false`);
    // 3. drift guard
    for (const r of rows) {
      const m = bySlug.get(r.slug);
      if (r.updatedAt.toISOString() !== m.expectedUpdatedAt) {
        throw new Error(`DRIFT: ${r.slug} updatedAt is ${r.updatedAt.toISOString()}, the table was prepared against ${m.expectedUpdatedAt}. Review before applying.`);
      }
    }
    // 4. snapshot
    const full = await db.$queryRawUnsafe(`SELECT * FROM "programs" ORDER BY slug`);
    const snapshot = path.join(os.tmpdir(), `programs-table-snapshot-${Date.now()}.json`);
    fs.writeFileSync(snapshot, JSON.stringify(full, null, 2));
    console.log(`\nSnapshot of the whole programs table saved to ${snapshot}`);
    // 5. one transaction, one UPDATE per row, keyed by slug and updatedAt
    const stamps = new Map(rows.map((r) => [r.slug, r.updatedAt]));
    await db.$transaction(async (tx) => {
      for (const m of MAPPING) {
        const n = await tx.$executeRawUnsafe(
          `UPDATE "programs" SET "offeringCategory" = $1, "offeringFormat" = $2, "silentMeditation" = $3, "hostedByVolunteers" = $4 WHERE slug = $5 AND "updatedAt" = $6`,
          m.category, m.format, m.silentMeditation, m.hostedByVolunteers, m.slug, stamps.get(m.slug)
        );
        if (n !== 1) throw new Error(`${m.slug}: expected to update exactly one row, updated ${n}. Rolled back.`);
      }
    });
    // 6. whole-table diff
    const after = await db.$queryRawUnsafe(`SELECT * FROM "programs" ORDER BY slug`);
    const OFFERING = new Set(["offeringCategory", "offeringFormat", "silentMeditation", "hostedByVolunteers"]);
    const stray = [];
    let offeringChanges = 0;
    for (const a of after) {
      const b = full.find((x) => x.slug === a.slug);
      for (const k of Object.keys(a)) {
        if (JSON.stringify(a[k]) === JSON.stringify(b?.[k])) continue;
        if (OFFERING.has(k)) offeringChanges++;
        else stray.push(`${a.slug}.${k}`);
      }
    }
    console.log(`Whole-table diff: ${after.length} rows, ${offeringChanges} offering-field changes, ${stray.length} other changes${stray.length ? ": " + stray.join(", ") : ""}.`);
    if (stray.length || after.length !== full.length) process.exitCode = 1;
  }
} finally {
  await db.$disconnect();
}
