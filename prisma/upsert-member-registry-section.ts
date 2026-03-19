/**
 * Upserts the member-registry ManualSection to document the section registry
 * architecture introduced in session 68.
 * Run with:
 *   set -a && source .env.local && set +a && npx tsx prisma/upsert-member-registry-section.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const html = `
<h2>Member Profile — Section Registry</h2>
<p>The admin member detail page (<code>/admin/members/[id]</code>) uses a <strong>section registry</strong> to control which panels are visible to which staff roles. This replaces the old single-component approach where all sections were hardcoded into one file.</p>

<h3>How it works</h3>
<p>Each panel on the member profile (Profile, Contact, Status, Tags, Household, Admin Notes, Roles, Hub Access, Teacher, Course Access, Registrations, Danger Zone) is a separate React component. The registry in <code>lib/memberSectionRegistry.tsx</code> lists every section with:</p>
<ul>
  <li><strong>id</strong> — a stable slug used for permission grants (e.g. <code>admin-notes</code>, <code>roles</code>)</li>
  <li><strong>allowedRoles</strong> — which staff roles can see this section (e.g. <code>["ADMIN", "REGISTRAR"]</code>)</li>
  <li><strong>condition</strong> — optional; hides the section if a condition on the member data fails (e.g. Danger Zone only shows when the member has no registrations)</li>
  <li><strong>render</strong> — a function that returns the section component</li>
</ul>
<p>The page server component computes a <code>ViewerPermissions</code> object from the logged-in user's <code>roles</code> and <code>sectionGrants</code>. <code>MemberDetail</code> loops the registry and renders only the sections the viewer is permitted to see.</p>

<h3>Visibility rule</h3>
<p>A viewer sees a section if: they hold at least one of the section's <code>allowedRoles</code>, <strong>OR</strong> the section's <code>id</code> appears in the viewer's <code>sectionGrants</code> array — <em>and</em> the optional condition passes.</p>

<h3>Section inventory</h3>
<table>
  <thead><tr><th>Section ID</th><th>Component</th><th>Roles</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td>core-record</td><td>CoreRecordSection</td><td>ADMIN, REGISTRAR</td><td>Identity, Contact, Status, Tags — one shared Save bar</td></tr>
    <tr><td>household</td><td>HouseholdSection</td><td>ADMIN, REGISTRAR</td><td>Existing component, unchanged</td></tr>
    <tr><td>admin-notes</td><td>AdminNotesSection</td><td>ADMIN</td><td>Private Tiptap notes; own Save button</td></tr>
    <tr><td>roles</td><td>RolesSection</td><td>ADMIN</td><td>Role checkboxes; own Save button; email side-effects in API</td></tr>
    <tr><td>hub-access</td><td>HubAccessSection</td><td>ADMIN</td><td>Existing component, unchanged</td></tr>
    <tr><td>teacher</td><td>TeacherSection</td><td>ADMIN</td><td>isTeacher flag + TeacherProfile; own Save; POSTs to teacher-profile endpoint</td></tr>
    <tr><td>course-access</td><td>CourseAccessSection</td><td>ADMIN, REGISTRAR</td><td>Existing component; registry wraps it in adm-section</td></tr>
    <tr><td>registrations</td><td>RegistrationHistorySection</td><td>ADMIN, REGISTRAR</td><td>Read-only list</td></tr>
    <tr><td>danger-zone</td><td>DangerZoneSection</td><td>ADMIN</td><td>Only shown when member.registrations.length === 0</td></tr>
  </tbody>
</table>

<h3>sectionGrants — viewer-level access</h3>
<p>Every <code>User</code> record has a <code>sectionGrants String[]</code> field. This is how an admin can grant a non-ADMIN staff member access to a specific section without giving them a full role. For example, a SANGHA_CARE coordinator could be granted <code>"admin-notes"</code> so they can read and write care notes for members — without needing ADMIN or REGISTRAR.</p>
<p>Currently, <code>sectionGrants</code> is admin-assigned directly in the database (no UI yet). Future work can add a UI in the member profile to manage these grants.</p>

<h3>Key files</h3>
<ul>
  <li><code>lib/memberSectionRegistry.tsx</code> — registry definition, <code>SerializedMember</code> type, <code>ViewerPermissions</code> type</li>
  <li><code>components/MemberDetail.tsx</code> — thin orchestrator: header + archived banner + registry loop</li>
  <li><code>components/member-sections/CoreRecordSection.tsx</code> — Identity, Contact, Status, Tags</li>
  <li><code>components/member-sections/AdminNotesSection.tsx</code> — Admin Notes</li>
  <li><code>components/member-sections/RolesSection.tsx</code> — Roles &amp; Permissions</li>
  <li><code>components/member-sections/TeacherSection.tsx</code> — Teacher Attribution + Profile</li>
  <li><code>components/member-sections/RegistrationHistorySection.tsx</code> — Registration History</li>
  <li><code>components/member-sections/DangerZoneSection.tsx</code> — Delete member</li>
  <li><code>app/admin/members/[id]/page.tsx</code> — server component; fetches viewer's sectionGrants; passes ViewerPermissions</li>
</ul>

<h3>Adding a new section</h3>
<ol>
  <li>Create a component in <code>components/member-sections/</code></li>
  <li>Add an entry to <code>MEMBER_SECTIONS</code> in <code>lib/memberSectionRegistry.tsx</code> — choose a stable <code>id</code>, set <code>allowedRoles</code>, write the <code>render</code> function</li>
  <li>If the section needs new data, add it to the <code>SerializedMember</code> type and the <code>serialized</code> object in <code>page.tsx</code></li>
  <li>Update this manual section</li>
</ol>

<h3>🔧 Technical notes</h3>
<ul>
  <li><strong>No circular import issue:</strong> Section components import <code>SerializedMember</code> as a type-only import (<code>import type</code>), which TypeScript erases. The registry imports the actual component modules. This is safe.</li>
  <li><strong>isTeacher moved:</strong> The <code>isTeacher</code> field is now set via <code>PATCH /api/admin/members/[id]/teacher-profile</code> (along with TeacherProfile fields), not via the main PATCH route. The main PATCH no longer accepts <code>isTeacher</code>.</li>
  <li><strong>Independent save bars:</strong> Each section owns its own save state. There is no longer a single global Save button that covers all fields. This reduces the chance of accidentally overwriting one section while saving another.</li>
  <li><strong>RSC serialization rule still applies:</strong> The <code>serialized</code> object in <code>page.tsx</code> must be constructed field-by-field. Never spread a Prisma include result.</li>
</ul>
`;

  await db.manualSection.upsert({
    where: { slug: "member-registry" },
    create: {
      slug: "member-registry",
      title: "Member Profile — Section Registry",
      description: "How the admin member detail page sections are structured, permissioned, and extended",
      hubSlug: null,
      body: { type: "rawHtml", html },
      relations: ["member-accounts", "volunteer-roles"],
      order: 95,
    },
    update: {
      title: "Member Profile — Section Registry",
      description: "How the admin member detail page sections are structured, permissioned, and extended",
      body: { type: "rawHtml", html },
      relations: ["member-accounts", "volunteer-roles"],
    },
  });

  console.log("✓ Upserted ManualSection: member-registry");
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
