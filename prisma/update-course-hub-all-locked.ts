/**
 * Appends edge-case documentation (all-locked holding message) to the course-hub ManualSection.
 * Run with:
 *   POSTGRES_PRISMA_URL="$(grep POSTGRES_URL_NON_POOLING .env.local | cut -d'"' -f2)" npx tsx prisma/update-course-hub-all-locked.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const existing = await db.manualSection.findUnique({ where: { slug: "course-hub" } });

  const addendum = `
<h3>When no lessons are available yet</h3>
<p>If <strong>Hide locked lessons</strong> is on and a member enrolls before any lesson has released — possible with fixed-date series where the first lesson's date is still in the future — the lesson list will show a calm holding message instead of an empty space:</p>
<blockquote><em>Your first lesson will be available on Tuesday, April 1.</em></blockquote>
<p>The date is pulled automatically from the first lesson's release date. If the series uses interval-based drip and the date can be calculated from the member's enrollment date, that date is used instead. If no date can be determined (misconfigured series), the message falls back to: <em>Lessons will become available soon.</em></p>
<p>No action is needed from staff — this is handled automatically.</p>
`.trim();

  const b = existing?.body as any;
  let newBody: object;
  if (b && b.type === "rawHtml" && typeof b.html === "string") {
    newBody = { type: "rawHtml", html: b.html + "\n\n" + addendum };
  } else {
    newBody = { type: "rawHtml", html: addendum };
  }

  await db.manualSection.upsert({
    where: { slug: "course-hub" },
    update: { body: newBody },
    create: {
      slug: "course-hub",
      title: "Course Hub",
      description: "Managing the Series and Lesson library",
      body: newBody,
      relations: ["course-hub-series", "course-hub-lessons"],
      order: 10,
    },
  });

  console.log("✓ course-hub section updated with all-locked edge case docs");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
