/**
 * Upserts the course-hub ManualSection to document the drip/release schedule settings,
 * including the hideLockedLessons toggle added in session 64.
 * Run with:
 *   POSTGRES_PRISMA_URL="$(grep POSTGRES_URL_NON_POOLING .env.local | cut -d'"' -f2)" npx tsx prisma/update-course-hub-drip-section.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // Fetch the existing record so we can append to it rather than overwrite
  const existing = await db.manualSection.findUnique({ where: { slug: "course-hub" } });

  const dripAddendum = `
<h2>Release Schedule (Drip Content)</h2>
<p>The Release Schedule section controls when lessons become available to members after they enroll in a series. By default, all lessons are available immediately.</p>

<h3>Enabling a release schedule</h3>
<p>Check <strong>Release lessons on a schedule</strong> to enable drip delivery. Two modes are available:</p>
<ul>
  <li><strong>Interval</strong> — Each lesson has an "Unlock after X days" field. Leave it blank to use the default interval (set above). Example: Lesson 1 = 0 days (immediate), Lesson 2 = 7 days, Lesson 3 = 14 days.</li>
  <li><strong>Fixed dates</strong> — Each lesson in the list shows a date picker. Set the specific calendar date when that lesson becomes available.</li>
</ul>
<p>The drip preview below the lesson list shows the resolved unlock schedule for each lesson.</p>

<h3>Hide locked lessons</h3>
<p>When <strong>Hide locked lessons from members until they become available</strong> is checked, members only see lessons they can currently access. Upcoming lessons are invisible — they appear automatically as each unlock date arrives.</p>
<p>When unchecked (the default), all lessons are visible. Locked ones show a lock icon and the date they become available, giving members a preview of what's coming.</p>
<p><strong>When to use each option:</strong></p>
<ul>
  <li><strong>Show locked (default)</strong> — Best for most series. Members can see the full curriculum, feel the arc of the series, and know what to expect. Good for contemplative series where seeing the whole path is part of the experience.</li>
  <li><strong>Hide locked</strong> — Best for series where revealing future content would spoil the progression, or where the curriculum changes dynamically. Also useful for cohort-based programs where lessons are released week by week and you don't want members to jump ahead.</li>
</ul>
<p>Admins always see all lessons regardless of this setting.</p>
`.trim();

  // Append the drip addendum to whatever body is already there
  let newBody: object;
  const b = existing?.body as any;
  if (b && b.type === "rawHtml" && typeof b.html === "string") {
    newBody = { type: "rawHtml", html: b.html + "\n\n" + dripAddendum };
  } else {
    // No existing body or non-rawHtml — store addendum as rawHtml
    newBody = { type: "rawHtml", html: dripAddendum };
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

  console.log("✓ course-hub section updated with drip documentation");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
