#!/usr/bin/env node
/**
 * Looks up each name from legacy teacherFacilitators in the User table so
 * we can build a confirmed ProgramTeacher mapping.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const NAMES = [
  "Gina Dundun",
  "Sam Scherer",
  "Kerry Thomas",
  "Christine Jacobi",
  "Sara Neall",
  "Maria Sprecher",
];

async function main() {
  console.log("\n=== Looking up named teachers in User table ===\n");
  for (const name of NAMES) {
    const [first, ...rest] = name.split(" ");
    const last = rest.join(" ");
    const matches = await db.user.findMany({
      where: {
        AND: [
          { firstName: { equals: first, mode: "insensitive" } },
          { lastName: { equals: last, mode: "insensitive" } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true, isTeacher: true, archivedAt: true },
    });
    if (matches.length === 0) {
      console.log(`  ✗ "${name}" — NO MATCH in User table`);
    } else {
      for (const m of matches) {
        const archived = m.archivedAt ? " [ARCHIVED]" : "";
        const teacher = m.isTeacher ? " isTeacher=true" : " isTeacher=false";
        console.log(`  ✓ "${name}" → ${m.firstName} ${m.lastName} <${m.email}> ${teacher}${archived}`);
      }
    }
  }
  console.log("");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
