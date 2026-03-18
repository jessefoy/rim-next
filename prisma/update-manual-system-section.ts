/**
 * Updates the manual-system ManualSection record to reflect the session 63 fix.
 * Run with:
 *   POSTGRES_PRISMA_URL="$(grep POSTGRES_URL_NON_POOLING .env.local | cut -d'"' -f2)" npx tsx prisma/update-manual-system-section.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const html = `
<h2>About the Staff Manual System</h2>
<p>The staff manual lives in the database — not in code. Each section is a record you can view and edit without a developer or a redeploy. When content changes, you edit it here and it's live immediately.</p>

<h3>Viewing sections</h3>
<p>Go to <strong>/admin/manual</strong> to see the full index of sections. Click any section title to read it. The index is accessible to any logged-in staff member.</p>

<h3>Editing sections (Admin only)</h3>
<p>On any section page, Admins see an <strong>Edit this section</strong> link in the top-right corner. Click it to open the section editor. The editor includes:</p>
<ul>
  <li><strong>Title</strong> — the section heading shown on the index and detail page</li>
  <li><strong>Hub Slug</strong> — optional; links the section to a specific hub (e.g. <code>host-team</code>, <code>courses</code>)</li>
  <li><strong>Content</strong> — the full body, edited with the rich text editor (bold, italic, headings, lists, links, tables)</li>
  <li><strong>Related Sections</strong> — comma-separated slugs; these appear as pill links at the bottom of the section page</li>
  <li><strong>Sort Order</strong> — controls the order sections appear on the index page</li>
</ul>
<p>Click <strong>Save changes</strong> when done. The update is live immediately — no redeploy needed.</p>

<h3>Help icons</h3>
<p>Throughout the staff area you'll see small <strong>?</strong> circles near page titles and section headers. Clicking one opens the relevant manual section in a new tab. These are wired to specific sections and are meant to provide in-context help without leaving your current task.</p>

<h3>Section slugs</h3>
<p>Each section has a permanent slug (e.g. <code>registration</code>, <code>course-hub</code>, <code>host-hub</code>). Slugs are used by help icons throughout the app — changing a slug will break those links. Only change slugs if you update the corresponding help icon wiring in the codebase.</p>

<h3>Current sections</h3>
<ul>
  <li><strong>introduction</strong> — Welcome and orientation for new staff</li>
  <li><strong>registration</strong> — Registration Management: how to use the Registrar Hub</li>
  <li><strong>programs</strong> — Creating and managing programs</li>
  <li><strong>member-accounts</strong> — Member accounts, roles, and household management</li>
  <li><strong>course-hub</strong> — Course Hub: managing the Series and Lesson library</li>
  <li><strong>host-hub</strong> — Host Community Hub: schedule, sessions, sub board</li>
  <li><strong>support-inbox</strong> — Support Inbox: shared Gmail-based email client</li>
  <li><strong>volunteer-roles</strong> — Volunteer roles and what each one can do</li>
  <li><strong>manual-system</strong> — This section: how the manual works</li>
</ul>

<h3>Technical notes (for developers)</h3>
<p>The <code>ManualSection</code> Prisma model stores <code>body</code> as <code>Json?</code>. New sections created in the editor are stored as Tiptap JSON. Sections originally migrated from the old <code>ManualContent.tsx</code> component were stored as <code>{ type: &quot;rawHtml&quot;, html: &quot;...&quot; }</code> — <code>renderContentBody()</code> handles both formats for display. <code>ManualSectionEditor</code> auto-converts rawHtml to Tiptap JSON via <code>generateJSON()</code> when you open the editor; the first save will upgrade the stored format to proper Tiptap JSON.</p>
`.trim();

  await db.manualSection.upsert({
    where: { slug: "manual-system" },
    update: {
      title: "How the Staff Manual Works",
      description: "How to view, edit, and manage staff manual sections — no redeploy needed",
      body: { type: "rawHtml", html },
      order: 99,
    },
    create: {
      slug: "manual-system",
      title: "How the Staff Manual Works",
      description: "How to view, edit, and manage staff manual sections — no redeploy needed",
      body: { type: "rawHtml", html },
      relations: [],
      order: 99,
    },
  });

  console.log("✓ manual-system section updated");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
