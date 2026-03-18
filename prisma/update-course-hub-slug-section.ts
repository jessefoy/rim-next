/**
 * Appends slug field documentation to course-hub-series and course-hub-lessons ManualSections.
 * Run with:
 *   POSTGRES_PRISMA_URL="$(grep POSTGRES_URL_NON_POOLING .env.local | cut -d'"' -f2)" npx tsx prisma/update-course-hub-slug-section.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const slugNote = `
<h3>Slug field</h3>
<p>The slug is the permanent URL identifier for this record. It is <strong>locked by default</strong> when editing — the field appears greyed out and cannot be typed into. This protects against accidentally breaking existing links.</p>
<p>To change the slug, click <strong>Unlock</strong> next to the field. An amber warning will appear reminding you that changing the slug will break any existing links to this page. When you are done editing, click <strong>Lock</strong> to re-lock the field before saving.</p>
<p><strong>In practice:</strong> you should rarely need to change a slug after a record has been created. If you do, update any links in other systems (emails, external references) that point to the old URL.</p>
`.trim();

async function appendToSection(slug: string) {
  const existing = await db.manualSection.findUnique({ where: { slug } });
  if (!existing) {
    console.log(`⚠️  Section not found: ${slug}`);
    return;
  }
  const b = existing.body as any;
  let newBody: object;
  if (b && b.type === "rawHtml" && typeof b.html === "string") {
    newBody = { type: "rawHtml", html: b.html + "\n\n" + slugNote };
  } else {
    newBody = { type: "rawHtml", html: slugNote };
  }
  await db.manualSection.update({ where: { slug }, data: { body: newBody } });
  console.log(`✓ ${slug} updated`);
}

async function main() {
  await appendToSection("course-hub-series");
  await appendToSection("course-hub-lessons");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
