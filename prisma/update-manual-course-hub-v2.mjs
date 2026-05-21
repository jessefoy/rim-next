/**
 * update-manual-course-hub-v2.mjs — Full rewrite of the Courses chapter
 * for the session-123 offering model build.
 *
 * The v1 chapter (update-manual-course-hub.mjs) described the legacy
 * 3-tier access model (`ALL_MEMBERS` / `REGISTRATION_REQUIRED` /
 * `ROLE_REQUIRED`) and pre-dated the dana model + categories work in
 * session 123. After session 123 the editor has 8 tabs, four dana modes,
 * orthogonal access flags, full category CRUD, and a public landing
 * page at /course/[slug]. This rewrite reflects the actual UI a
 * coordinator now sees.
 *
 * Body is plain HTML string. Idempotent at the record level (update by
 * slug). Wired into migrate.mjs with a v2 flag.
 */

const COURSE_HUB_BODY = `<p>The courses system at RIM is a library of structured teaching materials — public dharma series, retreat recordings, study collections, internal volunteer training, role-specific content. All of it lives in the same system, organized by intent.</p>
<p>The system has two building blocks:</p>
<ul>
<li><strong>A course</strong> is a container — a series, a study collection, a training program. The course page is where members go to see the lesson list, track progress, and work through the content. (The database still uses the word "Course" — and the URL is <code>/course/[slug]</code> — though we sometimes still call these "series" in conversation.)</li>
<li><strong>A lesson</strong> is a single piece of content — an audio recording, a video, a written teaching, a guided practice, or a mix.</li>
</ul>
<p>A lesson can belong to more than one course. A guided breathing meditation might appear in an introductory course, in a retreat preparation course, and in a standalone lesson library, all at once. The lesson is created once; the course just references it.</p>

<h2>Where members find courses</h2>
<p><strong>The public catalog at <code>/courses</code>.</strong> The marketing page. Anyone — even non-members — can see the list of courses that are opted in to the public catalog. Categories group them.</p>
<p><strong>The course landing page at <code>/course/[slug]</code>.</strong> This is a real public landing — anyone can read the description, see the teachers, view the lesson titles. What appears in the CTA slot depends on the visitor's state: a Sign-in button for visitors who aren't signed in, an Enroll button for members who can self-enroll, a friendly message for members who can't, a link to the live cohort when the course is bundled with a registering program. Enrolled members see the lesson list and a Continue button instead.</p>
<p><strong>The member Library at <code>/account/courses</code>.</strong> A member's personal view of every course they're enrolled in, organized by progress: in progress, not started, completed.</p>
<p><strong>The lesson page at <code>/lessons/[slug]</code>.</strong> Each lesson has its own page — auth-gated; only members with access to the parent course can open it. Audio player, body content, teacher names, downloadable resources, and a <strong>Mark as complete</strong> button at the bottom.</p>

<h2>Access: how a member gets into a course</h2>
<p>The Course editor's <strong>Access</strong> tab decides how a member can enroll. The controls are independent — combine them to express different course shapes.</p>
<ul>
<li><strong>Members can self-enroll.</strong> When on, the course page shows an Enroll button. When off, access has to come from somewhere else — a live program registration, an admin grant, or onboarding auto-enrollment.</li>
<li><strong>Restrict to specific roles.</strong> When on, only members holding one of the selected roles can see or enroll. Admins always bypass. Used for teacher training, volunteer-specific content, internal materials.</li>
<li><strong>Access Restriction Message.</strong> A friendly per-course message shown to visitors who can't enroll (no role, no live cohort open, manual-grant-only). Leave blank to use a sensible derived default.</li>
</ul>
<p>There are four ways a member ends up with access to a course:</p>
<ol>
<li><strong>Self-enroll.</strong> They click the Enroll button on the course page. (Dana may be required first — see below.)</li>
<li><strong>Program registration.</strong> Registering for a program linked to this course (via the Linked Course on the Program editor) enrolls them automatically.</li>
<li><strong>Manual admin grant.</strong> An admin grants access from a member's profile in <code>/admin/members/[id]</code>.</li>
<li><strong>Onboarding.</strong> If the course is marked "Auto-enroll new members," every new sign-up gets it.</li>
</ol>

<h2>Dana: how the offering works</h2>
<p>The <strong>Dana</strong> tab in the Course editor chooses how the dana step works. Four modes — same as Programs:</p>
<ul>
<li><strong>None.</strong> No dana step. The member clicks Enroll and they're in. Use for onboarding, internal training, or always-free courses.</li>
<li><strong>Voluntary.</strong> Pay what you want. You can set a suggested default amount; members can change it. Stripe minimum is $1.</li>
<li><strong>Base + Dana.</strong> A minimum required to enroll, plus the option to add more on top. Set the base amount, and optionally a suggested extra. Members see chips like <em>[$50, $75, $100]</em> with the minimum enforced.</li>
<li><strong>Fixed.</strong> An exact amount. No picker, no extra. Use for paid courses with a specific price.</li>
</ul>
<p>The <strong>Dana Message</strong> field below the mode picker is a rich-text editor — use it to explain how dana supports the teachings, what members should know, why this course is offered this way. It appears on the course landing page near the Enroll button.</p>
<p>When a member completes dana payment through Stripe, three things happen automatically: they're enrolled, a Donation record is written for QuickBooks reconciliation, and a receipt + welcome email lands in their inbox.</p>

<h2>The canonical course shapes</h2>
<p>The flags above combine into the standard patterns. Pick one as a starting point and adjust:</p>
<ul>
<li><strong>Free for all members.</strong> Self-enroll on, dana mode None, no role gate. Anyone signed in can open and enroll. Use for community library content.</li>
<li><strong>Dana self-enroll, voluntary.</strong> Self-enroll on, dana mode Voluntary, suggested amount set. Pay-what-you-want with a default to anchor.</li>
<li><strong>Dana self-enroll, base + extra.</strong> Self-enroll on, dana mode Base + Dana, base + suggested extra both set. A minimum required plus generosity on top.</li>
<li><strong>Paid course, fixed price.</strong> Self-enroll on, dana mode Fixed, fixed amount set. A specific price; no picker.</li>
<li><strong>Bundled with a live cohort.</strong> Self-enroll off. Members register for the live program; that registration enrolls them in the course. After the cohort ends, you can flip self-enroll on to make the course standalone-available.</li>
<li><strong>Hybrid: live cohort + standalone dana.</strong> Self-enroll on AND linked to a live program. The landing shows the live cohort as the primary CTA when registration is open, with the standalone path as a quiet secondary line.</li>
<li><strong>Manual grant only.</strong> Self-enroll off, public catalog off. Private content; access comes from admin grants only.</li>
<li><strong>Onboarding.</strong> Auto-enroll new members. Every new sign-up gets it automatically.</li>
<li><strong>Role-locked.</strong> Restrict to specific roles, set the role(s). Only members with those roles can see or enroll. Used for teacher training, volunteer materials.</li>
</ul>

<h2>The Course editor — eight tabs</h2>
<p>Open a course at <code>/tools/learning/[slug]</code>. The editor is organized into eight tabs that mirror the Program editor's structure:</p>
<ul>
<li><strong>Content.</strong> Title, slug, subheading, the main description (rich text), completion note shown when a member finishes every lesson.</li>
<li><strong>Lessons.</strong> The lesson list — drag-to-reorder, add an existing lesson by search, create a new lesson inline, group lessons into sections with labeled dividers. Only available after the course has been saved at least once.</li>
<li><strong>Landing.</strong> Hero image URL, pull quote and source, dana page note (a short note that appears on the landing page, distinct from the rich Dana Message at checkout).</li>
<li><strong>Categories.</strong> Assign the course to a category for the public catalog. Create new categories inline with the Add button; delete categories that have no courses assigned (populated categories can't be deleted — reassign their courses first).</li>
<li><strong>Access.</strong> The orthogonal-flag access controls described above (self-enroll, role gate, restriction message).</li>
<li><strong>Schedule.</strong> Placeholder. Lesson drip release — unlocking lessons on a schedule — is coming as a focused future build. Until then, all lessons are available to enrolled members immediately.</li>
<li><strong>Dana.</strong> The four-mode dana picker and conditional amount fields, plus the rich-text Dana Message editor.</li>
<li><strong>Visibility.</strong> Active toggle (off hides the course everywhere), public catalog opt-in, onboarding flag, hide-from-member-profile flag, sort order.</li>
</ul>
<p>Save with the bottom button. The course landing page link in the top-right of the editor lets you view it as a member would.</p>

<h2>Categories</h2>
<p>Categories group courses on the public <code>/courses</code> catalog. A course without a category still appears, just ungrouped. The Categories tab in the editor has both the assignment dropdown (for this course) AND inline CRUD for the category list:</p>
<ul>
<li><strong>Add a new category.</strong> Type a name, click Add. The category becomes available to assign and auto-assigns to the course you're editing.</li>
<li><strong>Delete an empty category.</strong> The Delete button is disabled for categories that have courses assigned. Reassign the courses first, then delete.</li>
</ul>

<h2>Enrollment, completion, the lesson page</h2>
<p>Enrollment is the record that the member has decided to work through this course. Self-enrolled members can leave from their library (their progress is lost). Members enrolled via program registration, manual grant, or onboarding cannot self-remove — those enrollments are managed elsewhere.</p>
<p>At the bottom of every lesson page, there's a <strong>Mark as complete</strong> button. Clicking it records the completion. Clicking again un-marks it.</p>
<p>Course progress shows on the course page when a member is enrolled: <em>"3 of 8 complete."</em> The Continue button skips to the next incomplete lesson.</p>
<p>When the last lesson is marked complete, the lesson page shows a quiet completion message. If you wrote a Completion Note on the Content tab, it appears below the message. The course moves to the Completed section of the member's library — fully accessible, encouraged to revisit.</p>

<h2>Where the work happens — Hub vs Tool</h2>
<p>Two surfaces for the courses team — they serve different purposes.</p>
<p><strong>The Course Manager</strong> at <code>/tools/learning</code> is where courses and lessons are created and edited. This is where teachers and the courses team spend most of their working time.</p>
<p><strong>The Course Hub</strong> at <code>/account/hub/courses</code> is the team workspace — conversations, documents, members, and a link to the Course Manager. The hub itself doesn't house the editor; it's where the team coordinates.</p>

<h2>Who has access to what</h2>
<ul>
<li><strong>TEACHER role</strong> grants access to the Course Manager and the Course Hub by default.</li>
<li><strong>ADMIN</strong> has access to everything.</li>
<li><strong>Course Hub membership</strong> can also be assigned per person, separately from roles. An admin grants hub access from a member's profile page in the Hub Access section. This matters for visiting teachers who contribute one course — they can have hub access without holding a global TEACHER role.</li>
</ul>

<h2>A note on the slug</h2>
<p>A course's slug is part of its URL. Once a course is published and members are enrolled, <strong>don't change the slug.</strong> Changing it breaks every existing link — bookmarks, emails, anything that linked to that course page. The slug field in the editor is locked by default for this reason.</p>`;

export async function updateManualCourseHubV2(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "course-hub" },
    select: { id: true },
  });

  const data = {
    title: "Courses & Lessons",
    description:
      "How RIM's courses and lessons are organized, accessed, and managed — the access model, the four dana modes, categories, the eight editor tabs, and the hub-vs-tool split.",
    hubSlug: "courses",
    body: COURSE_HUB_BODY,
    relations: ["volunteer-roles", "registration"],
  };

  if (existing) {
    await db.manualSection.update({
      where: { slug: "course-hub" },
      data,
    });
    console.log("  ✔ Updated manual section: course-hub (v2 — session 123)");
  } else {
    await db.manualSection.create({
      data: { slug: "course-hub", order: 5, ...data },
    });
    console.log("  ✔ Created manual section: course-hub (v2 — session 123)");
  }
}
