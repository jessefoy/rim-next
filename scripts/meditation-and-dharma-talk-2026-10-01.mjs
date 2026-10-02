#!/usr/bin/env node
/**
 * One-time change to the Meditation and Dharma Talk program text (the
 * integration brief, A23; words from Drafts Section 4). PREPARED, NOT RUN:
 * it writes to production data, which Jesse approves record by record.
 *
 *   node scripts/meditation-and-dharma-talk-2026-10-01.mjs            dry run: shows before and after, writes nothing
 *   node scripts/meditation-and-dharma-talk-2026-10-01.mjs --apply    writes (one transaction, keyed by slug)
 *
 * Reads the production URL from PRODUCTION_DATABASE_URL, or from
 * POSTGRES_PRISMA_URL in .env.production.local (the shell's own
 * POSTGRES_PRISMA_URL is a placeholder here and is deliberately ignored).
 * Refuses to write if the row changed since the
 * snapshot this script was prepared against (updatedAt drift), saves a
 * snapshot of the row first, and diffs the whole programs table afterward.
 * The bracketed sentence in the draft (the shape of a morning) is Jesse's to
 * supply and is not included. Delete this file after it has run.
 */
import { createRequire } from "module";
import fs from "fs";
import os from "os";
import path from "path";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

const SLUG = "meditation-and-dharma-talk";
// The row's updatedAt when this script was prepared (2026-10-02). A different
// value means someone edited the program since, and the script stops.
const EXPECTED_UPDATED_AT = "2026-09-27T00:23:04.861Z";

const NEW_VALUES = {
  tagline: "Guided meditation and a teaching, on Saturday mornings",
  description:
    "<p>Saturday mornings bring guided meditation and a dharma talk together. The talk draws on the Buddha's teachings and turns them toward how we live: how we meet what is hard, how we relate to one another, and how we enjoy what there is to enjoy.</p>" +
    "<p>It is our longest-running weekly gathering, and the one most people come to first. Some come every week and some once in a while, and each morning is complete in itself.</p>" +
    "<p>Everyone is welcome, in person or on Zoom, and no experience is needed.</p>",
  // No epigraph, unless Jesse has checked the Sharon Salzberg wording against its source.
  pullQuote: null,
  pullQuoteSource: null,
};

function productionUrl() {
  if (process.env.PRODUCTION_DATABASE_URL) return process.env.PRODUCTION_DATABASE_URL;
  const text = fs.readFileSync(new URL("../.env.production.local", import.meta.url), "utf8");
  const match = text.match(/^POSTGRES_PRISMA_URL="?([^"\n]+)"?/m);
  if (!match) throw new Error("No PRODUCTION_DATABASE_URL, and no POSTGRES_PRISMA_URL in .env.production.local");
  return match[1];
}

const apply = process.argv.includes("--apply");
const db = new PrismaClient({ datasourceUrl: productionUrl() });

try {
  await db.$queryRawUnsafe("SELECT 1");
  const row = await db.program.findUnique({ where: { slug: SLUG } });
  if (!row) throw new Error(`No program with slug ${SLUG}`);

  const fields = Object.keys(NEW_VALUES);
  const changed = fields.filter((f) => JSON.stringify(row[f]) !== JSON.stringify(NEW_VALUES[f]));
  console.log(`${SLUG}: ${changed.length ? changed.join(", ") + " would change" : "already as intended, nothing to do"}`);
  for (const f of changed) {
    console.log(`\n--- ${f}\nBEFORE: ${JSON.stringify(row[f])}\nAFTER:  ${JSON.stringify(NEW_VALUES[f])}`);
  }
  if (!apply || changed.length === 0) {
    console.log(apply ? "" : "\nDry run. Nothing was written. Pass --apply to write.");
  } else {
    if (row.updatedAt.toISOString() !== EXPECTED_UPDATED_AT) {
      throw new Error(`DRIFT: updatedAt is ${row.updatedAt.toISOString()}, expected ${EXPECTED_UPDATED_AT}. Review before applying.`);
    }
    const before = await db.program.findMany();
    // In the temp directory, not the repo, so `git add -A` can never commit a program row.
    const snapshot = path.join(os.tmpdir(), `meditation-and-dharma-talk-snapshot-${Date.now()}.json`);
    fs.writeFileSync(snapshot, JSON.stringify(row, null, 2));
    console.log(`\nSnapshot saved to ${snapshot}`);
    // The write is conditioned on the updatedAt just checked, so an edit landing
    // between the check and the write makes it fail instead of overwriting.
    await db.$transaction([db.program.update({ where: { slug: SLUG, updatedAt: row.updatedAt }, data: NEW_VALUES })]);
    const after = await db.program.findMany();
    // Whole-table diff: only this row's changed fields (and updatedAt) should differ.
    const diffs = [];
    for (const a of after) {
      const b = before.find((x) => x.id === a.id);
      if (!b) { diffs.push(`${a.slug}: ADDED`); continue; }
      for (const k of Object.keys(a)) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) diffs.push(`${a.slug}.${k}`);
    }
    if (before.length !== after.length) diffs.push(`row count ${before.length} to ${after.length}`);
    console.log("Whole-table diff:", diffs.join(", "));
  }
} finally {
  await db.$disconnect();
}
