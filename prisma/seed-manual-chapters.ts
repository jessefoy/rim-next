/**
 * Migrates ManualContent.tsx chapters into ManualSection DB records.
 * Converts JSX to raw HTML and upserts each chapter.
 * Run: set -a && source .env.local && set +a && npx tsx prisma/seed-manual-chapters.ts
 */

import { PrismaClient } from "@prisma/client"
import fs from "fs"
import path from "path"

const db = new PrismaClient()

function jsxToHtml(jsx: string): string {
  return jsx
    // Remove JSX block comments
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    // Convert className= to class=
    .replace(/className=/g, "class=")
    // Convert style={{ ... }} to style="..."  (single-line object literals)
    .replace(/style=\{\{([^}]*)\}\}/g, (_match, inner) => {
      const styleStr = inner
        .replace(/"/g, "")
        .replace(/,\s*/g, "; ")
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .toLowerCase()
        .trim()
      return `style="${styleStr}"`
    })
    // Remove JSX string expression wrappers for template literals in <pre>
    .replace(/<pre([^>]*)>\{`([\s\S]*?)`\}<\/pre>/g, "<pre$1>$2</pre>")
    // Remove empty JSX fragments
    .replace(/<>(\s*)</g, "$1<")
    .replace(/>\s*<\/>/g, ">")
    // Clean up any remaining { } around simple strings (rare)
    .replace(/\{["']([^"']+)["']\}/g, "$1")
    // Normalize whitespace in attributes
    .replace(/\s+>/g, ">")
}

function extractChapter(source: string, startMarker: string, endMarker: string | null): string {
  const start = source.indexOf(startMarker)
  if (start === -1) return ""
  const end = endMarker ? source.indexOf(endMarker, start + startMarker.length) : source.lastIndexOf("</main>")
  const chunk = end !== -1 ? source.slice(start, end) : source.slice(start)
  return jsxToHtml(chunk).trim()
}

async function main() {
  const srcPath = path.join(process.cwd(), "components", "ManualContent.tsx")
  const src = fs.readFileSync(srcPath, "utf-8")

  const sections = [
    {
      slug: "introduction",
      title: "Introduction",
      description: "What RIM's volunteer manual covers, who it's for, and how to use it.",
      hubSlug: null as string | null,
      order: 1,
      relations: ["volunteer-roles"],
      startMarker: '<div id="introduction"',
      endMarker: '<div id="registration"',
    },
    {
      slug: "registration",
      title: "Registration",
      description: "How program registration works — member experience, your tools, statuses, dana, emails, and edge cases.",
      hubSlug: "registrar",
      order: 2,
      relations: ["programs", "member-accounts", "course-hub"],
      startMarker: '<div id="registration"',
      endMarker: '<div id="programs"',
    },
    {
      slug: "programs",
      title: "Programs",
      description: "How to create and manage programs — every field explained, plus Google Meet setup for virtual programs.",
      hubSlug: "registrar",
      order: 3,
      relations: ["registration", "host-hub"],
      startMarker: '<div id="programs"',
      endMarker: '<div id="members"',
    },
    {
      slug: "member-accounts",
      title: "Member Accounts",
      description: "The member directory — how to find, edit, and organize member records, statuses, tags, and households.",
      hubSlug: null,
      order: 4,
      relations: ["registration", "volunteer-roles", "course-hub"],
      startMarker: '<div id="members"',
      endMarker: '<div id="courses"',
    },
    {
      slug: "course-hub",
      title: "Courses & Lessons",
      description: "How RIM's teaching materials are organized, managed, and delivered — from public dharma series to volunteer training.",
      hubSlug: "courses",
      order: 5,
      relations: ["registration", "member-accounts", "programs"],
      startMarker: '<div id="courses"',
      endMarker: '<div id="hub"',
    },
    {
      slug: "host-hub",
      title: "Host Community Hub",
      description: "The Host Community Hub — schedule, sub board, conversations, alerts, and the live session tab.",
      hubSlug: "host-team",
      order: 6,
      relations: ["volunteer-roles", "programs"],
      startMarker: '<div id="hub"',
      endMarker: '<div id="support"',
    },
    {
      slug: "support-inbox",
      title: "Support Inbox",
      description: "The shared email inbox for support@rootedinmindfulness.org — reading, replying, notes, templates, and settings.",
      hubSlug: "support",
      order: 7,
      relations: ["volunteer-roles"],
      startMarker: '<div id="support"',
      endMarker: '<div id="roles"',
    },
    {
      slug: "volunteer-roles",
      title: "Volunteer Roles",
      description: "What each volunteer role unlocks, how to assign and remove roles, and first-admin setup.",
      hubSlug: null,
      order: 8,
      relations: ["member-accounts", "host-hub", "support-inbox", "course-hub"],
      startMarker: '<div id="roles"',
      endMarker: null,
    },
  ]

  for (const s of sections) {
    const html = extractChapter(src, s.startMarker, s.endMarker)
    if (!html) {
      console.warn(`⚠ No content found for ${s.slug}`)
      continue
    }
    const body = { type: "rawHtml", html }
    await db.manualSection.upsert({
      where: { slug: s.slug },
      update: {
        title: s.title,
        description: s.description,
        hubSlug: s.hubSlug,
        order: s.order,
        relations: s.relations,
        body,
      },
      create: {
        slug: s.slug,
        title: s.title,
        description: s.description,
        hubSlug: s.hubSlug,
        order: s.order,
        relations: s.relations,
        body,
      },
    })
    console.log(`✓ Upserted: ${s.slug} (${html.length} chars)`)
  }

  // manual-system meta-section
  const manualSystemHtml = `
<div class="man-chapter">
  <h1 class="man-chapter__title">The Manual System</h1>
  <p class="man-chapter__subtitle">How the volunteer manual works, how to update it, and the closing ritual rule.</p>
</div>
<section class="man-section">
  <h2 class="man-section__title">How the manual works</h2>
  <p>The volunteer manual is a database-driven system. Each chapter is a <strong>ManualSection</strong> record stored in the database with a unique slug, title, description, hub association, and body content.</p>
  <p>The manual index at <strong>/admin/manual</strong> lists all sections ordered by the <code>order</code> field. Each section has its own page at <strong>/admin/manual/[slug]</strong>. A public version at <strong>/manual</strong> shows the same index without edit controls.</p>
  <p>Context-sensitive help icons (<strong>?</strong>) throughout the staff UI open the relevant manual section in a new tab. They use the <code>ManualHelpIcon</code> component wired to a <code>manualSlug</code> prop.</p>
</section>
<section class="man-section">
  <h2 class="man-section__title">Section slugs</h2>
  <table class="man-table">
    <thead><tr><th>Slug</th><th>Chapter</th><th>Hub</th></tr></thead>
    <tbody>
      <tr><td>introduction</td><td>Introduction</td><td>—</td></tr>
      <tr><td>registration</td><td>Registration</td><td>registrar</td></tr>
      <tr><td>programs</td><td>Programs</td><td>registrar</td></tr>
      <tr><td>member-accounts</td><td>Member Accounts</td><td>—</td></tr>
      <tr><td>course-hub</td><td>Courses &amp; Lessons</td><td>courses</td></tr>
      <tr><td>host-hub</td><td>Host Community Hub</td><td>host-team</td></tr>
      <tr><td>support-inbox</td><td>Support Inbox</td><td>support</td></tr>
      <tr><td>volunteer-roles</td><td>Volunteer Roles</td><td>—</td></tr>
      <tr><td>manual-system</td><td>The Manual System (this page)</td><td>—</td></tr>
    </tbody>
  </table>
</section>
<section class="man-section">
  <h2 class="man-section__title">The closing ritual rule</h2>
  <p>After every session that adds, changes, or removes a feature — <strong>update the relevant ManualSection record(s)</strong>. This is not optional.</p>
  <div class="man-note man-note--warn">⚠ Touch only the section(s) affected by that session. Do not regenerate sections that didn't change. Use upsert on slug.</div>
  <h3 class="man-section__h3">How to update a section</h3>
  <ol class="man-steps">
    <li>Go to <strong>/admin/manual/[slug]/edit</strong> — or from the manual index, find the section and click Edit.</li>
    <li>Update the body content using the rich text editor.</li>
    <li>Alternatively, update the seed script (<code>prisma/seed-manual-chapters.ts</code>) and re-run it — this is useful for large rewrites.</li>
    <li>Write for the person doing the work, not the developer. Use the same voice as the rest of the manual.</li>
  </ol>
  <h3 class="man-section__h3">The full closing ritual</h3>
  <ol class="man-steps">
    <li>Update <strong>FEATURES.md</strong> — add session entry, update relevant feature sections.</li>
    <li>Update <strong>RIM_Stack_Reference.md</strong> — update stack, routes, or env vars if changed.</li>
    <li>Update <strong>RIM_System_Architecture.md</strong> — if hubs, roles, or member data architecture changed.</li>
    <li>Upsert the relevant <strong>ManualSection DB records</strong> for anything built, changed, or removed. Write for the person doing the work.</li>
  </ol>
</section>
<section class="man-section">
  <h2 class="man-section__title">The ManualHelpIcon component</h2>
  <p>The <code>ManualHelpIcon</code> component renders a quiet <strong>?</strong> circle that links to a manual section in a new tab. It accepts a <code>manualSlug</code> prop.</p>
  <p>Place it in the top-right of any page or hub header where context help is relevant. Never floating over content; never in the navigation bar.</p>
  <p>Current wiring locations: Course Hub landing, series editor, lesson editor, member courses library, public courses browse, Host Hub landing, Registrar Hub landing, Support Inbox landing, admin member detail, admin teachers.</p>
  <div class="man-note man-note--dev"><span class="man-note--dev__label">⚠️&ensp;Developer note</span>The component is at <code>components/ManualHelpIcon.tsx</code>. It renders as a client component (&quot;use client&quot;) with <code>mh-icon</code> CSS prefix. CSS is in <code>public/css/custom.css</code>.</div>
</section>
`

  await db.manualSection.upsert({
    where: { slug: "manual-system" },
    update: {
      title: "The Manual System",
      description: "How the volunteer manual works, how to update it, and the closing ritual rule.",
      hubSlug: null,
      order: 9,
      relations: [],
      body: { type: "rawHtml", html: manualSystemHtml.trim() },
    },
    create: {
      slug: "manual-system",
      title: "The Manual System",
      description: "How the volunteer manual works, how to update it, and the closing ritual rule.",
      hubSlug: null,
      order: 9,
      relations: [],
      body: { type: "rawHtml", html: manualSystemHtml.trim() },
    },
  })
  console.log("✓ Upserted: manual-system")

  console.log("\n✅ All manual sections migrated.")
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
