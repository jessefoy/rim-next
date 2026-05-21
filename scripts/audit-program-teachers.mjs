#!/usr/bin/env node
/**
 * One-off audit: which programs have ProgramTeacher rows, which don't,
 * and who's listed where. Helps decide whether the audio profile gap
 * (Session Hosts without ProgramTeacher rows get "speaker" profile,
 * not "teacher") is hitting real sessions.
 *
 * Usage: set -a && source .env.local && set +a && node scripts/audit-program-teachers.mjs
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const programs = await db.program.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      programFormat: true,
      programTeachers: {
        select: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  console.log(`\n=== Programs and ProgramTeacher rows (${programs.length} total) ===\n`);

  const missing = [];
  const present = [];

  for (const p of programs) {
    const teachers = p.programTeachers
      .map((t) => `${t.user.firstName} ${t.user.lastName}`)
      .join(", ");
    const line = `[${p.programFormat || "—"}] ${p.name} (${p.slug}) — ${teachers || "NO TEACHERS"}`;
    if (p.programTeachers.length === 0) {
      missing.push(line);
    } else {
      present.push(line);
    }
  }

  console.log(`--- Programs WITH ProgramTeacher rows (${present.length}) ---`);
  for (const line of present) console.log("  " + line);

  console.log(`\n--- Programs WITHOUT ProgramTeacher rows (${missing.length}) ---`);
  for (const line of missing) console.log("  " + line);

  // Surface upcoming HostAssignments to cross-reference
  const upcoming = await db.hostAssignment.findMany({
    where: {
      OR: [
        { sessionDate: { gte: new Date() } },
        { sessionDate: null }, // standing assignments
      ],
    },
    select: {
      programSlug: true,
      sessionDate: true,
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ sessionDate: "asc" }],
    take: 30,
  });

  console.log(`\n--- Upcoming HostAssignments (${upcoming.length}, max 30) ---`);
  for (const a of upcoming) {
    const date = a.sessionDate ? a.sessionDate.toISOString().slice(0, 10) : "(standing)";
    console.log(`  ${date}  ${a.programSlug}  ←  ${a.user.firstName} ${a.user.lastName}`);
  }

  // Cross-reference: for each upcoming assignment, is the assigned host
  // also a ProgramTeacher? If not, they're on speaker profile, not teacher.
  console.log(`\n--- Assigned Host vs ProgramTeacher cross-reference ---`);
  const programByslug = new Map(programs.map((p) => [p.slug, p]));
  const gaps = [];
  for (const a of upcoming) {
    const program = programByslug.get(a.programSlug);
    if (!program) continue;
    const teacherIds = new Set(program.programTeachers.map((t) => t.user.id));
    const isTeacher = teacherIds.has(a.user?.id ?? "");
    if (!isTeacher) {
      gaps.push(`  ${a.user.firstName} ${a.user.lastName} hosts ${program.name} (${a.programSlug}) — NOT in ProgramTeacher (speaker profile, not teacher)`);
    }
  }
  if (gaps.length === 0) {
    console.log(`  No gaps — every upcoming host is also a ProgramTeacher for their program.`);
  } else {
    for (const g of gaps) console.log(g);
  }

  console.log("");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
