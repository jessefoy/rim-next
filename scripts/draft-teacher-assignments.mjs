#!/usr/bin/env node
/**
 * Drafts ProgramTeacher assignments for the 13 untaught programs.
 * Reads legacy Program.teacherFacilitators free-text + User.isTeacher
 * to suggest matches Jesse can confirm/correct.
 *
 * Usage: set -a && source .env.local && set +a &&
 *        POSTGRES_PRISMA_URL="$POSTGRES_URL" node scripts/draft-teacher-assignments.mjs
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // All marked teachers
  const teachers = await db.user.findMany({
    where: { isTeacher: true },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: [{ firstName: "asc" }],
  });

  console.log(`\n=== Users marked isTeacher=true (${teachers.length}) ===`);
  for (const t of teachers) {
    console.log(`  ${t.firstName} ${t.lastName}  <${t.email}>  (id: ${t.id})`);
  }

  // All active programs with legacy teacherFacilitators free-text + current ProgramTeacher
  const programs = await db.program.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      programFormat: true,
      teacherFacilitators: true,
      programTeachers: {
        select: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  console.log(`\n=== Programs (${programs.length}) — legacy free-text vs ProgramTeacher rows ===\n`);

  // Programs without ProgramTeacher rows, with legacy hint
  const needsBackfill = programs.filter((p) => p.programTeachers.length === 0);
  console.log(`--- Needs backfill (${needsBackfill.length}) ---`);
  for (const p of needsBackfill) {
    const legacy = (p.teacherFacilitators || []).filter(Boolean);
    const legacyStr = legacy.length > 0 ? legacy.join(", ") : "(no legacy hint)";
    console.log(`  [${p.programFormat}] ${p.name}`);
    console.log(`     slug: ${p.slug}`);
    console.log(`     legacy teacherFacilitators: ${legacyStr}`);
    console.log("");
  }

  const haveTeachers = programs.filter((p) => p.programTeachers.length > 0);
  console.log(`--- Already have ProgramTeacher rows (${haveTeachers.length}) ---`);
  for (const p of haveTeachers) {
    const current = p.programTeachers.map((t) => `${t.user.firstName} ${t.user.lastName}`).join(", ");
    const legacy = (p.teacherFacilitators || []).filter(Boolean);
    const legacyStr = legacy.length > 0 ? `legacy: ${legacy.join(", ")}` : "";
    console.log(`  ${p.name} — ${current} ${legacyStr ? `(${legacyStr})` : ""}`);
  }

  console.log("");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
